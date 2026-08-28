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
  isDeveloperQuery,
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
