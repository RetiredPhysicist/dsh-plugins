/**
 * Unit tests for the providers layer: mime guessing, gemini request shape,
 * and agy argument construction. No network, no real agy.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { agyArgs, guessMimeType, runProvider } from '../src/providers.ts'

// `runProvider` spawns `agy` from PATH, so a machine that has agy installed
// would run the real CLI here and block until the 150s kill timer. Clearing
// PATH makes the ENOENT branch deterministic on every machine.
async function withoutPath(fn) {
  const saved = process.env.PATH
  process.env.PATH = ''
  try {
    return await fn()
  } finally {
    process.env.PATH = saved
  }
}

describe('guessMimeType', () => {
  it('maps common extensions', () => {
    assert.equal(guessMimeType('a.png'), 'image/png')
    assert.equal(guessMimeType('a.JPG'), 'image/jpeg')
    assert.equal(guessMimeType('clip.mp4'), 'video/mp4')
    assert.equal(guessMimeType('voice.m4a'), 'audio/mp4')
    assert.equal(guessMimeType('doc.pdf'), 'application/pdf')
    assert.equal(guessMimeType('https://x.com/a.webp?q=1'), 'image/webp')
  })

  it('falls back to octet-stream', () => {
    assert.equal(guessMimeType('noext'), 'application/octet-stream')
  })
})

describe('agyArgs', () => {
  it('includes -p prompt and skip-permissions by default', () => {
    assert.deepEqual(agyArgs({ provider: 'antigravity_cli' }, 'hello'), [
      '-p', 'hello', '--dangerously-skip-permissions',
    ])
  })

  it('omits skip-permissions when disabled', () => {
    assert.deepEqual(agyArgs({ provider: 'antigravity_cli', skipPermissions: false }, 'hi'), ['-p', 'hi'])
  })
})

describe('runProvider — gemini_api without key', () => {
  it('returns a setup hint, not a crash', async () => {
    const r = await runProvider({ provider: 'gemini_api' }, 'understand', { source: '/tmp/x.png', question: 'q' })
    assert.equal(r.ok, false)
    assert.match(r.error ?? '', /api_key is required|needs api_key/)
  })
})

describe('runProvider — default provider (no config)', () => {
  it('falls back to antigravity_cli rather than demanding an api_key', async () => {
    const r = await withoutPath(() =>
      runProvider({}, 'understand', { source: '/tmp/x.png', question: 'q' }),
    )
    assert.equal(r.ok, false)
    assert.match(r.error ?? '', /agy not found on PATH/)
  })
})

describe('runProvider — antigravity_cli without agy on PATH', () => {
  it('returns a friendly error when agy is missing', async () => {
    const r = await withoutPath(() =>
      runProvider(
        { provider: 'antigravity_cli', skipPermissions: false },
        'understand',
        { source: '/tmp/nonexistent-xyz.png', question: 'q' },
      ),
    )
    assert.equal(r.ok, false)
    assert.match(r.error ?? '', /agy not found on PATH/)
  })
})
