# Ninety

**Know the exact day you went over.**

Ninety computes a short-stay travel allowance day by day, names the exact date the
limit is crossed, and hands you the smallest edit that prevents it. Every
classification resolves to a cited source, and when the sources genuinely
disagree it refuses to guess and asks a person to rule.

You can type a trip as structured dates, or describe it the way you would to a
friend — *"three weeks on Tenerife, then an 8 hour layover where I never cleared
immigration"* — and an agent works out what it means before the engine counts it.

> Every short-stay calculator tells you how many days you have used. None of them
> tell you the day you went over.

Live: **https://web-eight-amber-6zft3r0kdf.vercel.app**
Sanity project: `jvgi63fz` · dataset `production` · Studio at https://beyond-vibe.sanity.studio

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
| **Names the breach** | "On 26 October the window reaches 91 days." Not "you are over." |
| **Attributes it** | Names the trip that put you over, and the exact day. |
| **Repairs it** | "Leave on the 26th, not the 27th." |
| **Explains every day** | Click any day: why it counted, and the authority behind it. |
| **Refuses** | Unknown passport, unknown status, contested rule → a visible refusal. |
| **Remembers rulings** | When sources conflict, a person rules once; later calculations read that ruling. |
| **Reads plain language** | Describe a trip; the agent resolves it against the corpus and shows its confidence. |

## The evaluation

Two systems, the same corpus, 23 adversarial histories with hand-computed
expectations. Neither arm uses a language model, so anyone can reproduce it.

```
pnpm eval
```

| Measure | Structured (GROQ + engine) | Keyword search (BM25, same rules) |
| --- | --- | --- |
| Correct answer | **23/23** | **1/23** |
| Produced a day count | 21/23 | 0/23 |
| Named the exact breach date | 1/1 | 0/1 |
| Refused instead of guessing | 2/2 | n/a |

Full results, including why each case is hard: [`web/eval/RESULTS.md`](./web/eval/RESULTS.md).

The keyword arm is not handicapped by a weak index. It sees the same territory
records, the same presence rules, the same permit exemptions and the same
precedents, flattened into prose. It simply cannot join them to a calendar —
because **the corpus holds the rules, and never held the traveller.**

## Architecture

```
infra/      Sanity Blueprints. The CORS origin and a document function.
studio/     Sanity Studio, standalone. 11 document types, 7 object types.
web/        Next.js 16 App Router.
  src/lib/engine/     Pure TypeScript. No Sanity client, no model, no env vars.
  src/lib/agent/      The agent: retrieve, classify, then hand off to the engine.
  src/lib/data/       The authored corpus, shared by the tests and the seed.
  src/lib/sanity/     GROQ, the snapshot loader, the Sanity Context client.
  scripts/            Seed, verification, evaluation, demo recording.
```

### The engine is the product

`src/lib/engine/evaluate.ts` contains **no model call and no network call**. It
takes a snapshot of the rules and an itinerary, and returns a verdict. The same
inputs always produce the same answer, and you can check it by hand.

There are 56 tests. They cover the things that are genuinely easy to get wrong:
that the day of arrival counts and the day of departure does not, that a same-day
visit is one day, that 1–29 February 2024 costs 28 days and the same calendar span
in 2026 costs 27, that a pending application is not a permit, that Iceland is EEA
but not Schengen, and that an air arrival into Sofia in February 2025 is not the
same journey as a train.

### The agent has exactly one job

Someone describes a trip the way they would to a friend. The agent works out what
that trip *is*. It has no authority over what it *costs*.

```
traveller's words
     │
     ├─ Sanity Context (MCP)  →  the candidate set. Retrieved, never invented.
     │
     ├─ TypeSafe System One   →  typed classification + calibrated confidence.
     │                            A value from a set we defined, not prose.
     │
     └─ the engine            →  every number in the answer
```

Three properties follow from that split, and each one was bought by a bug:

**The agent cannot invent a place.** The territory list comes from
`groq_query` against Sanity Context, so if a place is not in the corpus there is
no option to choose and the correct outcome is "no place named".

**The agent cannot do arithmetic.** Jev returns `{choice, probabilities,
confidence}` — a value from a set we defined, plus how sure it is. There is no
channel through which a day count could travel.

**The agent can say it does not know.** Below 0.62 confidence the read is reported
as uncertain rather than answered. Describing *"flew to Paris 20 to 25 February"*
in the middle of a longer sentence currently lands at ~0.50 and is refused, which
is the behaviour I want in this domain and would not have got from a
chat completion.

Note the dependency count: the agent needs no chat-model SDK. `dependencies` is
four packages, none of which is a model provider.

### The schema is the argument

```
source ──┬─ allowance ── visaRegime ── nationalityClass
         ├─ territory ── accessBand[]        (date-banded, mode-aware)
         ├─ presenceRule                      (counted / not_counted / disputed)
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
pnpm --dir infra install

pnpm --dir studio dev            # Studio on :3333
pnpm --dir web dev               # app on :3000

# Checks, in the order they earn their keep
pnpm --dir web test              # 56 unit tests
pnpm --dir web check:codes       # every territory code the product uses resolves
pnpm --dir web check:fallback    # the bundled corpus agrees with Sanity
pnpm --dir web eval              # reproduce the table above
pnpm --dir web agent:check       # the agent on five awkward descriptions

pnpm --dir web seed              # write the corpus into Sanity (idempotent)
pnpm --dir web verify:data       # prove Sanity serves a usable snapshot
pnpm --dir web record            # drive the deployed app and capture the video

pnpm --dir infra bp:plan         # preview infrastructure changes
pnpm --dir infra bp:deploy       # apply them
pnpm --dir infra bp:logs         # what the guard has been doing
```

`check:codes` exists because a territory mismatch is **invisible by construction**:
an unknown code produces a warning and zero charged days, so a test written against
the wrong code passes for the wrong reason. That happened, and it is now a
failing check rather than a latent lie.

### Environment

```
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
SANITY_API_TOKEN              # project-scoped; needed because the dataset is private
SANITY_API_READ_TOKEN
SANITY_ORG_ID                 # enables the /context evidence page
SANITY_CONTEXT_TOKEN          # organisation token with Context Viewer
TYPESAFE_API_KEY              # enables POST /api/ask
```

The Context and agent integrations are **optional by design**. The verdict does not
depend on either: it comes from GROQ plus the deterministic engine. `/context` and
`/api/ask` report plainly when they are not configured rather than pretending.

## Infrastructure is declared, not clicked

`infra/sanity.blueprint.ts` declares the CORS origin the app reads through and a
document function. `blueprints plan` shows the diff before anything is applied.

The function enforces the product's central invariant in the data layer: **any
dispute marked `adjudicated` has a `precedent` behind it**, whoever adjudicated
it. That path is real — a dispute can be edited in the Studio rather than through
the desk — and it is precisely how this build once shipped a ruling that wrote
its precedent and left the dispute open while the product looked fine.

The Studio application is not in the blueprint on purpose. `sanity deploy` owns it,
Blueprints refuses to adopt a hostname that already exists, and the deployment is
load-bearing for the agent anyway: Sanity Context refuses to serve a dataset whose
Studio has never been deployed.

## What this is not

Not legal advice, and not a complete immigration reference. It is an estimate built
from cited public guidance, covering the Schengen short-stay allowance for a
handful of passport classes. It refuses rather than guesses outside that coverage,
which is the only behaviour that makes it safe to trust at all.
