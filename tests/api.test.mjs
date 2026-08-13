/**
 * Unit tests for the Browser Run client: URL guard, config resolution, and
 * API call shape. Pure-node tests (no dsh runtime needed).
 */
import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { assertSafeUrl, browserRunAction, resolveConfig } from '../src/api.ts'

describe('assertSafeUrl', () => {
  it('accepts public http(s) URLs', () => {
    assert.equal(assertSafeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1')
    assert.equal(assertSafeUrl('http://example.com'), 'http://example.com/')
  })

  it('rejects non-http(s) protocols', () => {
    assert.throws(() => assertSafeUrl('file:///etc/passwd'), /only http\/https/)
    assert.throws(() => assertSafeUrl('ftp://example.com'), /only http\/https/)
  })

  it('rejects localhost and private IPs', () => {
    assert.throws(() => assertSafeUrl('http://localhost:8787/x'), /localhost/)
    assert.throws(() => assertSafeUrl('http://127.0.0.1/x'), /private\/reserved/)
    assert.throws(() => assertSafeUrl('http://10.0.0.1/x'), /private\/reserved/)
    assert.throws(() => assertSafeUrl('http://192.168.1.1/x'), /private\/reserved/)
    assert.throws(() => assertSafeUrl('http://169.254.169.254/latest/meta-data'), /private\/reserved/)
    assert.throws(() => assertSafeUrl('http://[::1]/x'), /IPv6 literal/)
    assert.throws(() => assertSafeUrl('http://myhost.local/x'), /local hostnames/)
  })

  it('rejects userinfo and oversized URLs', () => {
    assert.throws(() => assertSafeUrl('https://user:pass@example.com'), /userinfo/)
    assert.throws(() => assertSafeUrl(`https://example.com/${'a'.repeat(3000)}`), /too long/)
  })
})

describe('resolveConfig', () => {
  it('accepts token + account', () => {
    const c = resolveConfig({ cf_api_token: 't', cf_account_id: 'acc' })
    assert.equal('apiToken' in c && c.apiToken, 't')
  })

  it('reports missing token', () => {
    const c = resolveConfig({ cf_account_id: 'acc' })
    assert.equal('error' in c, true)
    assert.match((c).error, /cf_api_token/)
  })

  it('reports missing account id', () => {
    const c = resolveConfig({ cf_api_token: 't' })
    assert.equal('error' in c, true)
    assert.match((c).error, /cf_account_id/)
  })
})

describe('browserRunAction', () => {
  const cfg = { apiToken: 't', accountId: 'acc' }
  const orig = globalThis.fetch

  after(() => {
    globalThis.fetch = orig
  })

  it('posts to the right endpoint and parses markdown', async () => {
    const calls = []
    globalThis.fetch = async (url, init) => {
      calls.push([String(url), init?.body])
      return new Response('**hello**', { status: 200 })
    }
    const r = await browserRunAction(cfg, 'markdown', 'https://example.com')
    assert.equal(r.ok, true)
    assert.equal(r.content, '**hello**')
    assert.match(calls[0][0], /\/accounts\/acc\/browser-rendering\/markdown$/)
    assert.match(JSON.parse(calls[0][1]).url, /example\.com/)
  })

  it('rejects private URLs before hitting the API', async () => {
    let called = false
    globalThis.fetch = async () => {
      called = true
      return new Response()
    }
    const r = await browserRunAction(cfg, 'markdown', 'http://127.0.0.1/x')
    assert.equal(r.ok, false)
    assert.equal(called, false)
  })

  it('surfaces API errors', async () => {
    globalThis.fetch = async () => new Response('{"errors":[{"message":"nope"}]}', { status: 403 })
    const r = await browserRunAction(cfg, 'screenshot', 'https://example.com')
    assert.equal(r.ok, false)
    assert.match(r.error, /HTTP 403/)
  })

  it('passes an abort timeout signal so a hung API call cannot stall forever', async () => {
    let signal
    globalThis.fetch = async (_url, init) => {
      signal = init?.signal
      return new Response('ok', { status: 200 })
    }
    await browserRunAction(cfg, 'markdown', 'https://example.com')
    assert.ok(signal instanceof AbortSignal)
    assert.equal(signal.aborted, false)
  })
})
