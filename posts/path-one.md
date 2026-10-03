*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

**The agent's MCP endpoint:** `https://api.sanity.io/v1/context/organizations/ovihgdwkx/mcp/ninety`
**Live app:** https://web-eight-amber-6zft3r0kdf.vercel.app
**Context evidence page:** https://web-eight-amber-6zft3r0kdf.vercel.app/context
**Code:** https://github.com/PhiBao/beyond-vibe
**Sanity project:** `jvgi63fz` · dataset `production`

---

## The one rule that makes this agent worth trusting

Most travel assistants will confidently tell you how many Schengen days you have left. They will also be wrong sometimes, and you cannot tell which times.

So the agent in this submission is **architecturally forbidden from stating a number.**

It may retrieve, classify, explain and cite. Every figure it reports — days used, days remaining, the date you cross the limit — comes from a deterministic engine that makes no network calls and imports no model. The agent's system prompt is not asked nicely; the number is simply not available to it as something it produced.

```ts
// The engine. No model, no network, no env vars.
evaluate(snapshot, itinerary, {asOf})
// → {used: 73, attribution: {date: '2026-10-26', blame: [...]}, unresolvedDays: [...]}
```

```ts
// The agent's instructions.
1. Never state a day count, a total, a remaining balance, or the date on
   which a limit is crossed. You have no arithmetic authority. A tool result
   already contains every number you are allowed to report.
2. Answer only from the Sanity Context endpoint. If the context does not
   contain the rule, say the rule is not in the corpus and stop.
3. When two sources conflict, do not choose. Say they conflict, present both,
   and say that a person has to rule.
```

That is the whole thesis. Everything below is how the retrieval half of it is built.

---

## Sanity Context as the retrieval layer

The agent's knowledge is a hosted, read-only MCP endpoint. Not a hardcoded prompt, not a vector index built at deploy time — a Sanity-managed endpoint that serves the dataset's schema and answers GROQ on the wire.

It serves four tools:

| Tool | What the agent uses it for |
| --- | --- |
| `initial_context` | The schema overview: types, fields, relationships, document counts. What the agent knows exists before it asks anything. |
| `groq_query` | Structured retrieval with projections. How it gets the band that applies to a territory *on a specific date*. |
| `schema_explorer` | Field-level detail when the overview is not enough — e.g. whether `presenceRule` hides `presenceKind`. |
| `array_field_reader` | Reading `accessBands[]` and `competingClaims[]` without pulling whole documents into context. |

### This is live, not a description

The `/context` page on the deployment calls the endpoint server-side and prints what came back, including its failure modes. Everything on it was fetched when you loaded the page.

![Sanity Context](https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/13-context.png)

Reproduce it directly:

```bash
curl -s https://api.sanity.io/v1/context/organizations/ovihgdwkx/mcp/ninety \
  -H "Authorization: Bearer $SANITY_CONTEXT_TOKEN" \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

A live `groq_query` through Context, asking about the fact that makes the same fortnight cost fourteen days in Split in 2023 and nothing in 2022:

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

That is the whole product thesis in one payload. A keyword index returns the paragraph about Croatia joining in 2023. This returns the *bands*, which is what you need in order to answer a question about a specific day.

---

## Why the dataset has to be shaped this way

An agent's answer quality is bounded by the structure it can query. Four decisions do the work.

**Membership is a date-banded array, not a boolean.** `isSchengen: true` is a lie for any country that joined later, and it is the reason most assistants get Croatia and Bulgaria wrong. `accessBands[]` with `{from, to, counted, modes}` makes the question "was this in the area on this day, and by which route" answerable at all.

**Carve-outs are territories.** The Canary Islands, Madeira, Åland, Svalbard, the French overseas departments, Ireland and Cyprus are each their own `territory` document with their own bands. The agent can therefore say *where* a day was spent, which is also what makes attribution possible.

**Ambiguity is a value, not an exception.** A `presenceRule` can be `counted`, `not_counted`, or `disputed`. When it is `disputed` the engine refuses to classify a day of that kind and the agent is required to present both readings and name the disagreement. It cannot resolve it, because there is nothing in the corpus to resolve it with.

**Every rule resolves to a source.** Each band, presence rule and regime carries `sourceRef[]` to a real document with a publisher, a URL and a retrieval date. The agent's citations are therefore checkable rather than plausible — and so is the absence of a citation, which is what tells the agent to stop.

---

## The agent, concretely

`POST /api/ask` takes a question and, optionally, an itinerary.

1. If an itinerary is supplied, the **engine runs first**. Its verdict is serialised into the system prompt as the authoritative answer. This is deliberate: it means the number is in context before the model can reason about anything, so there is nothing left for it to calculate.
2. The MCP client connects to the Context endpoint and exposes its four tools to the model.
3. The model answers, citing source titles, and is forbidden from producing a number.

The endpoint returns `503` with an explicit reason when either the organisation token or a model key is absent, rather than half-working:

```json
{"ok":false,"error":"not_configured","what":"the model",
 "hint":"Set ANTHROPIC_API_KEY. Ninety will not answer from a corpus without a reasoner in front of it."}
```

**Honesty note:** the deployment I am submitting does not ship a model key, so `POST /api/ask` currently returns that 503. The Context integration is live and verifiable — the `/context` page and the `curl` above both work against the real endpoint — but the language-model step is gated. I would rather say that plainly than post a transcript I cannot reproduce.

---

## Does the structured content actually earn its keep?

The challenge's own test: *if a keyword search would have gotten you the same answer, aim higher.* So I measured it.

Two systems, the same corpus, 22 adversarial histories with hand-computed expectations written before the runner existed, so the runner cannot grade itself. **Neither arm uses a language model** — the point is to isolate the contribution of the content structure, and this way anyone can rerun it with `pnpm eval`.

| Measure | Structured (GROQ + engine) | Keyword search (BM25, same rules) |
| --- | --- | --- |
| Correct answer | **22/22** | **1/22** |
| Produced a day count | 20/22 | 0/22 |
| Named the exact breach date | 1/1 | 0/1 |
| Refused instead of guessing | 2/2 | n/a |

Full results with the reasoning for each case: [`web/eval/RESULTS.md`](https://github.com/PhiBao/beyond-vibe/blob/main/web/eval/RESULTS.md)

The keyword arm is not handicapped. It is given the same territory records, the same presence rules, the same permit exemptions and the same precedents, flattened into prose, and it scores BM25 over them. It frequently retrieves the right paragraph.

It cannot produce a verdict, and the reason is worth stating plainly:

> **The corpus holds the rules, and never held the traveller.**

"I have eleven trips logged this year and one booked — am I still legal?" is not a retrieval problem. It is a join between the rule and eleven date ranges, two of which fall in carve-outs, one of which nobody has ruled on, evaluated day by day across a rolling window. Retrieval finds the paragraphs. It cannot join them to a calendar.

---

## Knowledge Bases

I want to be straight about this one: Ninety does **not** use a Sanity Knowledge Base, and the rubric asks for one.

What it uses is the dataset served through Context, which covers the structured half of the problem — the rules — but not the prose half. The EU guidance documents that the corpus cites are currently referenced as sources, not ingested as searchable text. So an agent question like *"why is a same-day transit not a stay?"* can be answered from the structured rule and its citation, but cannot yet quote the underlying paragraph.

Ingesting those documents as a Knowledge Base is the next step, and it is the step that would let the agent say *"the border-crossing page says X, the visa-policy page says Y, and that is why the day is disputed"* instead of citing two titles and stopping. I would rather name the gap than imply it is closed.

---

## Code

https://github.com/PhiBao/beyond-vibe

```
web/src/lib/sanity/context.ts   JSON-RPC client for the Context MCP endpoint
web/src/app/context/page.tsx    The evidence page, rendered server-side
web/src/app/api/ask/route.ts    The agent
web/src/lib/engine/             Pure TypeScript. No model, no network.
web/scripts/eval/               The 22-case evaluation
```

A note on why `context.ts` speaks raw JSON-RPC instead of going through the agent SDK: the diagnostics should show what an agent actually receives on the wire, not what a library chooses to show it. Every function degrades to a typed `unavailable` result instead of throwing, so the evidence page reports a missing credential plainly rather than pretending the integration exists.

There are 40 engine tests covering the things that are easy to get wrong — that the arrival day counts and the departure day does not, that a same-day visit is one day, that 1–29 February 2024 costs 28 days and the same calendar span in 2026 costs 27, that a pending application is not a permit, and that an air arrival into Sofia in February 2025 is not the same journey as a train.

---

## Sanity Project Details

- **Project ID:** `jvgi63fz` · **Dataset:** `production`
- **Studio:** https://beyond-vibe.sanity.studio
- **Contents:** 5 sources, 1 allowance, 36 territories with date-banded access, 3 nationality classes, 3 visa regimes, 5 permit exemptions, 6 presence rules, 2 itineraries with 17 trips, 1 open dispute.
- **Reproduce:** `pnpm --dir web seed && pnpm --dir web verify:data && pnpm --dir web eval`

---

## What I got wrong, since it is relevant here

**Context did not work until the Studio was deployed.** For most of this build the endpoint answered `Only datasets with deployed Studio applications are supported`. It was never an authorisation problem in the end — I had assumed that, and burned time on it. Deploying the Studio at https://beyond-vibe.sanity.studio fixed it in one command.

**The adjudication path silently no-oped in production.** A partial `patch` on a dispute document with nested typed objects returned `200` and changed nothing. The precedent it pointed at had already been written. I only found it because I checked the dataset instead of trusting the status code. Both the write and the reset now use a full document replace, and failures surface as a `503` with the underlying message.

**The module-level snapshot cache never expired.** Fine in a script, wrong on Vercel: a warm lambda served stale rules and the demo appeared to ignore its own adjudication. Thirty seconds fixed it. I would have shipped that bug if I had recorded the demo against localhost instead of the deployed site.

---

Not legal advice. It covers a handful of passport classes and refuses outside that coverage, which is the only behaviour that makes it safe to trust. 🤖
