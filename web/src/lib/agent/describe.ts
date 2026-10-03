/**
 * Reading a trip out of plain language.
 *
 * Date extraction is done here, in code, because it is arithmetic and it must
 * be exact. Only the genuinely semantic parts — which territory, which kind of
 * presence — are handed to a model, and those are answered by a typed judgment
 * rather than by generation.
 *
 * The split matters: a model asked to "parse this trip" will quietly return a
 * plausible wrong date, and a wrong date is a wrong verdict. A model asked to
 * "choose between these six territories" cannot invent a seventh.
 */

/** One described leg of a journey, before anything has been resolved. */
export interface DescribedStay {
  index: number
  /** The words the traveller used for the place. */
  placeText: string
  /** The words the traveller used for how they travelled, if any. */
  modeText: string | null
  /** Anything else in the sentence worth passing to the classifier. */
  contextText: string
  arrive: string
  depart: string
  /**
   * What the traveller own words suggest the presence kind is, when they say
   * something about airports or immigration. A hint for the classifier, not a
   * decision.
   */
  hintedKind?: 'airport_transit' | 'airport_transit_landside'
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  // Reject dates that rolled over, e.g. 31 February.
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return d.toISOString().slice(0, 10)
}

type Candidate = {arrive: string; depart: string; start: number; length: number}

const RANGE_CONNECTOR = '(?:\\s*(?:-|–|—|to|until|till|through)\\s*)'
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?'
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*'

/**
 * Find every date range the text states.
 *
 * Patterns are tried broadest-first and overlapping matches are discarded in
 * favour of the longer, more specific one. Without that step "1 to 21 February
 * 2026" is also a valid match for the single-date pattern on "21 February 2026",
 * and the description comes back as two stays instead of one.
 */
function extractDates(text: string): Candidate[] {
  const lower = text.toLowerCase()
  const candidates: Candidate[] = []

  const push = (arrive: string | null, depart: string | null, index: number, length: number) => {
    if (arrive && depart) candidates.push({arrive, depart, start: index, length})
  }

  // ISO ranges, then bare ISO dates. Unambiguous, so they go first.
  const isoRange = /(\d{4}-\d{2}-\d{2})\s*(?:-|–|—|to|until|till)\s*(\d{4}-\d{2}-\d{2})/g
  for (const m of lower.matchAll(isoRange)) push(m[1], m[2], m.index, m[0].length)

  const isoDate = /\b(\d{4})-(\d{2})-(\d{2})\b/g
  for (const m of lower.matchAll(isoDate)) {
    const v = iso(Number(m[1]), Number(m[2]), Number(m[3]))
    push(v, v, m.index, m[0].length)
  }

  // "12 March 2026 to 26 April 2026"
  const longRange = new RegExp(
    `${DAY}\\s+${MONTH}\\s+(\\d{4})${RANGE_CONNECTOR}${DAY}\\s+${MONTH}\\s+(\\d{4})`,
    'g',
  )
  for (const m of lower.matchAll(longRange)) {
    push(
      iso(Number(m[3]), MONTHS[m[2]], Number(m[1])),
      iso(Number(m[6]), MONTHS[m[5]], Number(m[4])),
      m.index,
      m[0].length,
    )
  }

  // "1 to 21 February 2026"
  const sharedMonth = new RegExp(
    `${DAY}${RANGE_CONNECTOR}${DAY}\\s+${MONTH}(?:\\s+(\\d{4}))?`,
    'g',
  )
  for (const m of lower.matchAll(sharedMonth)) {
    const year = m[4] ? Number(m[4]) : new Date().getUTCFullYear()
    push(
      iso(year, MONTHS[m[3]], Number(m[1])),
      iso(year, MONTHS[m[3]], Number(m[2])),
      m.index,
      m[0].length,
    )
  }

  // "March 12 to 26, 2026"
  const monthFirst = new RegExp(
    `${MONTH}\\s+${DAY}${RANGE_CONNECTOR}${DAY}(?:,?\\s*(\\d{4}))?`,
    'g',
  )
  for (const m of lower.matchAll(monthFirst)) {
    const year = m[4] ? Number(m[4]) : new Date().getUTCFullYear()
    push(
      iso(year, MONTHS[m[1]], Number(m[2])),
      iso(year, MONTHS[m[1]], Number(m[3])),
      m.index,
      m[0].length,
    )
  }

  // A single stated date is a same-day visit.
  const dayMonth = new RegExp(`${DAY}\\s+${MONTH}(?:\\s+(\\d{4}))?`, 'g')
  for (const m of lower.matchAll(dayMonth)) {
    const v = iso(Number(m[3] ?? new Date().getUTCFullYear()), MONTHS[m[2]], Number(m[1]))
    push(v, v, m.index, m[0].length)
  }

  // Prefer the longest match, then drop anything that overlaps one already kept.
  candidates.sort((a, b) => (a.start !== b.start ? a.start - b.start : b.length - a.length))
  const kept: Candidate[] = []
  for (const c of candidates) {
    const overlaps = kept.some((k) => c.start < k.start + k.length && k.start < c.start + c.length)
    if (!overlaps) kept.push(c)
  }

  // Then merge duplicates and order by date.
  const seen = new Set<string>()
  return kept
    .filter((c) => {
      const key = `${c.arrive}|${c.depart}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (a.arrive === b.arrive ? a.depart.localeCompare(b.depart) : a.arrive.localeCompare(b.arrive)))
}

/** Words that describe how the traveller moved, and therefore which band applies. */
const MODE_WORDS: Array<{re: RegExp; mode: 'air' | 'land' | 'sea'; phrase: string}> = [
  {re: /\b(flight|flew|fly|flying|plane|air|airport|aeroplane)\b/, mode: 'air', phrase: 'travelled by air'},
  {re: /\b(train|rail|overland|land border|car|coach|bus)\b/, mode: 'land', phrase: 'crossed overland'},
  {re: /\b(ship|ferry|sea|boat|sail|cruise)\b/, mode: 'sea', phrase: 'crossed by sea'},
]

const TRANSIT_WORDS = /\b(airport|transit|layover|lay-over|connection|stopover|stop-over|transfer)\b/
const CLEARED_WORDS = /\b(immigration|passport control|border control|cleared|clearing|landside|left the airport)\b/
/**
 * "Never cleared immigration" contains "cleared immigration", so a plain keyword
 * test reads it as the opposite of what the traveller meant — and this is the
 * single distinction that decides whether the day is charged. Negation has to be
 * removed before the keyword is trusted.
 */
const NEGATED_CLEARED =
  /\b(?:never|didn'?t|did not|without|no|not)\b[^.;]{0,24}\b(?:clear|passport control|border control|immigration|landside)/

/**
 * Clause boundaries, by character offset.
 *
 * Matching each date to its clause positionally matters more than it looks: an
 * earlier version searched each clause for the ISO fragment of the date, which
 * never appears in human text, so every stay in a multi-trip description
 * inherited the first clause and was classified against the wrong place.
 */
function clauseSpans(text: string): Array<{start: number; end: number}> {
  const bounds: number[] = [0]
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (c === '\n' || c === ';' || c === '.' || c === '!' || c === '?') {
      bounds.push(i + 1)
      continue
    }
    if (c === ',') {
      if (/^\s*(?:and then|then|also|after that|next|and i)\b/.test(text.slice(i + 1, i + 30))) {
        bounds.push(i + 1)
      }
    }
  }
  bounds.push(text.length)
  return bounds
    .slice(0, -1)
    .map((s, i) => ({start: s, end: bounds[i + 1]}))
    .filter((s) => s.end > s.start)
}

/**
 * Strip the date expression so the remaining words are about the place.
 *
 * String.raw is load-bearing here. In a plain template literal `\s` collapses to
 * `s`, so these patterns quietly became "match a literal s" and removed nothing.
 * A regex that silently matches nothing is worse than one that throws.
 */
function stripDates(clause: string): string {
  return clause
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(
      new RegExp(
        String.raw`${DAY}\s*(?:-|–|to|until|till)?\s*${DAY}?\s*${MONTH}(?:\s+\d{4})?`,
        'gi',
      ),
      ' ',
    )
    .replace(new RegExp(String.raw`${DAY}\s+${MONTH}(?:\s+\d{4})?`, 'gi'), ' ')
    .replace(
      new RegExp(
        String.raw`${MONTH}\s+${DAY}(?:\s*(?:-|–|to|until|till)\s*${DAY})?(?:,?\s*\d{4})?`,
        'gi',
      ),
      ' ',
    )
    .replace(
      /\b(from|between|and|until|till|through|to|in|for|about|around|roughly|lasted|stayed|days?|nights?)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .replace(/^\s*[,.\-–]+\s*|\s*[,.\-–]+\s*$/g, '')
    // Removing dates can strand a preposition that referred to them, as in
    // "layover on 3 June 2026" becoming "layover on". Those read as noise to the
    // classifier, so drop a trailing preposition with nothing after it.
    .replace(/\s+(?:on|in|at|from|to|until|till|by|for|during|of)\s*$/i, '')
    .replace(/^\s+(?:on|in|at|from|to|until|till|by|for|during|of)\s+/i, '')
    .trim()
}

/**
 * Split free text into described stays.
 *
 * Deliberately conservative: it extracts only what is stated, and hands the
 * classifier the traveller own words rather than a paraphrase.
 */
export function describeTrips(text: string): DescribedStay[] {
  const lower = text.toLowerCase()
  const dates = extractDates(lower)
  if (dates.length === 0) return []

  const spans = clauseSpans(lower)

  return dates.map((d, i) => {
    const from = d.start
    const to = d.start + d.length

    // The clause containing this date, by position.
    const span =
      spans.find((c) => from >= c.start && to <= c.end) ??
      // No boundary nearby: take a window around the date.
      {start: Math.max(0, from - 80), end: Math.min(lower.length, to + 80)}

    const clause = lower.slice(span.start, span.end)
    const placeText = stripDates(clause) || clause.slice(0, 80)

    const mode = MODE_WORDS.find((m) => m.re.test(clause))
    const mentionsTransit = TRANSIT_WORDS.test(clause)
    const clearedWithoutNegation = CLEARED_WORDS.test(clause) && !NEGATED_CLEARED.test(clause)

    const kind = !mentionsTransit
      ? 'cleared_entry'
      : clearedWithoutNegation
        ? 'airport_transit_landside'
        : 'airport_transit'

    return {
      index: i,
      placeText,
      modeText: mode ? mode.phrase : null,
      contextText: clause,
      arrive: d.arrive,
      depart: d.depart,
      // Deterministic hint from the words used; the classifier confirms or overrides it.
      ...(kind !== 'cleared_entry' ? {hintedKind: kind} : {}),
    }
  })
}

/** How a described stay was understood, for the interface to show. */
export interface ResolvedStay extends DescribedStay {
  territoryCode: string
  territoryName: string
  territoryKind: 'state' | 'carve_out' | 'external'
  /** Whether this territory is inside the area on the days of this stay. */
  countsTowardsAllowance: boolean
  presenceKind: string
  presenceLabel: string
  presenceDisputed: boolean
  confidence: number
  probabilities: Record<string, number>
  /** Set when the agent is not confident enough to answer. */
  uncertain: boolean
}
