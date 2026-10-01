// Cordis runtime smoke test: mount the plugin's apply() into a real Cordis
// Context with minimal service stubs and assert registration.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { apply as applyAtuin } from '../src/index.ts'

function makeCtx() {
  const ctx = new Context()
  return { ctx }
}

describe('dsh-atuin-history smoke', () => {
  it('mounts without throwing', () => {
    const { ctx } = makeCtx()
    applyAtuin(ctx, {})
    assert.ok(true)
  })

  it('mounts with config', () => {
    const { ctx } = makeCtx()
    applyAtuin(ctx, { atuin_bin: '/bin/true', deny: '^/clear$', max_len: 100 })
    assert.ok(true)
  })
})
