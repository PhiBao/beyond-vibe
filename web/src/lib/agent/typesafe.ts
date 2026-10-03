/**
 * A typed client for TypeSafe's System One models.
 *
 * These are not language models. They do not write prose; they return a typed
 * judgment with a probability attached, which is exactly what this domain needs.
 *
 * "Which presence rule does this stay fall under?" is a classification problem,
 * not a generation problem. A chat model answers it by writing a sentence you
 * then have to parse and second-guess. Jev answers it with a value from a set
 * you defined, plus the full distribution, so the interface can say "I think
 * this is a landed transit, 0.81 confident" — or refuse below a threshold.
 *
 * Every question is defined against candidates the agent retrieved from Sanity
 * Context, never against candidates invented here.
 */

const ENDPOINT = process.env.TYPESAFE_ENDPOINT ?? 'https://api.typesafe.ai/v1/systemone'
const MODEL = process.env.TYPESAFE_MODEL ?? 'jev-latest'

export function typesafeKey(): string | null {
  return process.env.TYPESAFE_API_KEY ?? null
}

export interface ChoiceAnswer<K extends string> {
  type: 'choice'
  choice: K
  probabilities: Record<K, number>
  confidence: number
}

export interface NoulAnswer {
  type: 'noul'
  noul: number
}

export interface ScoreAnswer {
  type: 'score'
  score: number
  confidence: number
}

type Question =
  | {type: 'choice'; instructions: string; criteria: Record<string, string>}
  | {type: 'noul'; instructions: string; criteria?: {true: string; false: string}}
  | {type: 'score'; instructions: string; criteria: string[]}

export interface Judgements {
  model: string
  answers: Record<string, ChoiceAnswer<string> | NoulAnswer | ScoreAnswer>
  usage?: {input_tokens: number; output_tokens: number}
}

export class TypesafeUnavailable extends Error {}

/**
 * Evaluate a state against typed questions.
 *
 * Retries on 429 and 529 with exponential backoff, because a rate-limited
 * request should not surface to a traveller as a broken answer.
 */
export async function judge(
  state: unknown,
  questions: Record<string, Question>,
  attempts = 3,
): Promise<Judgements> {
  const key = typesafeKey()
  if (!key) {
    throw new TypesafeUnavailable(
      'Set TYPESAFE_API_KEY to let the agent classify free-text trips.',
    )
  }

  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({state, model: MODEL, questions}),
      })

      if (res.status === 429 || res.status === 529) {
        // Back off before retrying; both are transient.
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
        continue
      }

      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`TypeSafe responded ${res.status}: ${detail.slice(0, 300)}`)
      }

      return (await res.json()) as Judgements
    } catch (error) {
      lastError = error
      if (error instanceof TypesafeUnavailable) throw error
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt))
    }
  }

  throw new Error(`TypeSafe unavailable after ${attempts} attempts: ${(lastError as Error)?.message}`)
}

/** Narrowing helpers, so callers do not hand-roll the discrimination. */
export function asChoice<K extends string>(
  answer: ChoiceAnswer<string> | NoulAnswer | ScoreAnswer | undefined,
): ChoiceAnswer<K> | null {
  return answer?.type === 'choice' ? (answer as ChoiceAnswer<K>) : null
}

export function asNoul(answer: unknown): NoulAnswer | null {
  return answer && (answer as NoulAnswer).type === 'noul' ? (answer as NoulAnswer) : null
}
