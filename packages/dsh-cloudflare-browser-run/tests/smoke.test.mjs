// Cordis runtime smoke test: mount each plugin's apply() into a real Cordis
// Context with minimal service stubs, and assert the tools/services register
// without throwing. This proves dsh (Cordis) spec compatibility beyond the
// pure unit tests.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { apply as applyBrowser, Config as BrowserConfig, inject, name } from '../src/index.ts'

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

describe('dsh-browser-run smoke', () => {
  it('declares every accessed service in inject', () => {
    // Real dsh boot fails with "cannot get property X without inject" when a
    // plugin touches ctx.X without declaring it — stub tests never catch this.
    assert.deepEqual(inject.sort(), ['systemPrompt', 'tools'])
    assert.equal(name, 'cloudflare-browser-run')
  })

  it('registers browse/screenshot/pdf/crawl tools', () => {
    const { ctx, registered } = makeCtx()
    applyBrowser(ctx, {
      cf_account_id: 'acc',
      cf_api_token: 'test-token',
    })
    const names = registered.map((t) => t.name).sort()
    assert.deepEqual(names, ['browse', 'crawl', 'crawl_status', 'pdf', 'screenshot'])
    // Config schema validates (Standard Schema protocol)
    const result = BrowserConfig['~standard'].validate({ cf_account_id: 'acc', cf_api_token: 't' })
    assert.equal(result.issues === undefined || result.issues.length === 0, true)
  })

  it('loads with no config (credentials surface on tool calls, not at boot)', () => {
    const { ctx, registered } = makeCtx()
    applyBrowser(ctx, {})
    assert.equal(registered.length, 5)
    const bare = BrowserConfig['~standard'].validate({})
    assert.equal(bare.issues === undefined || bare.issues.length === 0, true)
  })
})
