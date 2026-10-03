import {NextResponse} from 'next/server'
import {probeContext} from '@/lib/sanity/context'

/**
 * Reports what the Sanity Context endpoint actually serves.
 *
 * This is the evidence surface for the agent track: it calls the hosted MCP
 * server directly and shows the tools it advertises, the initial context an
 * agent receives, and the result of a live GROQ query answered through Context.
 * When the organisation token is absent it says so plainly rather than
 * pretending the integration exists.
 */
export async function GET() {
  const probe = await probeContext()
  return NextResponse.json(probe, {
    status: probe.ok ? 200 : 200,
    headers: {'Cache-Control': 'no-store'},
  })
}