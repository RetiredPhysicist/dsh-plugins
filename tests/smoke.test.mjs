// Cordis runtime smoke test: registers the AnySearch provider into ctx.web.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { apply as applySearch, FIRECRAWL_SEARCH_URL } from '../src/index.ts'

const SAMPLE =
  '### 1. Example Domain\n- **URL**: https://example.com\nThis domain is for use in documentation examples.\n'

const FIRECRAWL_SAMPLE = {
  data: [{ title: 'Firecrawl', url: 'https://www.firecrawl.dev/', description: 'web data API' }],
}

function makeCtx() {
  const ctx = new Context()
  const registered = []
  ctx.provide('web', {
    registerSearchProvider(p) {
      registered.push(p)
    },
  })
  return { ctx, registered }
}

function mockFetch(handler) {
  const orig = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return handler(url, init)
  }
  return {
    calls,
    restore() {
      globalThis.fetch = orig
    },
  }
}

describe('dsh-search smoke', () => {
  it('registers the anysearch provider', () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, { api_key: 'test-key' })
    assert.equal(registered.length, 1)
    assert.equal(registered[0].id, 'anysearch')
    assert.equal(registered[0].available(), true)
  })

  it('stays available without an AnySearch key (Firecrawl keyless)', () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, {})
    assert.equal(registered.length, 1)
    assert.equal(registered[0].id, 'anysearch')
    assert.equal(registered[0].available(), true)
  })
})

describe('wrapper routing', () => {
  it('no AnySearch key → Firecrawl /v1/search with no Authorization', async () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, {})
    const mock = mockFetch(
      async () => new Response(JSON.stringify(FIRECRAWL_SAMPLE), { status: 200 }),
    )
    try {
      const r = await registered[0].search({ query: 'best coffee in shenzhen' })
      assert.equal(mock.calls.length, 1)
      assert.equal(mock.calls[0].url, FIRECRAWL_SEARCH_URL)
      assert.equal(mock.calls[0].init.method, 'POST')
      const headers = mock.calls[0].init.headers
      assert.equal(headers.Authorization, undefined)
      assert.ok(!Object.keys(headers).some((k) => k.toLowerCase() === 'authorization'))
      assert.equal(r.sources.length, 1)
      assert.equal(r.sources[0].url, 'https://www.firecrawl.dev/')
    } finally {
      mock.restore()
    }
  })

  it('firecrawl_api_key without AnySearch key → Bearer on Firecrawl', async () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, { firecrawl_api_key: 'fc-test-not-real' })
    const mock = mockFetch(
      async () => new Response(JSON.stringify(FIRECRAWL_SAMPLE), { status: 200 }),
    )
    try {
      await registered[0].search({ query: 'best coffee in shenzhen' })
      assert.equal(mock.calls.length, 1)
      assert.equal(mock.calls[0].url, FIRECRAWL_SEARCH_URL)
      assert.equal(mock.calls[0].init.headers.Authorization, 'Bearer fc-test-not-real')
    } finally {
      mock.restore()
    }
  })

  it('with AnySearch key, a normal query hits the AnySearch gateway not Firecrawl', async () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, { api_key: 'anysearch-test-not-real', firecrawl_api_key: 'fc-test-not-real' })
    const mock = mockFetch(async (url) => {
      const u = String(url)
      if (u.includes('firecrawl')) {
        return new Response(JSON.stringify(FIRECRAWL_SAMPLE), { status: 200 })
      }
      return new Response(JSON.stringify({ result: { content: [{ text: SAMPLE }] } }), { status: 200 })
    })
    try {
      const r = await registered[0].search({ query: 'best coffee in shenzhen' })
      assert.equal(mock.calls.length, 1)
      assert.match(mock.calls[0].url, /anysearch\.com/)
      assert.ok(!mock.calls[0].url.includes('firecrawl'))
      assert.equal(mock.calls[0].init.headers.Authorization, 'Bearer anysearch-test-not-real')
      assert.equal(r.sources[0].title, 'Example Domain')
    } finally {
      mock.restore()
    }
  })
})
