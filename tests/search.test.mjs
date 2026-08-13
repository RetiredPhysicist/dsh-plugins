/**
 * Tests for dsh-search: AnySearch result parsing and provider behavior.
 * Pure-node tests (no dsh runtime needed).
 */
import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnysearchProvider } from '../src/index.ts'

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
