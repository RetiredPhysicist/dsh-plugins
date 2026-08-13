<p align="center">
  <img src="assets/readme/hero.svg" alt="dsh-atuin — record every dsh prompt into your atuin history" width="100%">
</p>

# dsh-atuin

Record every prompt you type into DeepSeek Harness into your **atuin** shell history — searchable with `atuin search` and your shell integration (Ctrl-R).

> Port of [pi-atuin](https://github.com/RealAlexandreAI/pi-atuin). dsh has no terminal UI; this is its atuin bridge.

[English](README.md) · [中文](README.zh.md)

## How it works

The plugin listens to `session/event` → `user/message` and runs:

```
atuin history start -- "<prompt>"
atuin history end --exit 0 <ID>
```

**Only your own typed prompts are recorded** — never replies, tool calls, or file contents.

## Quick start

```sh
dsh plugin add dsh-atuin
```

Requires a running atuin daemon (standard atuin setup). A missing `atuin` or stopped daemon is silently skipped — sessions never break.

## Config

```yaml
- id: atuin-history
  name: dsh-atuin
  config:
    # atuin_bin: /opt/homebrew/bin/atuin
    # deny: "^/clear$,password"
    # max_len: 2000
    # session_match: "project-x"
```

| key | meaning |
|---|---|
| `atuin_bin` | path to the atuin binary (default `atuin` on PATH) |
| `deny` | comma-separated regexes; matching prompts are **not** recorded |
| `max_len` | truncate long prompts (default 2000; `0` off) |
| `session_match` | comma-separated regexes; only matching session titles are recorded (empty = all) |

## Privacy

- Only your typed prompts; replies, tool calls, and file contents are never recorded.
- `deny` suppresses sensitive prompts.
- Entries live in your local atuin DB (`~/.local/share/atuin/history.db`) — nothing leaves the machine.

## Development

```bash
npm install
npm run typecheck
npm test          # text extraction / deny rules / truncation
npm run build
```

Live test against your real atuin DB (needs the daemon):

```bash
node --import tsx tests/real/real-atuin.mjs
```

## License

MIT
