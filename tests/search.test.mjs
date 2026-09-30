/**
 * Tests for dsh-search: AnySearch result parsing and provider behavior.
 * Pure-node tests (no dsh runtime needed).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AnysearchProvider,
  FirecrawlDevProvider,
  FirecrawlSearchProvider,
  FIRECRAWL_SEARCH_URL,
  TINYFISH_FETCH_URL,
  TINYFISH_SEARCH_URL,
  TinyFishFetchProvider,
  TinyFishSearchProvider,
  isAcademicQuery,
  isDeveloperQuery,
  isNewsQuery,
} from '../src/index.ts'

const SAMPLE =
  '### 1. Example Domain\n- **URL**: https://example.com\nThis domain is for use in documentation examples.\n' +
  '\n### 2. Another Site\n- **URL**: https://example.org\nSome other snippet here.'

describe('AnysearchProvider', () => {
  it('parses markdown sections into sources', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ result: { content: [{ text: SAMPLE }] } }), { status: 200 })
    try {
      const p = new AnysearchProvider('key')
      assert.equal(p.available(), true)
      const r = await p.search({ query: 'example' })
      assert.equal(r.sources.length, 2)
      assert.equal(r.sources[0].title, 'Example Domain')
      assert.equal(r.sources[0].url, 'https://example.com')
      assert.match(r.sources[0].snippet, /documentation/)
      assert.equal(r.truncated, false)
    } finally {
      globalThis.fetch = orig
    }
  })

  it('honors maxResults and marks truncated', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ result: { content: [{ text: SAMPLE }] } }), { status: 200 })
    try {
      const p = new AnysearchProvider('key')
      const r = await p.search({ query: 'x', maxResults: 1 })
      assert.equal(r.sources.length, 1)
      assert.equal(r.truncated, true)
    } finally {
      globalThis.fetch = orig
    }
  })

  it('throws on HTTP errors', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () => new Response('{}', { status: 429 })
    try {
      const p = new AnysearchProvider('key')
      await assert.rejects(() => p.search({ query: 'x' }), /HTTP 429/)
    } finally {
      globalThis.fetch = orig
    }
  })

  it('is unavailable without a key', () => {
    // available() is a local check; a provider constructed with '' reports false.
    const p = new AnysearchProvider('')
    assert.equal(p.available(), false)
  })
})

describe('isDeveloperQuery', () => {
  it('matches developer-intent queries', () => {
    assert.equal(isDeveloperQuery('find a repo for incremental PDF parsing'), true)
    assert.equal(isDeveloperQuery('github issue retries not working'), true)
    assert.equal(isDeveloperQuery('how to fix pull request merge conflict'), true)
    assert.equal(isDeveloperQuery('readme skill for vite'), true)
  })

  it('does not match general queries', () => {
    assert.equal(isDeveloperQuery('TSLA stock price today'), false)
    assert.equal(isDeveloperQuery('best coffee in shenzhen'), false)
  })
})

describe('isNewsQuery / isAcademicQuery', () => {
  it('detects news intent', () => {
    assert.equal(isNewsQuery('latest AI news today'), true)
    assert.equal(isNewsQuery('what happened with the release'), true)
    assert.equal(isNewsQuery('best coffee in shenzhen'), false)
  })

  it('detects academic intent', () => {
    assert.equal(isAcademicQuery('arxiv paper on attention'), true)
    assert.equal(isAcademicQuery('doi research journal citation'), true)
    assert.equal(isAcademicQuery('best coffee in shenzhen'), false)
  })
})

describe('TinyFishSearchProvider', () => {
  it('sends X-API-Key and maps results with the publication date', async () => {
    const orig = globalThis.fetch
    let captured
    globalThis.fetch = async (url, init) => {
      captured = { url: String(url), init }
      return new Response(
        JSON.stringify({ results: [{ title: 'N', url: 'https://n.com', snippet: 's', date: '3 hours ago' }] }),
        { status: 200 },
      )
    }
    try {
      const p = new TinyFishSearchProvider('tf-test-not-real')
      assert.equal(p.available(), true)
      const r = await p.search({ query: 'ai agents' })
      assert.equal(captured.url.startsWith(TINYFISH_SEARCH_URL), true)
      assert.equal(captured.init.headers['X-API-Key'], 'tf-test-not-real')
      assert.equal(r.sources[0].title, 'N')
      assert.equal(r.sources[0].publishedAt, '3 hours ago')
    } finally {
      globalThis.fetch = orig
    }
  })

  it('sets domain_type=news for news queries', async () => {
    const orig = globalThis.fetch
    let url = ''
    globalThis.fetch = async (input) => {
      url = String(input)
      return new Response(JSON.stringify({ results: [] }), { status: 200 })
    }
    try {
      await new TinyFishSearchProvider('k').search({ query: 'latest breaking news' })
      assert.match(url, /domain_type=news/)
    } finally {
      globalThis.fetch = orig
    }
  })

  it('sets domain_type=research_paper for academic queries', async () => {
    const orig = globalThis.fetch
    let url = ''
    globalThis.fetch = async (input) => {
      url = String(input)
      return new Response(JSON.stringify({ results: [] }), { status: 200 })
    }
    try {
      await new TinyFishSearchProvider('k').search({ query: 'arxiv paper on rag' })
      assert.match(url, /domain_type=research_paper/)
    } finally {
      globalThis.fetch = orig
    }
  })

  it('throws on HTTP errors', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () => new Response('{}', { status: 401 })
    try {
      await assert.rejects(() => new TinyFishSearchProvider('bad').search({ query: 'x' }), /HTTP 401/)
    } finally {
      globalThis.fetch = orig
    }
  })
})

describe('TinyFishFetchProvider', () => {
  it('posts one URL and returns a text body', async () => {
    const orig = globalThis.fetch
    let captured
    globalThis.fetch = async (url, init) => {
      captured = { url: String(url), init }
      return new Response(
        JSON.stringify({ results: [{ url: 'https://a.com', final_url: 'https://a.com/', text: '# A' }], errors: [] }),
        { status: 200 },
      )
    }
    try {
      const p = new TinyFishFetchProvider('tf-test-not-real')
      const r = await p.fetch({ url: 'https://a.com' })
      assert.equal(captured.url, TINYFISH_FETCH_URL)
      assert.deepEqual(JSON.parse(captured.init.body).urls, ['https://a.com'])
      assert.equal(r.statusCode, 200)
      assert.equal(r.body.kind, 'text')
      assert.equal(r.body.content, '# A')
    } finally {
      globalThis.fetch = orig
    }
  })

  it('returns a non-2xx result on a per-URL failure', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ results: [], errors: [{ url: 'https://bad.com', error: 'invalid_url' }] }),
        { status: 200 },
      )
    try {
      const r = await new TinyFishFetchProvider('k').fetch({ url: 'https://bad.com' })
      assert.equal(r.statusCode, 502)
      assert.equal(r.body.content, 'invalid_url')
    } finally {
      globalThis.fetch = orig
    }
  })
})

describe('FirecrawlSearchProvider', () => {
  it('is available without a key and omits Authorization', async () => {
    const orig = globalThis.fetch
    let captured
    globalThis.fetch = async (url, init) => {
      captured = { url: String(url), init }
      return new Response(
        JSON.stringify({ data: [{ title: 'T', url: 'https://example.com', description: 'd' }] }),
        { status: 200 },
      )
    }
    try {
      const p = new FirecrawlSearchProvider()
      assert.equal(p.available(), true)
      const r = await p.search({ query: 'example' })
      assert.equal(captured.url, FIRECRAWL_SEARCH_URL)
      assert.equal(captured.init.method, 'POST')
      assert.equal(captured.init.headers.Authorization, undefined)
      assert.ok(!Object.keys(captured.init.headers).some((k) => k.toLowerCase() === 'authorization'))
      assert.equal(r.sources.length, 1)
      assert.equal(r.sources[0].title, 'T')
      assert.equal(r.sources[0].snippet, 'd')
    } finally {
      globalThis.fetch = orig
    }
  })

  it('sends Bearer when a Firecrawl key is provided', async () => {
    const orig = globalThis.fetch
    let captured
    globalThis.fetch = async (url, init) => {
      captured = { url: String(url), init }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    }
    try {
      const p = new FirecrawlSearchProvider('fc-test-not-real')
      await p.search({ query: 'example' })
      assert.equal(captured.url, FIRECRAWL_SEARCH_URL)
      assert.equal(captured.init.headers.Authorization, 'Bearer fc-test-not-real')
    } finally {
      globalThis.fetch = orig
    }
  })

  it('throws on HTTP errors', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () => new Response('{}', { status: 429 })
    try {
      const p = new FirecrawlSearchProvider()
      await assert.rejects(() => p.search({ query: 'x' }), /HTTP 429/)
    } finally {
      globalThis.fetch = orig
    }
  })
})

describe('FirecrawlDevProvider', () => {
  it('parses developer artifacts into sources', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 'issue:owner/repo#123', title: 'Bug: retries', url: 'https://github.com/owner/repo/issues/123', description: 'Fix' },
            { id: 'readme:owner/repo', url: 'https://github.com/owner/repo', passages: ['# repo', 'semantic'] },
          ],
        }),
        { status: 200 },
      )
    try {
      const p = new FirecrawlDevProvider('key')
      assert.equal(p.available(), true)
      const r = await p.search({ query: 'repo retries' })
      assert.equal(r.sources.length, 2)
      assert.equal(r.sources[0].title, 'Bug: retries')
      assert.equal(r.sources[1].snippet, '# repo semantic')
    } finally {
      globalThis.fetch = orig
    }
  })

  it('throws on HTTP errors', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () => new Response('{}', { status: 429 })
    try {
      const p = new FirecrawlDevProvider('key')
      await assert.rejects(() => p.search({ query: 'x' }), /HTTP 429/)
    } finally {
      globalThis.fetch = orig
    }
  })
})

const liveSkip = Boolean(
  process.env.FIRECRAWL_API_KEY || process.env.ANYSEARCH_API_KEY || process.env.FIRECRAWL_KEY,
)

describe('Firecrawl keyless live (optional)', () => {
  it('POSTs /v1/search without Authorization when no key is in env', { skip: liveSkip }, async () => {
    try {
      const p = new FirecrawlSearchProvider()
      const r = await p.search({ query: 'firecrawl', maxResults: 1 })
      assert.ok(Array.isArray(r.sources))
    } catch (err) {
      // optional: quota, auth, or network should not fail the suite
      const msg = String(err)
      if (/HTTP \d+|fetch|network|ECONN|ETIMEDOUT|ENOTFOUND/i.test(msg)) return
      throw err
    }
  })
})
