// Cordis runtime smoke test: registers the DejaVu tools.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { apply as applyMemory } from '../src/index.ts'

function makeCtx() {
  const ctx = new Context()
  const registered = []
  ctx.provide('tools', {
    register(tool) {
      registered.push(tool)
    },
  })
  ctx.provide('systemPrompt', { section() {} })
  return { ctx, registered }
}

describe('dsh-memory smoke', () => {
  it('registers the 6 dejavu tools', () => {
    const { ctx, registered } = makeCtx()
    applyMemory(ctx, { mcp_url: 'http://localhost:9999/mcp', mcp_auth: 'x' })
    const names = registered.map((t) => t.name).sort()
    assert.deepEqual(names, [
      'dejavu_boot',
      'dejavu_create',
      'dejavu_delete',
      'dejavu_read',
      'dejavu_search',
      'dejavu_update',
    ])
  })

  it('loads with no config (mcp_url missing surfaces on tool calls, not at boot)', () => {
    const { ctx, registered } = makeCtx()
    applyMemory(ctx, {})
    assert.equal(registered.length, 6)
  })
})
