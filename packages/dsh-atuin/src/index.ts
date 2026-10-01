// dsh-atuin-history — DeepSeek Harness (Cordis) plugin.
//
// Every user prompt typed into a DSH session is appended to the atuin
// shell-history daemon (`atuin history start` + `end`), so prompts you
// write in the web UI become searchable in atuin and appear in your shell
// integration (Ctrl-R etc.). dsh has no terminal UI; this is the
// atuin-history bridge for the interfaces it does have.
//
// Privacy: only the user's own typed prompts are recorded, never model
// replies, tool calls, or file contents. The atuin daemon stores entries
// locally in the user's atuin database (~/.local/share/atuin). A
// denylist (regex) can suppress prompts that must not be recorded.

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { spawn } from 'child_process'

export const name = 'atuin'

/**
 * Minimal self-contained shapes for the `session/event` → `user/message`
 * payload. Deliberately NOT imported from @deepseek-ai/dsh-session (its
 * dependency @deepseek-ai/dsh-type-meta is not yet published to npm at
 * rc stage); the fields used here are stable across the harness versions.
 */
interface SessionEventLike {
  readonly type: string
  readonly data?: {
    readonly content?: ReadonlyArray<{ readonly type?: string; readonly text?: unknown }>
  }
}
interface SessionLike {
  readonly title?: unknown
}

export interface Config {
  /** Path to the atuin binary (default: atuin on PATH). */
  atuin_bin?: string
  /** Comma-separated regexes; matching prompts are NOT recorded. */
  deny?: string
  /** Max prompt length recorded (long prompts truncated; default 2000). */
  max_len?: number
  /** Record only prompts in sessions whose title matches (comma regex). */
  session_match?: string
}

export const Config: z<Config> = z.object({
  atuin_bin: z.string().description('Path to the atuin binary (default: atuin on PATH)'),
  deny: z.string().description('Comma-separated regexes; matching prompts are not recorded'),
  max_len: z.number().description('Max prompt length recorded (default 2000)'),
  session_match: z.string().description('Comma-separated regexes; only sessions whose title matches are recorded'),
})

/** Extract the user's plain text from a user/message event's parts. */
export function extractText(event: SessionEventLike): string {
  const parts = Array.isArray(event?.data?.content) ? event.data.content : []
  return parts
    .filter((p) => typeof p === 'object' && p !== null && 'text' in p)
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim()
}

// dsh's `session/event` is a harness-level event, not a Cordis built-in one,
// so type it loosely instead of importing @deepseek-ai/dsh-session (its
// dsh-type-meta dep isn't published at rc stage).
type SessionEventHub = (event: string, listener: (session: SessionLike, event: SessionEventLike) => void) => unknown

export function apply(ctx: Context, config: Config): void {
  const atuinBin = config.atuin_bin ?? 'atuin'
  const maxLen = config.max_len ?? 2000
  const denyPatterns = (config.deny ?? '').split(',').filter(Boolean).map((s) => new RegExp(s.trim()))
  const sessionPatterns = (config.session_match ?? '').split(',').filter(Boolean).map((s) => new RegExp(s.trim()))

  const record = (text: string): void => {
    if (!text) return
    if (maxLen > 0 && text.length > maxLen) text = text.slice(0, maxLen)
    if (denyPatterns.some((re) => re.test(text))) return
    // atuin history start registers the command and prints an entry id;
    // history end finalizes it with exit code and timing (requires the id).
    // The daemon must be running (standard atuin setup).
    const start = spawn(atuinBin, ['history', 'start', '--', text])
    let id = ''
    start.stdout?.on('data', (d) => {
      id += String(d)
    })
    start.on('close', () => {
      const trimmed = id.trim()
      if (trimmed) {
        spawn(atuinBin, ['history', 'end', '--exit', '0', trimmed], { stdio: 'ignore' })
      }
    })
    start.on('error', () => {
      // atuin missing / daemon down: silently skip, never crash a session.
    })
  }

  const onEvent = (ctx as unknown as { on: SessionEventHub }).on
  onEvent('session/event', (session: SessionLike, event: SessionEventLike) => {
    if (event.type !== 'user/message') return
    const title = typeof session?.title === 'string' ? session.title : ''
    if (sessionPatterns.length > 0 && !sessionPatterns.some((re) => re.test(title))) return
    const text = extractText(event)
    if (text) record(text)
  })
}
