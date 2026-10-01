// dsh-cloudflare-browser-run — DeepSeek Harness (Cordis) plugin: web browsing
// tools backed by Cloudflare Browser Run Quick Actions.
//
// Tools:
//   browse(url, action?)   read a page as clean markdown (default)
//   screenshot(url)        save a PNG of the page, returns local path
//   pdf(url)               save a PDF of the page, returns local path
//   crawl(url, ...)        multi-page crawl via /crawl (optional wait/poll)
//   crawl_status(jobId)    poll / fetch crawl job results
//
// Credentials: `cf_api_token` in the plugin config (profile/settings layer) —
// no env vars, no secrets in code.

import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  browserRunAction,
  crawl,
  crawlStatus,
  defaultCrawlWait,
  resolveConfig,
  type Action,
  type BrowserRunConfig,
  type CrawlFormat,
  type CrawlJobResult,
  type CrawlRecord,
} from './api.js'

export const name = 'cloudflare-browser-run'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** Cloudflare API token (Browser Rendering:Edit permission). Optional at
   *  load time — missing credentials surface as a setup hint on tool calls so
   *  the plugin still loads in a bare profile. */
  cf_api_token?: string
  /** Cloudflare account id. */
  cf_account_id?: string
  /** API base override (default https://api.cloudflare.com/client/v4). */
  cf_api_base?: string
  /** Where screenshots/PDFs are written (default OS temp dir). */
  output_dir?: string
}

export const Config: z<Config> = z.object({
  cf_api_token: z.string().description('Cloudflare API token (Browser Rendering:Edit permission)'),
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

function hostOf(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  try {
    return new URL(raw).host
  } catch {
    return raw
  }
}

// UI presentation for the pending call: a short fetch-style card carrying the
// target host. `kind: 'fetch'` gives a capable dsh web UI an icon treatment.
function presentCallFor(label: string): (args: unknown) => unknown {
  return (args) => {
    const url = (args as { url?: unknown }).url
    const host = hostOf(url)
    return {
      card: 'generic',
      kind: 'fetch',
      title: `${label} ${host}`,
      rawInput: host ? url : undefined,
    }
  }
}

// UI presentation for the settled call: success shows the returned text/file
// path; failure collapses to a short error title with the error content.
function presentResultFor(label: string): (args: unknown, result: { content: Array<{ type: string; text?: string }>; isError: boolean }) => unknown {
  return (args, result) => {
    const host = hostOf((args as { url?: unknown }).url)
    const text = result.content.map((b) => (b.type === 'text' && b.text) || '').join('').trim()
    if (result.isError) {
      return { card: 'generic', title: `${label} ${host} failed`, content: [{ type: 'text', text: text || 'unknown error' }] }
    }
    return {
      card: 'generic',
      title: `${label} ${host} ok`,
      content: text ? [{ type: 'text', text }] : undefined,
    }
  }
}

// Shared output shape for every tool: JSON-safe, rendered as text, with a
// tool/result meta projection for UI event consumers.
const OUTPUT = {
  schema: { type: 'json' },
  render: (_args: unknown, value: unknown) => [{ type: 'text', text: toolResultText(value) }],
  presentationMeta: (args: unknown, value: unknown) => ({
    url: (args as { url?: unknown }).url ?? '',
    action: (args as { action?: unknown }).action ?? 'markdown',
    summary: toolResultText(value).slice(0, 200),
  }),
}

export function apply(ctx: Context, config: Config): void {
  ctx.systemPrompt.section({
    name: 'tool:cloudflare-browser-run',
    order: 2950,
    text:
      'Use browse for a single public page (markdown / screenshot / pdf). Use crawl ' +
      'to scrape multiple pages from one site (returns markdown per page; waits for ' +
      'small limits). Use crawl_status to poll large crawl jobs. Prefer these over ' +
      'web_fetch for JS-rendered pages. Only public http(s) URLs.',
  })

  const resolveToken = async (): Promise<{ ok: true; config: BrowserRunConfig } | { ok: false; error: string }> => {
    const cfg = resolveConfig({
      cf_api_token: config.cf_api_token,
      cf_account_id: config.cf_account_id,
      cf_api_base: config.cf_api_base,
    })
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

  // Shared execution path for every tool: resolve the token once, run the
  // action, then normalize the result into a tool-safe JSON shape. `signal`
  // (the dsh timeout policy's abort) is forwarded so a cooperative cancel
  // actually stops the in-flight fetch.
  const runAction = async (
    args: { url?: unknown; action?: unknown },
    exec?: { signal?: AbortSignal },
  ): Promise<{ ok: boolean; action: Action; path?: string; content?: string; error?: string }> => {
    const action = (args.action ?? 'markdown') as Action
    const resolved = await resolveToken()
    if (!resolved.ok) return { ok: false, action, error: 'error' in resolved ? resolved.error : 'unknown' }
    const r = await browserRunAction(resolved.config, action, String(args.url ?? ''), exec?.signal)
    if (!r.ok) return { ok: false, action, error: 'error' in r ? r.error : 'unknown' }
    if (action === 'markdown') {
      return { ok: true, action, content: String(r.content).slice(0, 100_000) || '(page returned no readable text)' }
    }
    const file = saveToOutput(action, r.content as Uint8Array)
    return { ok: true, action, path: file, content: `${ACTION_LABEL[action]} saved to ${file}` }
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
    output: OUTPUT,
    isConcurrencySafe: () => true,
    // Cooperative budget (enforced by the dsh timeout policy via exec.signal);
    // an `action` may be screenshot/pdf, so allow the slowest path.
    timeoutMs: 120_000,
    presentCall: presentCallFor('browse'),
    presentResult: presentResultFor('browse'),
    execute: (args, exec) => runAction(args, exec),
  })

  register({
    name: 'screenshot',
    description:
      'Take a screenshot of a public web page in a real headless browser (Cloudflare ' +
      'Browser Run) and save it locally as PNG. Returns the local file path.',
    parameters: {
      url: { type: 'string', required: true, description: 'Public http(s) URL, e.g. https://example.com' },
    },
    output: OUTPUT,
    isConcurrencySafe: () => true,
    timeoutMs: 120_000,
    presentCall: presentCallFor('screenshot'),
    presentResult: presentResultFor('screenshot'),
    execute: (args, exec) => runAction({ ...args, action: 'screenshot' }, exec),
  })

  register({
    name: 'pdf',
    description:
      'Render a public web page to PDF in a real headless browser (Cloudflare Browser ' +
      'Run) and save it locally. Returns the local file path.',
    parameters: {
      url: { type: 'string', required: true, description: 'Public http(s) URL, e.g. https://example.com' },
    },
    output: OUTPUT,
    isConcurrencySafe: () => true,
    timeoutMs: 120_000,
    presentCall: presentCallFor('pdf'),
    presentResult: presentResultFor('pdf'),
    execute: (args, exec) => runAction({ ...args, action: 'pdf' }, exec),
  })

  const truncateRecord = (rec: CrawlRecord, maxMd = 4_000): CrawlRecord => {
    const out: CrawlRecord = { url: rec.url, status: rec.status }
    if (rec.metadata) out.metadata = rec.metadata
    if (typeof rec.markdown === 'string') {
      out.markdown =
        rec.markdown.length > maxMd ? rec.markdown.slice(0, maxMd) + '\n…(truncated)' : rec.markdown
    }
    if (typeof rec.html === 'string') {
      out.html = rec.html.length > maxMd ? rec.html.slice(0, maxMd) + '\n…(truncated)' : rec.html
    }
    if (rec.json !== undefined) out.json = rec.json
    return out
  }

  const formatCrawlJob = (job: CrawlJobResult, maxRecords = 50) => {
    const records = (job.records ?? []).slice(0, maxRecords).map((r) => truncateRecord(r))
    return {
      id: job.id,
      status: job.status,
      total: job.total,
      finished: job.finished,
      browserSecondsUsed: job.browserSecondsUsed,
      cursor: job.cursor,
      recordCount: records.length,
      records,
    }
  }

  register({
    name: 'crawl',
    description:
      'Crawl a public site starting from a URL via Cloudflare Browser Run /crawl. ' +
      'Follows links up to limit/depth and returns markdown (default) per page. ' +
      'For small jobs (limit≤20) waits for completion by default; for larger jobs ' +
      'returns a job id — then use crawl_status.',
    parameters: {
      url: { type: 'string', required: true, description: 'Starting public http(s) URL to crawl' },
      limit: { type: 'number', description: 'Max pages to crawl (default 10)' },
      depth: { type: 'number', description: 'Max link depth from the start URL' },
      formats: {
        type: 'array',
        items: { type: 'string', enum: ['markdown', 'html', 'json'] },
        description: 'Response formats (default [markdown])',
      },
      render: { type: 'boolean', description: 'Headless Chrome (true) or fast HTML fetch (false)' },
      source: { type: 'string', enum: ['all', 'sitemaps', 'links'], description: 'URL discovery source' },
      includePatterns: { type: 'array', items: { type: 'string' }, description: 'Only visit matching URL patterns' },
      excludePatterns: { type: 'array', items: { type: 'string' }, description: 'Skip matching URL patterns' },
      wait: {
        type: 'boolean',
        description: 'Poll until done (default true when limit≤20). If false, returns job id.',
      },
    },
    output: OUTPUT,
    isConcurrencySafe: () => true,
    timeoutMs: 360_000,
    presentCall: presentCallFor('crawl'),
    presentResult: presentResultFor('crawl'),
    execute: async (args) => {
      const resolved = await resolveToken()
      if (!resolved.ok) return { ok: false, error: 'error' in resolved ? resolved.error : 'unknown' }
      const limit = typeof args.limit === 'number' ? args.limit : undefined
      const wait = typeof args.wait === 'boolean' ? args.wait : defaultCrawlWait(limit)
      const r = await crawl(resolved.config, {
        url: String(args.url ?? ''),
        limit,
        depth: typeof args.depth === 'number' ? args.depth : undefined,
        formats: (Array.isArray(args.formats) ? args.formats : ['markdown']) as CrawlFormat[],
        render: typeof args.render === 'boolean' ? args.render : undefined,
        source: args.source as 'all' | 'sitemaps' | 'links' | undefined,
        includePatterns: Array.isArray(args.includePatterns) ? (args.includePatterns as string[]) : undefined,
        excludePatterns: Array.isArray(args.excludePatterns) ? (args.excludePatterns as string[]) : undefined,
        wait,
      })
      if (!r.ok) return { ok: false, error: 'error' in r ? r.error : 'unknown' }
      if (r.job) return { ok: true, ...formatCrawlJob(r.job) }
      return {
        ok: true,
        jobId: r.jobId,
        status: 'running',
        message: 'Crawl started. Poll with crawl_status(jobId) until status is completed.',
      }
    },
  })

  register({
    name: 'crawl_status',
    description:
      'Check status or fetch results of a Cloudflare Browser Run crawl job by id. ' +
      'Supports limit/cursor pagination and status filters on records.',
    parameters: {
      jobId: { type: 'string', required: true, description: 'Crawl job id from crawl' },
      limit: { type: 'number', description: 'Max records to return' },
      cursor: { type: 'string', description: 'Pagination cursor' },
      status: {
        type: 'string',
        description: 'Filter records: queued|completed|disallowed|skipped|errored|cancelled',
      },
    },
    output: OUTPUT,
    isConcurrencySafe: () => true,
    timeoutMs: 120_000,
    presentCall: (args) => ({
      card: 'generic',
      kind: 'fetch',
      title: `crawl_status ${String((args as { jobId?: unknown }).jobId ?? '').slice(0, 12)}`,
    }),
    presentResult: presentResultFor('crawl_status'),
    execute: async (args) => {
      const resolved = await resolveToken()
      if (!resolved.ok) return { ok: false, error: 'error' in resolved ? resolved.error : 'unknown' }
      const r = await crawlStatus(resolved.config, {
        jobId: String(args.jobId ?? ''),
        limit: typeof args.limit === 'number' ? args.limit : undefined,
        cursor: args.cursor as string | number | undefined,
        status: typeof args.status === 'string' ? args.status : undefined,
      })
      if (!r.ok) return { ok: false, error: 'error' in r ? r.error : 'unknown' }
      if (r.job) return { ok: true, ...formatCrawlJob(r.job) }
      return { ok: true, jobId: r.jobId }
    },
  })
}
