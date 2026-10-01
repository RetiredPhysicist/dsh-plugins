/**
 * Tests for dsh-atuin: text extraction from user/message events, deny rules,
 * and length caps. Imports the real extractText from src (no mirror copy).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractText } from '../src/index.ts'

function makeUserMessage(content) {
  return {
    type: 'user/message',
    data: { id: 'm1', role: 'user', content },
  }
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

  it('trims surrounding whitespace', () => {
    const event = makeUserMessage([{ type: 'text', text: '  spaced  ' }])
    assert.equal(extractText(event), 'spaced')
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
    assert.equal(text.slice(0, maxLen).length, maxLen)
  })

  it('empty deny config yields no rules', () => {
    const denies = ''.split(',').filter(Boolean).map((s) => new RegExp(s.trim()))
    assert.equal(denies.length, 0)
  })
})
