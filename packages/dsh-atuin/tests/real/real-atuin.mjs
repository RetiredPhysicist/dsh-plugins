// Real integration: dsh-atuin — simulate a user/message event through the
// cordis-mounted plugin and verify the prompt lands in the atuin database.
import { Context } from '@deepseek-ai/cordis'
import { apply } from '../../src/index.ts'

const ctx = new Context()
apply(ctx, {})

const marker = `dsh-atuin-e2e-${Date.now()}`
// Emit the same event shape the harness sends (user/message with text parts).
;(ctx).emit('session/event', { title: 'e2e' }, {
  type: 'user/message',
  data: { id: 'm1', role: 'user', content: [{ type: 'text', text: marker }] },
})

// Give the spawn + end a moment, then check atuin.
await new Promise((r) => setTimeout(r, 1500))
const { execFileSync } = await import('node:child_process')
const out = execFileSync('atuin', ['history', 'last', '--cmd-only'], { encoding: 'utf8' }).trim()
console.log('atuin last:', out.slice(0, 80))
console.log(out === marker ? 'E2E PASS: prompt recorded' : 'E2E FAIL: mismatch')
