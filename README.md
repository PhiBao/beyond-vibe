# Ninety

**Know the exact day you went over.**

Ninety computes a short-stay travel allowance day by day, names the exact date the
limit is crossed, and hands you the smallest edit that prevents it. Every
classification resolves to a cited source, and when the sources genuinely
disagree it refuses to guess and asks a person to rule.

> Every short-stay calculator tells you how many days you have used. None of them
> tell you the day you went over.

Live: **https://web-eight-amber-6zft3r0kdf.vercel.app**
Sanity project: `jvgi63fz` · dataset `production`

---

## The idea

The 90-in-any-180 rule is a **rolling window over your own history**. Almost
nobody can do it in their head, spreadsheets do not model it, and the tools that
claim to help either hand you a date-entry form or a confident number with no
reasoning behind it.

Real overstays are rarely caused by miscounting. They are caused by
**misclassification**: whether a day counts depends on territory membership *on
that date*, on your nationality class, on your permit, and on the nature of your
presence. That answer is not sitting in any single document. It is the result of a
join, evaluated day by day.

That is why this is a structured-content product and not a chat window.

## What it does

| | |
|---|---|
| **Names the breach** | "On 25 October the window reaches 91 days." Not "you are over." |
| **Attributes it** | Names the trip that put you over, and the exact day. |
| **Repairs it** | "Leave on the 25th rather than staying through the 27th." |
| **Explains every day** | Click any day: why it counted, and the authority behind it. |
| **Refuses** | Unknown passport, unknown status, contested rule → a visible refusal. |
| **Remembers rulings** | When sources conflict, a person rules once; every later calculation reads that ruling. |

## The evaluation

Two systems, the same corpus, 22 adversarial histories with hand-computed
expectations. Neither arm uses a language model, so anyone can reproduce it.

```
pnpm eval
```

| Measure | Structured (GROQ + engine) | Keyword search (BM25, same rules) |
| --- | --- | --- |
| Correct answer | **22/22** | **1/22** |
| Produced a day count | 20/22 | 0/22 |
| Named the exact breach date | 1/1 | 0/1 |
| Refused instead of guessing | 2/2 | n/a |

Full results, including why each case is hard: [`eval/RESULTS.md`](./eval/RESULTS.md).

The keyword arm is not handicapped by a weak index. It sees the same territory
records, the same presence rules, the same permit exemptions and the same
precedents, flattened into prose. It simply cannot join them to a calendar —
because **the corpus holds the rules, and never held the traveller.**

## Architecture

```
studio/     Sanity Studio, standalone. 12 document types, 7 object types.
web/        Next.js 16 App Router.
  src/lib/engine/     Pure TypeScript. No Sanity client, no model, no env vars.
  src/lib/data/       The authored corpus, shared by the tests and the seed.
  src/lib/sanity/     GROQ, the snapshot loader, the Sanity Context client.
  scripts/            Seed, verification, evaluation.
```

### The engine is the product

`src/lib/engine/evaluate.ts` contains **no model call and no network call**. It
takes a snapshot of the rules and an itinerary, and returns a verdict. The same
inputs always produce the same answer, and you can check it by hand.

The agent may retrieve, classify and explain. It is **structurally forbidden from
producing a number** — anything numeric comes from the engine. That is the
difference between an assistant that sounds careful and one that is.

### The schema is the argument

```
source ──┬─ allowance ── visaRegime ── nationalityClass
         ├─ territory ── accessBand[]        (date-banded, mode-aware)
         ├─ presenceRule                      (counted / disputed)
         └─ permitExemption

itinerary ── trip ── stay[]        dispute ── ruling ── precedent
```

Three modelling decisions carry the weight:

1. **Membership is a band, not a flag.** Croatia joined on 1 January 2023.
   Bulgaria and Romania opened land and sea crossings on 31 December 2024 but kept
   air borders external until 31 March 2025. A `counted: boolean` throws away
   exactly the information the product exists to surface — the same ten-day trip
   into Sofia counts overland and does not count by air in February 2025.

2. **Carve-outs are first-class territories.** The Canary Islands, Madeira, Åland,
   Svalbard and the French overseas departments are modelled as their own
   territories rather than flags on the parent state, so the ledger can name the
   exact place a day was spent.

3. **Ambiguity is data.** A `presenceRule` can be marked `disputed`. The engine
   then refuses to settle a day of that kind, reports a range, and routes it to an
   adjudication. A ruling becomes a `precedent` — typed, dated, attributed, and
   superseded rather than overwritten.

## Running it

```bash
pnpm --dir studio install
pnpm --dir web install

pnpm --dir studio dev            # Studio on :3333
pnpm --dir web dev               # app on :3000

pnpm --dir web test              # 40 engine tests
pnpm --dir web seed              # write the corpus into Sanity (idempotent)
pnpm --dir web verify:data       # prove Sanity serves a usable snapshot
pnpm --dir web eval              # reproduce the table above
```

### Environment

```
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
SANITY_API_TOKEN              # server only; needed because the dataset is private
SANITY_API_READ_TOKEN         # server only
SANITY_ORG_ID                 # optional: enables the /context evidence page
SANITY_CONTEXT_TOKEN          # optional: organisation token with Context Viewer
ANTHROPIC_API_KEY             # optional: enables POST /api/ask
```

The Context and agent integrations are **optional by design**. The verdict does
not depend on either: it comes from GROQ plus the deterministic engine. `/context`
and `/api/ask` report plainly when they are not configured rather than pretending.

## What this is not

Not legal advice, and not a complete immigration reference. It is an estimate
built from cited public guidance, covering the Schengen short-stay allowance for a
handful of passport classes. It refuses rather than guesses outside that coverage,
which is the only behaviour that makes it safe to trust at all.