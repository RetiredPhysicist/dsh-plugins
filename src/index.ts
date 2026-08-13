// @alex/dsh-cloudflare-browser-run — DeepSeek Harness (Cordis) plugin: web browsing
// tools backed by Cloudflare Browser Run Quick Actions.
//
// Tools:
//   browse(url, action?)   read a page as clean markdown (default)
//   screenshot(url)        save a PNG of the page, returns local path
//   pdf(url)               save a PDF of the page, returns local path
//
// Credentials: recommended via CredentialRef (env var name in
// `cf_api_token_ref`, resolved through ctx.credentials — the value never
// lands in config). A plain `cf_api_token` string is also accepted.

import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef, type ResolvedCredential } from '@deepseek-ai/dsh-credentials'
import z from '@deepseek-ai/schemastery'
import { mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { browserRunAction, resolveConfig, type Action, type BrowserRunConfig } from './api.js'

export const name = 'browser-run'
export const inject = ['tools', 'credentials']

export interface Config {
  /** Env-var name of the Browser Rendering token (recommended; resolved via
   *  ctx.credentials, value never stored in config). */
  cf_api_token_ref?: string
  /** Direct token value — fallback when no ref is configured. */
  cf_api_token?: string
  /** Cloudflare account id. */
  cf_account_id: string
  /** API base override (default https://api.cloudflare.com/client/v4). */
  cf_api_base?: string
  /** Where screenshots/PDFs are written (default OS temp dir). */
  output_dir?: string
}

export const Config: z<Config> = z.object({
  cf_api_token_ref: z.string().description('Env-var name of the Cloudflare API token (Browser Rendering:Edit)'),
  cf_api_token: z.string().description('Direct token value (fallback when no ref is set)'),
  cf_account_id: z.string().description('Cloudflare account id'),
  cf_api_base: z.string().description('API base URL override'),
  output_dir: z.string().description('Directory for screenshot/PDF output (default OS temp)'),
})

const ACTION_LABEL: Record<Action, string> = {
  markdown: 'markdown text',
  screenshot: 'PNG',
  pdf: 'PDF',
}

function toolResultText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function apply(ctx: Context, config: Config): void {
  ctx.systemPrompt.section({
    name: 'tool:browser-run',
    order: 112,
    text:
      'Use the browse tool to fetch any public web page in a real headless ' +
      'browser (Cloudflare Browser Run): it returns clean markdown, a screenshot ' +
      '(PNG) or a PDF. Prefer it over web_fetch for JS-rendered pages, sites that ' +
      'need a real browser, or when you need a screenshot. Only public http(s) URLs.',
  })

  // Resolve credentials per operation (never at boot): a changed env var
  // reaches the next call without a restart.
  const resolveToken = async (): Promise<{ ok: true; config: BrowserRunConfig } | { ok: false; error: string }> => {
    let token: string | undefined = config.cf_api_token
    if (config.cf_api_token_ref) {
      try {
        const resolved: ResolvedCredential = await ctx.credentials.resolve(credentialRef(config.cf_api_token_ref))
        token = resolved.value
      } catch (e) {
        return { ok: false, error: `cf_api_token_ref '${config.cf_api_token_ref}' unresolvable: ${String(e).slice(0, 120)}` }
      }
    }
    const cfg = resolveConfig({ cf_api_token: token, cf_account_id: config.cf_account_id, cf_api_base: config.cf_api_base })
    return 'error' in cfg ? { ok: false, error: cfg.error } : { ok: true, config: cfg }
  }

  const saveToOutput = (action: Action, data: Uint8Array): string => {
    const dir = config.output_dir ?? join(tmpdir(), 'dsh-cloudflare-browser-run')
    mkdirSync(dir, { recursive: true })
    const ext = action === 'screenshot' ? 'png' : 'pdf'
    const file = join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`)
    writeFileSync(file, data)
    return file
  }

  // `never` cast keeps defineTool's heavy generics from recursing on the
  // helper signature; runtime shape is identical to a direct call.
  const register = (tool: Record<string, unknown>): void => {
    ctx.tools.register(defineTool(tool as never))
  }

  register({
    name: 'browse',
    description:
      'Fetch a public web page in a real headless browser (Cloudflare Browser Run) ' +
      'and return clean markdown text. Use for ANY web access, especially JS-rendered ' +
      'or SPA pages. Actions: markdown (default), screenshot (PNG), pdf.',
    parameters: {
      url: { type: 'string', required: true, description: 'Public http(s) URL, e.g. https://example.com' },
      action: {
        type: 'string',
                enum: ['markdown', 'screenshot', 'pdf'],
        description: 'What to extract (default markdown)',
      },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: toolResultText(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, _exec) {
      const resolved = await resolveToken()
      if (!resolved.ok) return { ok: false, action: args.action ?? 'markdown', error: 'error' in resolved ? resolved.error : 'unknown' }
      const action: Action = (args.action ?? 'markdown') as Action
      const r = await browserRunAction(resolved.config, action, args.url as string)
      if (!r.ok) return { ok: false, action, error: 'error' in r ? r.error : 'unknown' }
      if (action === 'markdown') {
        return { ok: true, action, content: String(r.content).slice(0, 100_000) || '(page returned no readable text)' }
      }
      const file = saveToOutput(action, r.content as Uint8Array)
      return { ok: true, action, path: file, content: `${ACTION_LABEL[action]} saved to ${file}` }
    },
  })

  register({
    name: 'screenshot',
    description:
      'Take a screenshot of a public web page in a real headless browser (Cloudflare ' +
      'Browser Run) and save it locally as PNG. Returns the local file path.',
    parameters: {
      url: { type: 'string', required: true, description: 'Public http(s) URL, e.g. https://example.com' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: toolResultText(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, _exec) {
      const resolved = await resolveToken()
      if (!resolved.ok) return { ok: false, path: '', error: 'error' in resolved ? resolved.error : 'unknown' }
      const r = await browserRunAction(resolved.config, 'screenshot', args.url as string)
      if (!r.ok) return { ok: false, path: '', error: 'error' in r ? r.error : 'unknown' }
      const file = saveToOutput('screenshot', r.content as Uint8Array)
      return { ok: true, path: file }
    },
  })

  register({
    name: 'pdf',
    description:
      'Render a public web page to PDF in a real headless browser (Cloudflare Browser ' +
      'Run) and save it locally. Returns the local file path.',
    parameters: {
      url: { type: 'string', required: true, description: 'Public http(s) URL, e.g. https://example.com' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: toolResultText(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, _exec) {
      const resolved = await resolveToken()
      if (!resolved.ok) return { ok: false, path: '', error: 'error' in resolved ? resolved.error : 'unknown' }
      const r = await browserRunAction(resolved.config, 'pdf', args.url as string)
      if (!r.ok) return { ok: false, path: '', error: 'error' in r ? r.error : 'unknown' }
      const file = saveToOutput('pdf', r.content as Uint8Array)
      return { ok: true, path: file }
    },
  })
}
