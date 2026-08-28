// dsh-all-search — DeepSeek Harness (Cordis) plugin.
//
// Registers a single WebSearchProvider (id anysearch) with ctx.web. AnySearch
// is a MCP gateway that aggregates exa / tavily / firecrawl / context7 behind
// one API key. When that key is set, queries stay on the gateway (developer-
// intent queries may try the Firecrawl Developer Index first). When the
// AnySearch key is absent, the same wrapper stays available and searches via
// Firecrawl POST /v1/search — no Authorization header unless firecrawl_api_key
// is set (then Bearer, own quota).
//
// One registerSearchProvider call: the dsh-web seam errors on multiple usable
// providers (WEB_PROVIDER_AMBIGUOUS) unless one is configured explicitly.
//
// Privacy: API keys live in the plugin config only; they are never logged.

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web'

export const name = 'all-search'
export const inject = ['web']

export interface Config {
  /** AnySearch API key. When set, queries use the AnySearch gateway. */
  api_key?: string
  /** AnySearch MCP endpoint override. */
  base_url?: string
  /** Firecrawl API key — Bearer quota for /v1/search; also enables Developer Index when AnySearch is configured. */
  firecrawl_api_key?: string
}

export const Config: z<Config> = z.object({
  api_key: z.string().description('AnySearch API key (optional — without it, Firecrawl keyless search is used)'),
  base_url: z.string().description('AnySearch MCP endpoint override (default https://api.anysearch.com/mcp)'),
  firecrawl_api_key: z.string().description('Firecrawl API key (optional) — Bearer for Firecrawl quota; also enables Developer Index when AnySearch is configured'),
})

const DEFAULT_BASE_URL = 'https://api.anysearch.com/mcp'
export const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v1/search'
const DEVELOPER_QUERY_RE =
  /\b(repo|repos|repository|repositories|github|issue|issues|pull request|pull requests|commit|commits|branch|merge|openapi|readme|skill|skills|library|framework)\b/i

export function isDeveloperQuery(query: string): boolean {
  return DEVELOPER_QUERY_RE.test(query)
}

export class AnysearchProvider implements WebSearchProvider {
  readonly id = 'anysearch'
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  /** Cheap local check — no network. */
  available(): boolean {
    return Boolean(this.apiKey)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'search', arguments: { query: request.query, max_results: request.maxResults ?? 5 } },
      }),
    })
    if (!resp.ok) throw new Error(`AnySearch HTTP ${resp.status}`)
    const data = (await resp.json()) as {
      result?: { content?: Array<{ text?: string }> }
    }
    const text = data.result?.content?.[0]?.text ?? ''
    const sources = this.parseResults(text)
    const truncated = request.maxResults !== undefined && sources.length > request.maxResults
    return {
      sources: truncated ? sources.slice(0, request.maxResults) : sources,
      truncated,
    }
  }

  private parseResults(text: string): WebSearchSource[] {
    const results: WebSearchSource[] = []
    const sections = text.split(/^### \d+\. /m).slice(1)
    for (const section of sections) {
      const lines = section.trim().split('\n')
      const title = lines[0]?.trim() ?? ''
      const urlLine = lines.find((l) => l.startsWith('- **URL**:'))
      const url = urlLine?.replace('- **URL**: ', '').replace(/\*\*/g, '').trim() ?? ''
      const snippet = lines
        .filter((l) => !l.startsWith('- **URL**:') && l.trim() && !l.startsWith('#'))
        .join(' ')
        .slice(0, 300)
      if (title && url) results.push({ url, title, snippet })
    }
    return results
  }
}

/** Firecrawl general web search. Works keyless; Bearer only when an API key is provided. */
export class FirecrawlSearchProvider implements WebSearchProvider {
  readonly id = 'firecrawl'
  constructor(private readonly apiKey?: string) {}

  available(): boolean {
    return true
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`
    const resp = await fetch(FIRECRAWL_SEARCH_URL, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({ query: request.query, limit: request.maxResults ?? 5 }),
    })
    if (!resp.ok) throw new Error(`Firecrawl HTTP ${resp.status}`)
    const data = (await resp.json()) as { data?: Array<Record<string, unknown>> }
    const sources: WebSearchSource[] = (data.data ?? []).map((r: any) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.description ?? '',
    }))
    const truncated = request.maxResults !== undefined && sources.length > request.maxResults
    return {
      sources: truncated ? sources.slice(0, request.maxResults) : sources,
      truncated,
    }
  }
}

export class FirecrawlDevProvider implements WebSearchProvider {
  readonly id = 'firecrawl-dev'
  constructor(private readonly apiKey: string) {}

  available(): boolean {
    return Boolean(this.apiKey)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const resp = await fetch('https://api.firecrawl.dev/v2/search/developer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal,
      body: JSON.stringify({ query: request.query, limit: request.maxResults ?? 5 }),
    })
    if (!resp.ok) throw new Error(`Firecrawl Developer Index HTTP ${resp.status}`)
    const data = (await resp.json()) as { data?: Array<Record<string, unknown>> }
    const sources: WebSearchSource[] = (data.data ?? []).map((r: any) => ({
      title: r.title ?? r.id ?? '',
      url: r.url ?? '',
      snippet:
        r.description ??
        (Array.isArray(r.passages) ? r.passages.slice(0, 3).join(' ') : '') ??
        '',
    }))
    const truncated = request.maxResults !== undefined && sources.length > request.maxResults
    return {
      sources: truncated ? sources.slice(0, request.maxResults) : sources,
      truncated,
    }
  }
}

export function apply(ctx: Context, config: Config): void {
  const anysearch = new AnysearchProvider(config.api_key ?? '', config.base_url ?? DEFAULT_BASE_URL)
  const firecrawl = new FirecrawlSearchProvider(config.firecrawl_api_key)
  const devIndex = config.firecrawl_api_key ? new FirecrawlDevProvider(config.firecrawl_api_key) : null

  // Single provider to avoid dsh-web's WEB_PROVIDER_AMBIGUOUS on multiple
  // usable providers. AnySearch key → gateway (Dev Index first for developer
  // queries). No AnySearch key → Firecrawl /v1/search (keyless unless a
  // firecrawl_api_key is set).
  const wrapper: WebSearchProvider = {
    id: 'anysearch',
    available: () => Boolean(config.api_key) || firecrawl.available(),
    async search(request, signal) {
      if (config.api_key) {
        if (devIndex && isDeveloperQuery(request.query)) {
          try {
            const dev = await devIndex.search(request, signal)
            if (dev.sources.length > 0) return dev
          } catch {
            // fall through to AnySearch
          }
        }
        return anysearch.search(request, signal)
      }
      return firecrawl.search(request, signal)
    },
  }
  ctx.web.registerSearchProvider(wrapper)
}
