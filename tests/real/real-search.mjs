// Real integration: dsh-all-search — mount into cordis and run a real
// AnySearch query through the provider. The key comes from the pi extension's
// config file (~/.pi/agent/extensions/pi-all-search/config.json) — no env vars.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { apply } from '../../src/index.ts'

let apiKey = ''
try {
  const c = JSON.parse(readFileSync(join(homedir(), '.pi', 'agent', 'extensions', 'pi-all-search', 'config.json'), 'utf8'))
  apiKey = c.apiKeys?.anysearch ?? ''
} catch {}
if (!apiKey) {
  console.log('SKIP: no anysearch key in ~/.pi/agent/extensions/pi-all-search/config.json')
  process.exit(0)
}

const ctx = new Context()
const registered = []
ctx.provide('web', { registerSearchProvider(p) { registered.push(p) } })

apply(ctx, { api_key: apiKey })

const provider = registered[0]
if (!provider.available()) {
  console.log('SKIP: provider unavailable')
  process.exit(0)
}
const r = await provider.search({ query: 'cloudflare browser run', maxResults: 3 })
console.log('search:', r.sources.length, 'sources | truncated:', r.truncated)
for (const s of r.sources.slice(0, 3)) {
  console.log('  -', (s.title ?? '').slice(0, 50), '|', s.url.slice(0, 60))
}
console.log(r.sources.length > 0 ? 'E2E PASS' : 'E2E FAIL: no results')
