// dsh-search — DeepSeek Harness (Cordis) plugin.
//
// Registers an AnySearch-backed WebSearchProvider with ctx.web. AnySearch is
// a single MCP gateway that aggregates exa / tavily / firecrawl / context7
// behind one API key, so one provider covers many backends.
//
// Ported from pi-all-search (providers/anysearch.ts) with the pi UI/typebox
// surface replaced by the dsh WebSearchProvider seam.
//
// Privacy: the API key is read via ctx.credentials from an env-var reference
// (recommended) or a direct config value; it is never logged.

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef, type ResolvedCredential } from '@deepseek-ai/dsh-credentials'
import type { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web'

export const name = 'dsh-search'
export const inject = ['web', 'credentials']

export interface Config {
  /** Env-var name of the AnySearch API key (recommended; resolved via ctx.credentials). */
  api_key_ref?: string
  /** Direct API key value (fallback when no ref is set). */
  api_key?: string
  /** AnySearch MCP endpoint override. */
  base_url?: string
}

export const Config: z<Config> = z.object({
  api_key_ref: z.string().description('Env-var name of the AnySearch API key (recommended)'),
  api_key: z.string().description('Direct API key value (fallback when no ref is set)'),
  base_url: z.string().description('AnySearch MCP endpoint override (default https://api.anysearch.com/mcp)'),
})

const DEFAULT_BASE_URL = 'https://api.anysearch.com/mcp'

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

export function apply(ctx: Context, config: Config): void {
  // Credentials resolve per operation (never at boot): a changed env var
  // reaches the next search without a restart, and the key never lands in
  // config/logs. `available()` is a cheap local check — no network.
  const wrapper: WebSearchProvider = {
    id: 'anysearch',
    available: () => Boolean(config.api_key_ref ?? config.api_key),
    async search(request, signal) {
      let key = config.api_key
      if (config.api_key_ref) {
        try {
          const resolved: ResolvedCredential = await ctx.credentials.resolve(credentialRef(config.api_key_ref))
          key = resolved.value
        } catch (e) {
          throw new Error(`api_key_ref '${config.api_key_ref}' unresolvable: ${String(e).slice(0, 120)}`)
        }
      }
      if (!key) throw new Error('AnySearch API key not configured (set api_key_ref or api_key)')
      return new AnysearchProvider(key, config.base_url ?? DEFAULT_BASE_URL).search(request, signal)
    },
  }
  ctx.web.registerSearchProvider(wrapper)
}
