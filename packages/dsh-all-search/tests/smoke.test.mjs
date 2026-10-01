// Cordis runtime smoke test: registers the AnySearch provider into ctx.web.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import {
  apply as applySearch,
  FIRECRAWL_SEARCH_URL,
  TINYFISH_SEARCH_URL,
} from '../src/index.ts'

const SAMPLE =
  '### 1. Example Domain\n- **URL**: https://example.com\nThis domain is for use in documentation examples.\n'

const FIRECRAWL_SAMPLE = {
  data: [{ title: 'Firecrawl', url: 'https://www.firecrawl.dev/', description: 'web data API' }],
}

function makeCtx() {
  const ctx = new Context()
  const registered = []
  const fetchRegistered = []
  ctx.provide('web', {
    registerSearchProvider(p) {
      registered.push(p)
    },
    registerFetchProvider(p) {
      fetchRegistered.push(p)
    },
  })
  return { ctx, registered, fetchRegistered }
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
  it('news query with a TinyFish key → TinyFish domain_type=news', async () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, { api_key: 'anysearch-test-not-real', tinyfish_api_key: 'tf-test-not-real' })
    const mock = mockFetch(async (url) => {
      if (String(url).includes('tinyfish')) {
        return new Response(
          JSON.stringify({ results: [{ title: 'N', url: 'https://n.com', snippet: 's', date: '3 hours ago' }] }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ result: { content: [{ text: SAMPLE }] } }), { status: 200 })
    })
    try {
      const r = await registered[0].search({ query: 'latest ai agents news' })
      assert.equal(mock.calls.length, 1)
      assert.match(mock.calls[0].url, /api\.search\.tinyfish\.ai/)
      assert.match(mock.calls[0].url, /domain_type=news/)
      assert.equal(r.sources[0].title, 'N')
    } finally {
      mock.restore()
    }
  })

  it('academic query with a TinyFish key → domain_type=research_paper', async () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, { tinyfish_api_key: 'tf-test-not-real' })
    const mock = mockFetch(async () =>
      new Response(JSON.stringify({ results: [{ title: 'P', url: 'https://p.com', snippet: 's' }] }), {
        status: 200,
      }),
    )
    try {
      await registered[0].search({ query: 'arxiv paper on retrieval augmented generation' })
      assert.match(mock.calls[0].url, /domain_type=research_paper/)
    } finally {
      mock.restore()
    }
  })

  it('TinyFish key without AnySearch key → general query uses TinyFish', async () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, { tinyfish_api_key: 'tf-test-not-real' })
    assert.equal(registered[0].available(), true)
    const mock = mockFetch(async () =>
      new Response(JSON.stringify({ results: [{ title: 'T', url: 'https://t.com', snippet: 's' }] }), {
        status: 200,
      }),
    )
    try {
      const r = await registered[0].search({ query: 'best coffee in shenzhen' })
      assert.match(mock.calls[0].url, /api\.search\.tinyfish\.ai/)
      assert.equal(r.sources[0].title, 'T')
    } finally {
      mock.restore()
    }
  })

  it('falls back to Firecrawl when TinyFish returns nothing', async () => {
    const { ctx, registered } = makeCtx()
    applySearch(ctx, { tinyfish_api_key: 'tf-test-not-real' })
    const mock = mockFetch(async (url) => {
      if (String(url).includes('tinyfish')) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 })
      }
      return new Response(JSON.stringify(FIRECRAWL_SAMPLE), { status: 200 })
    })
    try {
      const r = await registered[0].search({ query: 'best coffee in shenzhen' })
      assert.equal(mock.calls.length, 2)
      assert.equal(r.sources[0].title, 'Firecrawl')
    } finally {
      mock.restore()
    }
  })

  it('does not register a fetch provider unless tinyfish_fetch is set', () => {
    const { ctx, fetchRegistered } = makeCtx()
    applySearch(ctx, { tinyfish_api_key: 'tf-test-not-real' })
    assert.equal(fetchRegistered.length, 0)
  })

  it('registers the TinyFish fetch provider when tinyfish_fetch is set', () => {
    const { ctx, fetchRegistered } = makeCtx()
    applySearch(ctx, { tinyfish_api_key: 'tf-test-not-real', tinyfish_fetch: true })
    assert.equal(fetchRegistered.length, 1)
    assert.equal(fetchRegistered[0].id, 'tinyfish')
    assert.equal(fetchRegistered[0].available(), true)
  })

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
