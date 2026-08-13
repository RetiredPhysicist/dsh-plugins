# @alex/dsh-codebuddy-sdk

DeepSeek Harness plugin: **CodeBuddy (Tencent Agent SDK) as an LLM provider
adapter** registered into `ctx.llm`.

Port of [pi-codebuddy-sdk](https://github.com/RealAlexandreAI/pi-codebuddy-sdk)
to the dsh `LlmAdapter` seam.

## Status — WIP

> **This is a skeleton.** The adapter mounts and streams a placeholder
> response so the plugin loads cleanly, but the real integration is not
> wired yet:
>
> - ❌ multi-turn message translation (`GenerateOptions.messages` →
>   CodeBuddy)
> - ❌ tool-call streaming (dsh `StreamChunk` tool blocks)
> - ❌ on-device verification against the local `codebuddy` CLI
>
> The full port (query() invocation, assistant-event → StreamChunk
> translation — mirroring `dsh-llm-pi-ai`'s stream adapter) is the next
> iteration. Track it at
> [RealAlexandreAI/dsh-codebuddy-sdk#issues](https://github.com/RealAlexandreAI/dsh-codebuddy-sdk).

## Install

```sh
dsh plugin add @alex/dsh-codebuddy-sdk
```

Requires the `codebuddy` CLI on `PATH` (same requirement as
pi-codebuddy-sdk).

## Configuration

```yaml
- id: codebuddy
  name: '@alex/dsh-codebuddy-sdk'
  config:
    provider: codebuddy   # provider route (default codebuddy)
    model: codebuddy      # default model id (default codebuddy)
```

## Privacy

- The plugin talks to the local `codebuddy` CLI only; no extra network hop
  beyond what CodeBuddy itself uses.
- No credentials are read or stored by this plugin (CLI auth is reused).

## Development

```bash
npm install
npm run typecheck
npm test          # mount + placeholder stream smoke
npm run build
```

## License

MIT
