# @pipeworx/threatfox

ThreatFox (abuse.ch) MCP — community IOC feed.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1679+ live data sources.

## Tools

- `search_ioc(indicator, exact_match?)`
- `recent_iocs(days?)`
- `search_hash(hash)` — see below, it asks TWO upstream queries
- `search_malware(malware, limit?)`

## search_hash asks both hash relations

ThreatFox stores hashes in two unrelated places and abuse.ch's own
`query: "search_hash"` only searches one of them:

| relation | what it means | upstream query |
|---|---|---|
| `sample_to_c2` | the hash is a malware SAMPLE; rows are the C&C servers it talks to | `search_hash` |
| `hash_listed_as_ioc` | the hash is itself published as an indicator (`threat_type: "payload"`) | `search_ioc` |

Asking only the first made this tool 34-for-34 empty over the 30d to
2026-09-16. It was never a broken endpoint — abuse.ch answers `illegl_hash`
(their typo) for a malformed hash and `no_result` for a well-formed one, so our
request was parsed and accepted throughout. It was the wrong question:
`da168c3ff95c749beec0a2f29a1e6b82`, taken from this pack's own `recent_iocs`,
returns nothing from `search_hash` and a full row from `search_ioc`.

The tool now tries both and returns `matched_relation` saying which answered
(`null` when neither did, alongside `searched_relations`). The second call only
runs when the first found nothing, so a non-empty answer still costs one
request. Do not collapse the two into one unlabelled list: "this file phones
home to that C2" and "this file is itself flagged as a payload" are different
security facts.

**Empty is a real answer here.** ThreatFox tracks C&C infrastructure, not
samples — most hashes are in neither relation. Measured 2026-09-16: 7 of 40
recent MalwareBazaar sample hashes and 2 of 88 of ThreatFox's own hash IOCs
resolved. For sample metadata use the `malwarebazaar` pack (same vendor, same
key), which indexes every sample.

**Committed examples go stale by design.** abuse.ch expires every IOC older
than six months ("IOCs older than 6 months are no longer exposed on the
ThreatFox API and ThreatFox Export"), which is why abuse.ch's OWN documentation
example hash `2151c4b970eff0071948dbbc19066aa4` returns `no_result` today — it
points at IOC id 4726, from 2021. Re-verify the examples in
`workers/gateway/src/tool-examples.json` when they age out; never commit a
placeholder like `d41d8cd98f00b204e9800998ecf8427e` (the MD5 of the empty
string), which is what taught every caller the wrong shape.

## Auth

- **Platform key:** gateway env `PLATFORM_ABUSECH_KEY` (shared with malwarebazaar).
- **BYO:** `?_apiKey=<key>` after registering at https://auth.abuse.ch.

## Data source

`https://threatfox-api.abuse.ch/api/v1/` — header `Auth-Key`, POST with JSON body.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "threatfox": {
      "url": "https://gateway.pipeworx.io/threatfox/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/threatfox/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1679+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/search_ioc \
  -H 'Content-Type: application/json' \
  -d '{"indicator":"105.72.55.52:8080"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/search_ioc`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "threatfox": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-threatfox"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-threatfox
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Threatfox data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
