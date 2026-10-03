/**
 * A thin client for Sanity Context.
 *
 * Context is a hosted, read-only MCP server. Speaking JSON-RPC to it directly,
 * rather than through the agent SDK, keeps the diagnostics honest: what this
 * returns is what an agent would actually see on the wire.
 *
 * Every function degrades to a typed "unavailable" result instead of throwing,
 * because Context requires an organisation-scoped token that not every
 * deployment has. The interface reports that state rather than hiding it.
 */

export interface ContextUnavailable {
  ok: false
  reason: 'not_configured' | 'forbidden' | 'unreachable' | 'error'
  message: string
}

export interface ContextTool {
  name: string
  description?: string
}

export interface ContextProbe {
  ok: boolean
  endpoint?: string
  tools?: ContextTool[]
  /** What an agent is handed before it asks anything. */
  initialContext?: string
  /** A live GROQ query through the Context endpoint rather than the API. */
  groqProbe?: {query: string; resultCount: number | null; error?: string}
  error?: ContextUnavailable
}

const ORG_ID = process.env.SANITY_ORG_ID ?? 'ovihgdwkx'
const ENDPOINT_NAME = process.env.SANITY_CONTEXT_ENDPOINT ?? 'ninety'

export function contextUrl(): string | null {
  const explicit = process.env.SANITY_CONTEXT_MCP_URL
  if (explicit) return explicit
  return `https://api.sanity.io/v1/context/organizations/${ORG_ID}/mcp/${ENDPOINT_NAME}`
}

export function contextToken(): string | null {
  return process.env.SANITY_CONTEXT_TOKEN ?? process.env.SANITY_ORGANIZATION_TOKEN ?? null
}

/** Call a tool on the Context MCP endpoint. Returns the text content blocks. */
async function callTool(
  method: string,
  params: Record<string, unknown>,
): Promise<{ok: true; data: unknown} | ContextUnavailable> {
  const url = contextUrl()
  const token = contextToken()
  if (!url || !token) {
    return {
      ok: false,
      reason: 'not_configured',
      message:
        'Set SANITY_CONTEXT_TOKEN (an organisation API token with Context Viewer) to talk to Sanity Context.',
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
    })

    const raw = await res.text()
    // Context answers with SSE: `event: message` then a `data:` line.
    const payload = raw
      .split('\n')
      .find((line) => line.startsWith('data: '))
      ?.slice(6)

    const parsed = payload ? (JSON.parse(payload) as Record<string, unknown>) : (JSON.parse(raw) as Record<string, unknown>)

    if (!res.ok) {
      const err = parsed.error as {message?: string} | undefined
      const forbidden = res.status === 403
      return {
        ok: false,
        reason: forbidden ? 'forbidden' : 'error',
        message:
          err?.message ??
          `Sanity Context responded ${res.status}. Context needs an organisation-level token with Context Viewer permissions.`,
      }
    }

    if (parsed.error) {
      const err = parsed.error as {message?: string}
      return {ok: false, reason: 'error', message: err.message ?? 'Sanity Context returned an error.'}
    }

    return {ok: true, data: parsed.result}
  } catch (error) {
    return {
      ok: false,
      reason: 'unreachable',
      message: `Could not reach Sanity Context: ${(error as Error).message}`,
    }
  }
}

function textOf(result: unknown): string {
  const content = (result as {content?: Array<{type: string; text?: string}>})?.content ?? []
  return content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
}

/**
 * Probe the endpoint: which tools it serves, what initial context an agent gets,
 * and one live GROQ query answered through Context rather than the API.
 */
export async function probeContext(): Promise<ContextProbe> {
  const url = contextUrl()

  const listed = await callTool('tools/list', {})
  if (!listed.ok) {
    return {ok: false, endpoint: url ?? undefined, error: listed}
  }

  const tools = ((listed.data as {tools?: ContextTool[]})?.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
  }))

  const initial = await callTool('tools/call', {name: 'initial_context', arguments: {}})
  const initialContext = initial.ok ? textOf(initial.data) : undefined

  // A query an agent would plausibly run to find the rule it needs.
  const probeQuery = `*[_type == "territory" && code == "HR"][0]{name, code, "bands": accessBands[]{window{from, to}, counted, modes}}`

  let groqProbe: ContextProbe['groqProbe']
  if (tools.some((t) => t.name === 'groq_query')) {
    const g = await callTool('tools/call', {name: 'groq_query', arguments: {query: probeQuery}})
    groqProbe = g.ok
      ? {
          query: probeQuery,
          resultCount: countResult(textOf(g.data)),
        }
      : {query: probeQuery, resultCount: null, error: g.message}
  }

  return {
    ok: true,
    endpoint: url ?? undefined,
    tools,
    initialContext,
    groqProbe,
  }
}

function countResult(text: string): number | null {
  const match = text.match(/"resultCount"\s*:\s*(\d+)/)
  if (match) return Number(match[1])
  try {
    const parsed = JSON.parse(text) as {result?: unknown}
    return Array.isArray(parsed.result) ? parsed.result.length : null
  } catch {
    return null
  }
}