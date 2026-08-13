// Real integration: dsh-cloudflare-browser-run via cordis mount + real CF API.
import { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/index.ts'

const ctx = new Context()
const registered = []
ctx.provide('tools', { register(t) { registered.push(t) } })
ctx.provide('credentials', { async resolve() { return { value: '', source: 'env' } } })
ctx.provide('systemPrompt', { section() {} })

apply(ctx, {
  cf_api_token: process.env.DSH_TEST_CF_TOKEN,
  cf_account_id: process.env.DSH_TEST_CF_ACCOUNT,
})

const browse = registered.find((t) => t.name === 'browse')
const res = await browse.execute({ url: 'https://example.com', action: 'markdown' }, {})
console.log('browse:', res.ok ? 'OK' : 'FAIL', res.ok ? `len=${String(res.content).length}` : res.error)
