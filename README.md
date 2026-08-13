<p align="center">
  <img src="assets/readme/hero.svg" alt="dsh-all-search — AnySearch web search for DeepSeek Harness" width="100%">
</p>

# dsh-all-search

Adds an **AnySearch** web-search provider to DeepSeek Harness, registered into `ctx.web`. AnySearch is a single MCP gateway that aggregates exa / tavily / firecrawl / context7 behind **one API key**.

> Port of [pi-all-search](https://github.com/RealAlexandreAI/pi-all-search).

[English](README.md) · [中文](README.zh.md)

## Why

dsh ships Exa / Perplexity / DeepSeek search. This plugin adds AnySearch: one key, many backends, no per-backend credentials.

## Quick start

```sh
dsh plugin --profile web add dsh-all-search
```

The provider registers as `anysearch` on `ctx.web` — the built-in `web_search` tool picks it up alongside the stock providers.

```yaml
- id: all-search
  name: dsh-all-search
  config:
    api_key: <your anysearch key>
```

| key | required | meaning |
|---|---|---|
| `api_key` | ✅ | your AnySearch key |
| `base_url` | – | MCP endpoint override |

Without a key the provider reports `available() = false` and the seam skips it.

## Privacy

- The key lives only in your config file — never logged.
- Only your query and result count go to the AnySearch gateway.

## Development

```bash
npm install
npm run typecheck
npm test          # result parsing / maxResults / HTTP errors
npm run build
```

Live search test:

```bash
node --import tsx tests/real/real-search.mjs
```

## License

MIT
