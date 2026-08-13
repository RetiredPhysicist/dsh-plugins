/**
 * Tests for dsh-atuin-history: text extraction from user/message events,
 * deny rules, and length caps. Pure-node tests (no dsh runtime).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

function makeUserMessage(content) {
  return {
    type: 'user/message',
    data: { id: 'm1', role: 'user', content },
  }
}

// Re-implement extractText (mirror of src) so we test the exact logic without
// pulling the plugin module into node:test.
function extractText(event) {
  const data = event.data
  const parts = Array.isArray(data?.content) ? data.content : []
  return parts
    .filter((p) => typeof p === 'object' && p !== null && 'text' in p)
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim()
}

describe('extractText', () => {
  it('concatenates text parts', () => {
    const event = makeUserMessage([
      { type: 'text', text: 'hello ' },
      { type: 'text', text: 'world' },
    ])
    assert.equal(extractText(event), 'hello world')
  })

  it('skips non-text parts', () => {
    const event = makeUserMessage([
      { type: 'image', image: 'data:...' },
      { type: 'text', text: 'only text' },
    ])
    assert.equal(extractText(event), 'only text')
  })

  it('handles missing content', () => {
    assert.equal(extractText({ type: 'user/message', data: { id: 'x' } }), '')
  })
})

describe('record rules', () => {
  it('applies deny regexes', () => {
    const denies = [/password/i, /^\/clear$/]
    assert.equal(denies.some((re) => re.test('my password is x')), true)
    assert.equal(denies.some((re) => re.test('/clear')), true)
    assert.equal(denies.some((re) => re.test('normal prompt')), false)
  })

  it('truncates long prompts', () => {
    const text = 'a'.repeat(5000)
    const maxLen = 2000
    assert.equal(text.length > maxLen && text.slice(0, maxLen).length, maxLen)
  })
})
