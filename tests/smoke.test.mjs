// Cordis runtime smoke test: registers the AnySearch provider into ctx.web.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { apply as applySearch } from '../src/index.ts'

function makeCtx() {
  const ctx = new Context()
  const registered = []
  ctx.provide('web', {
    registerSearchProvider(p) {
      registered.push(p)
    },
  })
  ctx.provide('credentials', {
    async resolve(ref) {
      assert.equal(ref, 'ANYSEARCH_API_KEY')
      return { value: 'test-key', source: 'env' }
    },
  })
  return { ctx, registered }
}

describe('dsh-search smoke', () => {
  it('registers the anysearch provider', () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, { api_key_ref: 'ANYSEARCH_API_KEY' })
    assert.equal(registered.length, 1)
    assert.equal(registered[0].id, 'anysearch')
    assert.equal(registered[0].available(), true)
  })

  it('provider reports unavailable without a key', () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, {})
    assert.equal(registered[0].available(), false)
  })
})
