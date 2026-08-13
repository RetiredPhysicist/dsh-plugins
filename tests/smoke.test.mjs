/**
 * Smoke test: the WIP adapter mounts and streams a placeholder chunk set.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { apply as applyCodebuddy } from '../src/index.ts'

function makeCtx() {
  const ctx = new Context()
  const registered = []
  ctx.provide('llm', {
    registerAdapter(providers, adapter) {
      registered.push({ providers, adapter })
    },
  })
  ctx.provide('systemPrompt', { section() {} })
  return { ctx, registered }
}

describe('dsh-codebuddy smoke', () => {
  it('registers the adapter for the codebuddy route', () => {
    const { ctx, registered } = makeCtx()
    applyCodebuddy(ctx, {})
    assert.equal(registered.length, 1)
    assert.deepEqual(registered[0].providers, ['codebuddy'])
  })

  it('streams a WIP placeholder response', async () => {
    const { ctx, registered } = makeCtx()
    applyCodebuddy(ctx, {})
    const adapter = registered[0].adapter
    const chunks = []
    for await (const c of adapter.stream({
      provider: 'codebuddy',
      model: 'codebuddy',
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      chunks.push(c.type)
    }
    assert.deepEqual(chunks, ['block-start', 'text-delta', 'block-end', 'usage', 'finish'])
  })
})
