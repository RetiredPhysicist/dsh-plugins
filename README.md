<p align="center">
  <img src="assets/readme/hero.svg" alt="dsh-cloudflare-browser-run — real browser access for DeepSeek Harness" width="100%">
</p>

# dsh-cloudflare-browser-run

A DeepSeek Harness plugin that gives the agent **real browser access**: headless Chrome on Cloudflare's network, so JS-rendered pages, screenshots, and PDFs all just work.

> Port of [pi-cloudflare-browser-run](https://github.com/RealAlexandreAI/pi-cloudflare-browser-run), built to the dsh (Cordis) plugin spec.

[English](README.md) · [中文](README.zh.md)

## Why

The built-in `web_fetch` is a plain HTTP fetch — JS pages come back empty and SSRF protection is deferred upstream. This plugin adds a real browser:

- clean **markdown** from any public page (SPA/JS included)
- **screenshots** (PNG) and **PDFs**
- login-capable sessions and WebMCP sites

## Quick start

```sh
dsh plugin --profile web add dsh-cloudflare-browser-run
```

Configure credentials in your profile/settings layer:

```yaml
- id: cloudflare-browser-run
  name: dsh-cloudflare-browser-run
  config:
    cf_api_token_ref: CF_API_TOKEN   # env var name — recommended
    cf_account_id: <your account id>
```

Token: Cloudflare dashboard → API Tokens → **Browser Rendering: Edit** template.
Account id: `dash.cloudflare.com/<ACCOUNT_ID>/...`.

## Tools

| tool | what it does |
|---|---|
| `browse` | fetch a public URL → clean markdown (default); `action` = `screenshot` \| `pdf` |
| `screenshot` | save the page as PNG locally, returns the file path |
| `pdf` | save the page as PDF locally, returns the file path |

## Config

| key | required | meaning |
|---|---|---|
| `cf_api_token_ref` | * | env-var name of the API token (resolved via `ctx.credentials`) |
| `cf_api_token` | * | direct token value (fallback) |
| `cf_account_id` | ✅ | your Cloudflare account id |
| `cf_api_base` | – | API base override |
| `output_dir` | – | where screenshots/PDFs land (default OS temp) |

\* one of the two token keys.

## Privacy

- **Public web only**: every URL passes an SSRF guard (localhost / private IPs / IPv6 literals / userinfo rejected) before the API is called.
- The token is resolved per operation via `ctx.credentials` — never logged, never stored by the plugin.
- Browser Run identifies itself as a well-behaved bot, the compliant way to fetch.

## Development

```bash
npm install
npm run typecheck
npm test          # SSRF guard / config / API shape
npm run build
```

Live API test (not part of `npm test`):

```bash
DSH_TEST_CF_TOKEN=<token> DSH_TEST_CF_ACCOUNT=<account> node --import tsx tests/real/real-cf.mjs
```

## License

MIT
