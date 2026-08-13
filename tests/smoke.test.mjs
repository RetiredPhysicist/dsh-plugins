// Cordis runtime smoke test: mount each plugin's apply() into a real Cordis
// Context with minimal service stubs, and assert the tools/services register
// without throwing. This proves dsh (Cordis) spec compatibility beyond the
// pure unit tests.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { apply as applyBrowser, Config as BrowserConfig } from '../src/index.ts'

function makeCtx() {
  const ctx = new Context()
  const registered = []
  ctx.provide('tools', {
    register(tool) {
      registered.push(tool)
    },
  })
  ctx.provide('credentials', {
    async resolve(ref) {
      assert.equal(ref, 'CF_API_TOKEN')
      return { value: 'test-token', source: 'env' }
    },
  })
  ctx.provide('systemPrompt', { section() {} })
  return { ctx, registered }
}

describe('dsh-browser-run smoke', () => {
  it('registers browse/screenshot/pdf tools', () => {
    const { ctx, registered } = makeCtx()
    applyBrowser(ctx, {
      cf_account_id: 'acc',
      cf_api_token_ref: 'CF_API_TOKEN',
    })
    const names = registered.map((t) => t.name).sort()
    assert.deepEqual(names, ['browse', 'pdf', 'screenshot'])
    // Config schema validates (Standard Schema protocol)
    const result = BrowserConfig['~standard'].validate({ cf_account_id: 'acc' })
    assert.equal(result.issues === undefined || result.issues.length === 0, true)
  })
})
