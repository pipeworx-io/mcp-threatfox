interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * ThreatFox MCP — abuse.ch indicator-of-compromise feed (free, key required)
 *
 * abuse.ch hosts community-curated IOCs: malicious IPs/domains/URLs/hashes
 * tied to malware families, campaigns, and TTPs. Complements `urlhaus` (URLs
 * only), `virustotal` (lookup-based), and `alienvault-otx` (broader pulses).
 *
 * API: https://threatfox.abuse.ch/api/
 * Auth: header `Auth-Key: <api_key>`. Free, register at auth.abuse.ch.
 *
 * Tools:
 * - search_ioc:    look up a specific indicator (IP, domain, URL, hash)
 * - recent_iocs:   IOCs added in the last N days
 * - search_hash:   IOCs associated with a specific file hash (md5/sha1/sha256)
 * - search_malware: IOCs tagged to a malware family
 */


const ENDPOINT = 'https://threatfox-api.abuse.ch/api/v1/';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_ioc',
    description:
      'Look up a specific indicator of compromise (IP, domain, URL, hash, etc.). Returns matching IOCs with malware family, confidence, threat-type, first/last seen, tags, references.',
    inputSchema: {
      type: 'object',
      properties: {
        indicator: { type: 'string', description: 'IP / domain / URL / hash to look up' },
        exact_match: { type: 'boolean', description: 'Require exact match (default true)' },
      },
      required: ['indicator'],
    },
  },
  {
    name: 'recent_iocs',
    description:
      'IOCs added to ThreatFox in the last N days. Useful for daily threat-intel ingestion.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Lookback days (1-7, default 3)' },
      },
      required: [],
    },
  },
  {
    name: 'search_hash',
    description: 'IOCs associated with a file hash (md5 / sha1 / sha256).',
    inputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'md5 / sha1 / sha256' },
      },
      required: ['hash'],
    },
  },
  {
    name: 'search_malware',
    description: 'IOCs tagged to a malware family (e.g., "Cobalt Strike", "Emotet", "QakBot").',
    inputSchema: {
      type: 'object',
      properties: {
        malware: { type: 'string', description: 'Malware family name or MISP alias' },
        limit: { type: 'number', description: 'Max records (default 1000)' },
      },
      required: ['malware'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'ThreatFox requires an API key. Contact the operator about platform credentials, or BYO via ?_apiKey=<key> after registering at https://auth.abuse.ch.',
    );
  }
  switch (name) {
    case 'search_ioc':
      return tfPost(apiKey, {
        query: 'search_ioc',
        search_term: reqStr(args, 'indicator', '"1.2.3.4" or "evil.example.com"'),
        exact_match: args.exact_match !== false,
      });
    case 'recent_iocs':
      return tfPost(apiKey, { query: 'get_iocs', days: Math.min(7, Math.max(1, (args.days as number) ?? 3)) });
    case 'search_hash':
      return tfPost(apiKey, { query: 'search_hash', hash: reqStr(args, 'hash', '"<md5|sha1|sha256>"') });
    case 'search_malware':
      return tfPost(apiKey, {
        query: 'malwareinfo',
        malware: reqStr(args, 'malware', '"Cobalt Strike"'),
        limit: (args.limit as number) ?? 1000,
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing or empty. Pass a string like ${example}.`);
  }
  return v;
}

async function tfPost(apiKey: string, body: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Auth-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) throw new Error('ThreatFox: unauthorized — check the API key');
  if (res.status === 429) throw new Error('ThreatFox: rate-limit (HTTP 429)');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ThreatFox error: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    query_status?: string;
    data?: unknown[];
    [key: string]: unknown;
  };

  if (data.query_status && data.query_status !== 'ok' && data.query_status !== 'no_result') {
    throw new Error(`ThreatFox: ${data.query_status}`);
  }
  return {
    query: body.query,
    status: data.query_status ?? null,
    count: Array.isArray(data.data) ? data.data.length : 0,
    results: Array.isArray(data.data) ? data.data : [],
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
