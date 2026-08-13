# @alex/dsh-search

DeepSeek Harness plugin: **AnySearch-backed web search provider** registered
into `ctx.web` — a single MCP gateway that aggregates exa / tavily /
firecrawl / context7 behind one API key.

Port of [pi-all-search](https://github.com/RealAlexandreAI/pi-all-search)'s
AnySearch provider to the dsh web-search seam.

## Why

dsh ships Exa / Perplexity / DeepSeek search providers. This plugin adds
**AnySearch**: one key, many backends (exa, tavily, firecrawl, context7…),
and no extra per-backend credentials.

## Install

```sh
dsh plugin add @alex/dsh-search
```

The provider registers as `anysearch` on `ctx.web`; the built-in
`web_search` tool picks it up alongside the stock providers.

## Configuration

```yaml
- id: search
  name: '@alex/dsh-search'
  config:
    api_key_ref: ANYSEARCH_API_KEY   # env var name — recommended
    # api_key: <direct value>        # fallback when no ref is set
    # base_url: https://api.anysearch.com/mcp
```

| key | required | meaning |
|---|---|---|
| `api_key_ref` | * | env-var name of the AnySearch API key (resolved via `ctx.credentials`) |
| `api_key` | * | direct API key value (fallback) |
| `base_url` | – | MCP endpoint override (default `https://api.anysearch.com/mcp`) |

\* one of `api_key_ref` / `api_key` is required. Without a key the provider
is `available() = false` and the seam skips it.

## Privacy

- The API key is resolved per operation via `ctx.credentials`; never
  logged, never written by the plugin.
- Only your search query and result count are sent to the AnySearch MCP
  gateway.

## Development

```bash
npm install
npm run typecheck
npm test          # result parsing, maxResults truncation, HTTP errors
npm run build
```

## License

MIT
