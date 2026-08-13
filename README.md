# @alex/dsh-atuin

DeepSeek Harness plugin: every prompt you type into a DSH session (web UI
included) is appended to your **atuin** shell history, so it shows up in
`atuin search` and your shell integration (Ctrl-R, etc.).

dsh has no terminal UI; this is the atuin bridge for the interfaces it
does have.

## How it works

The plugin listens to `session/event` → `user/message`. For every user
prompt it runs:

```
atuin history start -- "<prompt>"
atuin history end
```

against your local atuin daemon. Model replies, tool calls, and file
contents are never recorded — only your own typed prompts.

## Install

```sh
dsh plugin add @alex/dsh-atuin
```

Requires a running atuin daemon (standard atuin shell integration sets
this up). Missing `atuin` or a stopped daemon is silently skipped — the
plugin never crashes a session.

## Configuration

```yaml
- id: atuin-history
  name: '@alex/dsh-atuin'
  config:
    # atuin_bin: /opt/homebrew/bin/atuin   # default: atuin on PATH
    # deny: "^/clear$,password"             # comma-separated regexes, not recorded
    # max_len: 2000                         # truncate long prompts
    # session_match: "project-x,deep-dive"  # only sessions whose title matches
```

| key | meaning |
|---|---|
| `atuin_bin` | path to the atuin binary (default `atuin` on PATH) |
| `deny` | comma-separated regexes; matching prompts are NOT recorded (e.g. secrets, slash commands) |
| `max_len` | prompt truncation length (default 2000; `0` disables) |
| `session_match` | comma-separated regexes; only sessions whose title matches are recorded (empty = all) |

## Privacy

- Only your own typed prompts are recorded; never replies, tool calls, or
  file contents.
- `deny` lets you suppress prompts that must not be logged.
- Entries live in your local atuin database
  (`~/.local/share/atuin/history.db`), same as shell commands.
- Nothing is sent anywhere — atuin history `start`/`end` is a local
  daemon call.

## Real integration

Optional end-to-end tests that hit live services (not part of `npm test`):

```bash
# dsh-cloudflare-browser-run: real Cloudflare Browser Run API
DSH_TEST_CF_TOKEN=<token> DSH_TEST_CF_ACCOUNT=<account> node --import tsx tests/real/real-cf.mjs

# dsh-atuin: record into your real atuin database (daemon must run)
node --import tsx tests/real/real-atuin.mjs

# dsh-all-search: real AnySearch query
ANYSEARCH_API_KEY=<key> node --import tsx tests/real/real-search.mjs

# dsh-nocturne-memory: real Nocturne MCP server (reuses your pi config)
node --import tsx tests/real/real-mcp.mjs
```

## Development

```bash
npm install
npm run typecheck
npm test          # text extraction, deny rules, length caps
npm run build
```

## License

MIT
