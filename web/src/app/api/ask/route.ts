import {NextResponse} from 'next/server'
import {createMCPClient} from '@ai-sdk/mcp'
import {anthropic} from '@ai-sdk/anthropic'
import {convertToModelMessages, generateText, stepCountIs, type UIMessage} from 'ai'
import {contextToken, contextUrl} from '@/lib/sanity/context'
import {evaluate} from '@/lib/engine'
import type {ItineraryInput} from '@/lib/engine/types'
import {loadSnapshot} from '@/lib/sanity/snapshot'

/**
 * The agent.
 *
 * One hard rule, enforced by the prompt and by the architecture: the model may
 * retrieve, classify and explain, but it may never state a day count. Anything
 * numeric comes from `evaluate`, the same deterministic engine the interface
 * uses. That is the difference between an assistant that sounds careful and one
 * that is.
 */

const SYSTEM = `You are the reasoning layer of Ninety, which computes short-stay travel allowances.

Rules you must follow:
1. Never state a day count, a total, a remaining balance, or the date on which a limit is crossed. You have no arithmetic authority. A tool result already contains every number you are allowed to report.
2. Answer only from the Sanity Context endpoint. If the context does not contain the rule, say that the rule is not in the corpus and stop.
3. When two sources conflict, do not choose. Say they conflict, present both, and say that a person has to rule.
4. Cite the source title for every claim you make.
5. If the traveller's passport or status is outside the corpus, say Ninety will not guess.

Be brief and concrete. A traveller is reading this on a phone.`

const MODEL_ID = process.env.NINETY_MODEL ?? 'claude-sonnet-4-5'

function missing(what: string, hint: string) {
  return NextResponse.json(
    {ok: false as const, error: 'not_configured', what, hint},
    {status: 503},
  )
}

export async function POST(request: Request) {
  if (!contextToken() || !contextUrl()) {
    return missing(
      'Sanity Context',
      'Set SANITY_CONTEXT_TOKEN to an organisation API token with Context Viewer permissions.',
    )
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return missing(
      'the model',
      'Set ANTHROPIC_API_KEY. Ninety will not answer from a corpus without a reasoner in front of it.',
    )
  }

  let body: {messages?: UIMessage[]; itinerary?: ItineraryInput; asOf?: string}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ok: false, error: 'Expected a JSON body.'}, {status: 400})
  }

  const messages = body.messages ?? []
  if (messages.length === 0) {
    return NextResponse.json({ok: false, error: 'No question supplied.'}, {status: 400})
  }

  // The engine runs first so the model has an authoritative number to defer to.
  let verdict: Awaited<ReturnType<typeof evaluate>> | null = null
  if (body.itinerary) {
    const {snapshot} = await loadSnapshot()
    verdict = evaluate(snapshot, body.itinerary, {asOf: body.asOf})
  }

  const mcp = await createMCPClient({
    transport: {
      type: 'http',
      url: contextUrl() as string,
      headers: {Authorization: `Bearer ${contextToken()}`},
    },
  })

  try {
    const tools = await mcp.tools()
    const result = await generateText({
      model: anthropic(MODEL_ID),
      system: verdict ? `${SYSTEM}\n\nThe deterministic engine has already run. Its verdict is authoritative and is the only source of numbers:\n${JSON.stringify(engineDigest(verdict))}` : SYSTEM,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(8),
    })

    return NextResponse.json({
      ok: true as const,
      answer: result.text,
      toolsUsed: Object.keys(result.steps ?? []).length,
      verdict,
    })
  } catch (error) {
    return NextResponse.json(
      {ok: false as const, error: 'agent_failed', message: (error as Error).message},
      {status: 502},
    )
  } finally {
    await mcp.close().catch(() => undefined)
  }
}

/** The slice of the verdict the model is allowed to see. */
function engineDigest(verdict: ReturnType<typeof evaluate>) {
  if (!verdict.ok) {
    return {refused: verdict.refusal, instruction: 'Report the refusal. Do not offer a number.'}
  }
  return {
    used: verdict.used,
    limitDays: verdict.limitDays,
    windowDays: verdict.windowDays,
    breachDate: verdict.attribution?.date ?? null,
    breachCount: verdict.attribution?.count ?? null,
    blamedTrips: verdict.attribution?.blame.map((b) => b.tripLabel) ?? [],
    lastPermissibleDay: verdict.lastPermissibleDay,
    unresolvedDays: verdict.unresolvedDays,
    repair: verdict.repair?.instruction ?? null,
    warnings: verdict.warnings,
  }
}