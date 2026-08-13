// Real integration: dsh-all-search — mount into cordis and run a real
// AnySearch query through the provider.
import { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/index.ts'

const ctx = new Context()
const registered = []
ctx.provide('web', { registerSearchProvider(p) { registered.push(p) } })
ctx.provide('credentials', { async resolve() { return { value: '', source: 'env' } } })

apply(ctx, { api_key: process.env.ANYSEARCH_API_KEY })

const provider = registered[0]
if (!provider.available()) {
  console.log('SKIP: no ANYSEARCH_API_KEY')
  process.exit(0)
}
const r = await provider.search({ query: 'cloudflare browser run', maxResults: 3 })
console.log('search:', r.sources.length, 'sources | truncated:', r.truncated)
for (const s of r.sources.slice(0, 3)) {
  console.log('  -', (s.title ?? '').slice(0, 50), '|', s.url.slice(0, 60))
}
console.log(r.sources.length > 0 ? 'E2E PASS' : 'E2E FAIL: no results')
