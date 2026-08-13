// @alex/dsh-codebuddy — DeepSeek Harness (Cordis) plugin.
//
// CodeBuddy (Tencent Agent SDK) as an LLM provider adapter registered into
// ctx.llm. Port of pi-codebuddy-sdk to the dsh LlmAdapter seam.
//
// STATUS: WIP skeleton — text-only single-turn streaming is wired; full
// multi-turn message translation, tool-call streaming, and on-device CLI
// verification land in the next iteration (see README "Status").

import { Context } from '@deepseek-ai/cordis'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'

export const name = 'codebuddy'
export const inject = ['llm']

export interface Config {
  /** Provider route advertised to the harness (default `codebuddy`). */
  provider?: string
  /** Default model id (default `codebuddy`). */
  model?: string
}

export const Config: z<Config> = z.object({
  provider: z.string().description('Provider route (default codebuddy)'),
  model: z.string().description('Default model id (default codebuddy)'),
})

/** Adapter contract summary for this plugin's generated system-prompt slot. */
const SYSTEM_PROMPT = `
- Provider \`codebuddy\`: CodeBuddy (Tencent Agent SDK) via the local \`codebuddy\` CLI.
- Models: \`codebuddy\` (the CLI's current default model).
`

/**
 * Text-only streaming adapter. The full port (multi-turn messages, tools,
 * usage, replay) replaces the body of `stream` in the next iteration.
 */
class CodeBuddyAdapter extends LlmAdapter {
  override providerInfo(provider: string) {
    return { id: provider, name: provider, description: 'CodeBuddy (Tencent Agent SDK) via local CLI' }
  }

  override async listModels(provider: string) {
    return [{ provider, id: 'codebuddy', name: 'codebuddy' }]
  }

  override async resolveModel(provider: string, model: string) {
    return { provider, id: model, name: model }
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // WIP: emit a single assistant text block echoing the last user message.
    // Real implementation: translate GenerateOptions.messages + tools into a
    // CodeBuddy query() call (same shape as pi-codebuddy-sdk) and translate
    // assistant events into StreamChunk blocks.
    const lastUser = [...options.messages].reverse().find((m) => m.role === 'user')
    const text = `[dsh-codebuddy] WIP adapter — received ${options.messages.length} message(s); ` +
      `model=${options.model}; last user content present: ${lastUser !== undefined}`
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

export function apply(ctx: Context, config: Config): void {
  const provider = config.provider ?? 'codebuddy'
  ctx.llm.registerAdapter([provider], new CodeBuddyAdapter())
  ;(ctx as any).systemPrompt?.section?.({ name: 'llm:codebuddy', order: 150, text: SYSTEM_PROMPT })
}
