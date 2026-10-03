*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

**The agent's MCP endpoint:** `https://api.sanity.io/v1/context/organizations/ovihgdwkx/mcp/ninety`
**Live app:** https://web-eight-amber-6zft3r0kdf.vercel.app
**Context evidence page:** https://web-eight-amber-6zft3r0kdf.vercel.app/context
**Code:** https://github.com/PhiBao/beyond-vibe
**Sanity project:** `jvgi63fz` · dataset `production` · Studio: https://beyond-vibe.sanity.studio

---

## The rule the whole agent is built around

Most travel assistants will confidently tell you how many days you have left. They will also be wrong sometimes, and you cannot tell which times.

So the agent in this submission is **architecturally forbidden from stating a number.**

```ts
// The engine. No model, no network, no env vars.
evaluate(snapshot, itinerary, {asOf})
// → {used: 73, attribution: {date: '2026-10-26', blame: [...]}, unresolvedDays: [...]}
```

The model may retrieve, classify, explain and cite. Every figure it reports comes from that engine. The split is not stylistic — it is the reason I did not use a language model at all.

## What the agent actually is

Type **"three weeks on Tenerife, then an 8 hour airport layover where I never cleared immigration"** and it works out what that is, then what it costs.

![The agent](https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/15-agent.png)

It resolves to three separate reads: **Bulgaria by train — 10 days counted**, from the date-banded rule that opened its land crossings on 31 December 2024. An **airport transit with no place named — no days counted**, at 100%. And in between, a leg it is only about 50% sure about, so it refuses that one.

That last behaviour is the whole point. In the middle of that sentence, *"flew to Paris 20 to 25 February"* is a fragment, and the agent says so rather than guessing. A chat completion would have answered it fluently and been indistinguishable from a correct answer.

### The pipeline

```
traveller's words
     │
     ├─ date extraction            deterministic, in code, unit-tested
     │
     ├─ Sanity Context (MCP)  ──▶  the candidate set. Retrieved, never invented.
     │                              groq_query over territory + presenceRule
     │
     ├─ TypeSafe System One   ──▶  typed classification + calibrated confidence
     │                              {choice, probabilities, confidence}
     │
     └─ the engine            ──▶  every number in the answer
```

Three properties fall out of that, and each one was bought by a bug I hit while building it:

**1. It cannot invent a place.** The territory list is retrieved from the corpus at request time. If a place is not there, there is no option to select, so the output is `"No place named"`. Not a guess at the nearest match — the set does not contain one.

**2. It cannot do arithmetic.** Classification goes through TypeSafe's System One models, which return a value from a set I defined plus the full probability distribution. They are not text generators; there is no channel through which `90` could travel. The whole web app has **five runtime dependencies and no model-provider SDK at all**.

**3. It can say it does not know.** Below 0.62 confidence the read is reported as uncertain rather than answered.

One consequence worth stating, because it is a bug I shipped and then caught: the classifier also answers *"would this person be present somewhere that counts against the allowance?"*, and it does not know that Bulgaria's land crossings were internal in February 2025. So it says no for Sofia-by-train. The engine, which does know, charges ten days. Rather than show two contradicting labels, **the "N days counted" figure is read back out of the ledger the engine actually produced** — the classifier never gets to have an opinion about charging.

---

## Sanity Context as the retrieval layer

The agent's knowledge is a hosted, read-only MCP endpoint. Not a hardcoded prompt, not a vector index built at deploy time — a Sanity-managed endpoint that serves the dataset's schema and answers GROQ on the wire.

| Tool | What the agent uses it for |
| --- | --- |
| `initial_context` | Schema overview: types, fields, relationships, document counts |
| `groq_query` | Structured retrieval with projections — the candidate set, every request |
| `schema_explorer` | Field-level detail when the overview is not enough |
| `array_field_reader` | Reading `accessBands[]` and `competingClaims[]` without pulling whole documents into context |

### This is live, not a description

The `/context` page calls the endpoint server-side and prints what came back, including its failure modes. Everything on it was fetched when you loaded the page.

![Sanity Context](https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/13-context.png)

Reproduce it:

```bash
curl -s https://api.sanity.io/v1/context/organizations/ovihgdwkx/mcp/ninety \
  -H "Authorization: Bearer $SANITY_CONTEXT_TOKEN" \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

And a live `groq_query` through Context, asking about the fact that makes the same fortnight cost fourteen days in Split in 2023 and nothing in 2022:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call",
 "params":{"name":"groq_query","arguments":{"query":
   "*[_type==\"territory\"&&code==\"HR\"][0]{name,\"bands\":accessBands[]{window{from,to},counted,modes}}"}}}
```

```json
{"name":"Croatia","bands":[
  {"counted":false,"window":{"from":"2000-01-01","to":"2023-01-01"}},
  {"counted":true, "window":{"from":"2023-01-01","to":null}}]}
```

That is the product thesis in one payload. A keyword index returns the paragraph about Croatia joining in 2023. This returns the *bands*, which is what you need in order to answer a question about a specific day.

---

## Why the dataset has to be shaped this way

An agent's answer quality is bounded by the structure it can query. Four decisions do the work.

**Membership is a date-banded array, not a boolean.** `isSchengen: true` is a lie for any country that joined later, and it is the reason most assistants get Croatia and Bulgaria wrong. `accessBands[]` with `{from, to, counted, modes}` makes *"was this in the area on this day, and by which route"* answerable at all.

**Carve-outs are territories.** The Canary Islands, Madeira, Åland, Svalbard, the French overseas departments, Ireland, Cyprus and Iceland are each their own `territory` document with their own bands. The agent can therefore say *where* a day was spent, which is also what makes attribution possible.

**Ambiguity is a value, not an exception.** A `presenceRule` can be `counted`, `not_counted`, or `disputed`. When it is `disputed` the engine refuses to classify a day of that kind, and the agent is required to present both readings and name the disagreement. It cannot resolve it, because there is nothing in the corpus to resolve it with.

**Every rule resolves to a source.** Each band, presence rule and regime carries `sourceRef[]` to a real document with a publisher, a URL and a retrieval date. The agent's citations are checkable rather than plausible — and so is the *absence* of one, which is what tells the agent to stop.

---

## Does the structured content actually earn its keep?

The challenge's own test: *if a keyword search would have gotten you the same answer, aim higher.* So I measured it.

Two systems, the same corpus, 23 adversarial histories with hand-computed expectations written before the runner existed, so the runner cannot grade itself. **Neither arm uses a language model** — the point is to isolate the contribution of the content structure, and this way anyone can rerun it with `pnpm eval`.

| Measure | Structured (GROQ + engine) | Keyword search (BM25, same rules) |
| --- | --- | --- |
| Correct answer | **23/23** | **1/23** |
| Produced a day count | 21/23 | 0/23 |
| Named the exact breach date | 1/1 | 0/1 |
| Refused instead of guessing | 2/2 | n/a |

Full results with the reasoning for each case: [`web/eval/RESULTS.md`](https://github.com/PhiBao/beyond-vibe/blob/main/web/eval/RESULTS.md)

The keyword arm is not handicapped. It is given the same territory records, the same presence rules, the same permit exemptions and the same precedents, flattened into prose, and it scores BM25 over them. It frequently retrieves the right paragraph.

It cannot produce a verdict, and the reason is worth stating plainly:

> **The corpus holds the rules, and never held the traveller.**

"I have eleven trips logged this year and one booked — am I still legal?" is not a retrieval problem. It is a join between the rule and eleven date ranges, two of which fall in carve-outs, one of which nobody has ruled on, evaluated day by day across a rolling window. Retrieval finds the paragraphs. It cannot join them to a calendar.

---

## Knowledge Bases

Being straight about this one: Ninety does **not** use a Sanity Knowledge Base, and the rubric asks for one.

What it uses is the dataset served through Context, which covers the structured half of the problem — the rules — but not the prose half. The EU guidance documents the corpus cites are currently referenced as sources, not ingested as searchable text. So an agent question like *"why is a same-day transit not a stay?"* can be answered from the structured rule and its citation, but cannot yet quote the underlying paragraph.

Ingesting those documents as a Knowledge Base is the next step, and it is the step that would let the agent say *"the border-crossing page says X, the visa-policy page says Y, and that is why the day is disputed"* instead of citing two titles and stopping. I would rather name the gap than imply it is closed.

---

## Code

https://github.com/PhiBao/beyond-vibe

```
infra/sanity.blueprint.ts        infrastructure: CORS origin + the guard function
infra/functions/                 a Sanity Function that enforces the invariant
web/src/lib/agent/describe.ts    free text → dated stays, deterministically
web/src/lib/agent/typesafe.ts    typed client for the System One primitives
web/src/lib/agent/resolve.ts     retrieve candidates, classify, hand off
web/src/lib/sanity/context.ts    JSON-RPC client for the Context MCP endpoint
web/src/app/context/page.tsx     the evidence page, rendered server-side
web/src/lib/engine/              pure TypeScript. No model, no network.
web/scripts/eval/                the 23-case evaluation
```

A note on why `context.ts` speaks raw JSON-RPC instead of going through an agent SDK: the diagnostics should show what an agent actually receives on the wire, not what a library chooses to show it. Every function degrades to a typed `unavailable` result instead of throwing, so the evidence page reports a missing credential plainly rather than pretending the integration exists.

There are 56 unit tests. The ones that matter most here are about the free-text layer, because that is where the model is closest to the answer:

- that `"1 to 21 February 2026"` is one stay and not two
- that `"30 to 31 February 2026"` is rejected rather than rolled into March
- that *"flew to Paris"* and *"took the train into Sofia"* in the same sentence each get their own place, their own mode, and their own classification
- that *"never cleared immigration"* is an airside transit, not a cleared one — the one distinction that decides whether the day is charged

---

## What I got wrong, since it is relevant here

**Context did not work until the Studio was deployed.** For most of this build the endpoint answered `Only datasets with deployed Studio applications are supported`. It was never an authorisation problem in the end — I had assumed that, and burned time on it. Deploying the Studio fixed it in one command.

**Asking N questions about an array of N stays does not bind question *i* to stay *i*.** I batched all the classifications into one request to save latency. The state was an array of stays and each question said "this description", so an 8-hour airport layover in the second stay got classified as the Canary Islands because the first stay mentioned Tenerife. One request per stay now. Cheaper in latency than it sounds, because each request is small.

**`\s` in a template literal collapses to `s`.** My date-stripping regexes compiled into "match a literal s" and silently removed nothing, so the classifier was being handed *"layover on 3 June 2026"* with the date still in it. A regex that silently matches nothing is worse than one that throws.

**Two evaluation cases were passing for the wrong reason.** I had written a territory code as `es-canary`, which is a document *key*; the code is `XCI`. The engine's response to an unknown territory is a warning and zero charged days — so the case passed because the Canary days had been dropped rather than classified. The number was right and the reasoning was nonsense. `pnpm check:codes` now fails the build if any case contains a dropped stay.

**A Sanity Function that guards the invariant failed in three ways that all looked like success.** The agent's correctness rests on a ruling being recorded as a precedent, so I added a document function to enforce that wherever the dispute is adjudicated — including in the Studio, bypassing the app. It wrote the precedent fine, then:

- `client.patch()` is lazy in `@sanity/client` v8. The handler awaited it, logged "attached precedent to dispute", and changed nothing.
- A transaction id derived from the document id looks like idempotency. Sanity remembers transaction ids permanently, so the second adjudication returned `transactionAlreadyExistsError` and the function failed forever after, silently.
- The guard read a denormalised `presenceKind` that the document does not have, so it declined to act on a dispute whose `subjectKind` was plainly `presence_kind`. It now resolves the kind through the reference.

That third one generalises. A guard that refuses because it looked in the wrong place is worse than no guard: it turns a loud failure into a quiet one. Every check in this repo looks at what the system *did*, not at whether it reported success.

**I had Iceland in the Schengen Area.** It is EEA, not Schengen, and my corpus said otherwise because I had used a shared helper that stamped the founding date onto every state. Reykjavík days were being charged against 90/180 — a mistake a lot of tools make, made silently, in the one file I was treating as ground truth.

---

Not legal advice. It covers a handful of passport classes and refuses outside that coverage, which is the only behaviour that makes it safe to trust. 🤖
