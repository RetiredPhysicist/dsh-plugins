# dsh-plugins

RetiredPhysicist monorepo for DeepSeek Harness extensions.

Each package keeps its own npm name, version, and release cadence:

| package | npm |
| --- | --- |
| `dsh-all-search` | `npm:dsh-all-search` |
| `dsh-atuin` | `npm:dsh-atuin` |
| `dsh-cloudflare-browser-run` | `npm:dsh-cloudflare-browser-run` |
| `dsh-codebuddy-sdk` | private, not published |
| `dsh-dejavu-memory` | `npm:dsh-dejavu-memory` |
| `dsh-gemini-multimodal` | `npm:dsh-gemini-multimodal` |

Release a published package by pushing a tag named `<package>-v<version>`, for
example `dsh-all-search-v0.2.11`. The publish workflow builds and publishes only
that package.
