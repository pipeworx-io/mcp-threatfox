# @pipeworx/threatfox

ThreatFox (abuse.ch) MCP — community IOC feed.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `search_ioc(indicator, exact_match?)`
- `recent_iocs(days?)`
- `search_hash(hash)`
- `search_malware(malware, limit?)`

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Threatfox data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
