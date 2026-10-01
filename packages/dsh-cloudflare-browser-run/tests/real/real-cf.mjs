// Real integration: dsh-cloudflare-browser-run via cordis mount + real CF API.
// Credentials come from ~/.pi/agent/cloudflare-browser-run.json (same config
// the pi extension uses) — no env vars.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { apply } from '../../src/index.ts'

let cfg
try {
  cfg = JSON.parse(readFileSync(join(homedir(), '.pi', 'agent', 'cloudflare-browser-run.json'), 'utf8'))
} catch {
  console.log('SKIP: no ~/.pi/agent/cloudflare-browser-run.json config')
  process.exit(0)
}
if (!cfg.cf_api_token || !cfg.cf_account_id) {
  console.log('SKIP: config missing cf_api_token / cf_account_id')
  process.exit(0)
}

const ctx = new Context()
const registered = []
ctx.provide('tools', { register(t) { registered.push(t) } })
ctx.provide('systemPrompt', { section() {} })

apply(ctx, { cf_api_token: cfg.cf_api_token, cf_account_id: cfg.cf_account_id })

const browse = registered.find((t) => t.name === 'browse')
const res = await browse.execute({ url: 'https://example.com', action: 'markdown' }, {})
console.log('browse:', res.ok ? 'OK' : 'FAIL', res.ok ? `len=${String(res.content).length}` : res.error)
