# @alex/dsh-browser-run

DeepSeek Harness plugin: **web browsing tools** backed by
[Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/) —
headless Chrome on CF's network. Pages render with a real browser, so
JS-heavy/SPA sites work, and requests come from Cloudflare's network.

Port of [pi-cloudflare-browser-run](https://github.com/RealAlexandreAI/pi-cloudflare-browser-run)
to the dsh (Cordis) plugin model.

## Why

dsh's built-in `web_fetch` is a plain HTTP fetch (JS pages return empty;
SSRF protection is deferred upstream). This plugin adds a real browser:
clean markdown, screenshots (PNG), PDFs, login-capable sessions and
WebMCP-enabled sites.

## Tools

| tool | what it does |
|---|---|
| `browse` | fetch a public URL, return clean **markdown** (default; `action` = `screenshot` \| `pdf`) |
| `screenshot` | save a PNG locally, returns the file path |
| `pdf` | save a PDF locally, returns the file path |

## Install

```sh
dsh plugin add @alex/dsh-browser-run
# or, from a cordis.yml composition:
#   - id: browser-run
#     name: '@alex/dsh-browser-run'
#     config: { ... }
```

## Configuration

Credentials are configured on the plugin row (profile/settings layer):

```yaml
- id: browser-run
  name: '@alex/dsh-browser-run'
  config:
    cf_api_token_ref: CF_API_TOKEN   # env var name — recommended
    cf_account_id: <your account id>
    # cf_api_token: <direct value>   # fallback when no ref is set
    # output_dir: /tmp/dsh-browser-run
```

| key | required | meaning |
|---|---|---|
| `cf_api_token_ref` | * | env-var name of the Cloudflare API token (resolved via `ctx.credentials`, value never stored in config) |
| `cf_api_token` | * | direct token value (fallback) |
| `cf_account_id` | ✅ | your Cloudflare account id |
| `cf_api_base` | – | API base override (default `https://api.cloudflare.com/client/v4`) |
| `output_dir` | – | where screenshots/PDFs land (default OS temp dir) |

\* one of `cf_api_token_ref` / `cf_api_token` is required.

### Create the token

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token** →
   template **"Browser Rendering: Edit"**
2. Account id: `dash.cloudflare.com/<ACCOUNT_ID>/...`
3. Export the env var (`CF_API_TOKEN=...`) or pass the value directly.

### Verify

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/browser-rendering/markdown" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Privacy

- **Public web only**: every URL passes an SSRF guard before the API is
  called — non-http(s) protocols, localhost, private/reserved IPs, IPv6
  literals, userinfo, and oversized URLs are rejected.
- The API token is resolved per operation via `ctx.credentials`; it is
  never logged and never written by the plugin.
- Browser Run identifies its traffic as a well-behaved bot, which is the
  compliant way to scrape.

## Development

```bash
npm install
npm run typecheck
npm test          # SSRF guard, config resolution, API call shape
npm run build     # emits dist/ for the bundle
```

## License

MIT
