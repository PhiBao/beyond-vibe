*This is a submission for the [Sanity Challenge, Path Two: Vibe-Code Something Strange](https://dev.to/challenges/sanity-2026-09-16)*

**Live:** https://web-eight-amber-6zft3r0kdf.vercel.app
**Code:** https://github.com/PhiBao/beyond-vibe
**Sanity project:** `jvgi63fz` · dataset `production` · Studio: https://beyond-vibe.sanity.studio

---

## What I Built

**Ninety** knows the exact day you went over.

Every Schengen short-stay calculator tells you *how many* days you have used. None of them tell you *which day* you crossed the line, *why* that day counted, or *what to change*. Ninety does all three.

It is a day accountant for the 90-in-any-180 rule. You give it your trips; it resolves the rules that apply on **each individual day**, counts a rolling window, and tells you:

- **73 of 90 days used** — and 17 remain
- **On 26 October the window reaches 91 days.** It is *Barcelona — booked* that puts you over.
- **Leave on the 26th, not the 27th.** Two days off the end of that trip fixes it.

Then it shows its work: every calendar day as a mark on a strip, colour-coded by whether it was charged, and clicking any day gives you the rule that decided it and the authority behind it.

![The verdict](https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/01-verdict.png)

### The three things it does that a calculator cannot

**1. It names the day, not just the number.**

![The day you went over](https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/02-breach-day.png)

Attribution is a real algorithm, not a caption. On the breach day the engine finds the rolling window, works out which days pushed the count past the limit, and maps them back to the trips that contained them.

**2. It classifies instead of adding.**

Days are not all alike, and this is where people actually get hurt:

- Three weeks in the **Canary Islands** — Spanish territory, outside the area. **0 days.**
- A month in **Dublin** — an EU member that opted out of the acquis. **0 days.**
- A week in **Reykjavík** — Iceland is in the EEA, which is *not* the Schengen Area. **0 days.**
- An **airside** airport transit — never crossed a border. **0 days.**
- The same flight into **Sofia by air** in February 2025 — **0 days** — but **overland the same week: 10 days.** Bulgaria opened its land and sea crossings on 31 December 2024 and kept air borders external until 31 March 2025.
- A **pending** residence application — not a permit. **31 days**, exactly as if you had nothing.

**3. It refuses, and it says so.**

Give it a passport it has never heard of and it does not guess:

> Ninety declined to answer
> Passport ZZ is not covered by this dataset, so Ninety will not guess.

That is the only behaviour that makes it safe to trust at all. A confident wrong number here costs someone money.

### And then there is the desk

When the sources genuinely conflict, Ninety refuses to classify the day and reports a range. This one is real: *does a layover that clears border control count as a day in the area?* The border-crossing guidance says admission at a border is entry into the territory. The visa policy is framed around *staying*, and a same-day transit is not a stay.

![The desk](https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/08-the-desk.png)

The second demo sits at **exactly 90 of 90** with a landed transit booked for three days' time. Ninety will not pick a side, so the answer is a range and the headline stays honest.

A person can then rule. That ruling is written as **precedent** — typed, dated, attributed, and scoped to that presence kind from the date of the ruling — and every later calculation reads it. Rule it "counts" and the demo flips from *inside the limit* to *crosses the limit on 6 October*, because at 90 of 90 a single charged day is the whole question.

Here it is flipping on camera — *inside the limit* becomes *crosses the limit on 6 October* the moment a person rules that the day counts:

![After the ruling](https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/10-after-ruling.png)

The whole run, 48 seconds:

https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/ninety-demo.mp4

It is a scripted recording against the deployed app, and the dataset is reset afterwards, so you will find the desk open.

### And then there is the agent

![The agent](https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/15-agent.png)

Counting your own dates is easy. Deciding whether an airport transit counts is not — which is exactly the judgement the structured form was asking people to make before it would help them. So you can also just write it down:

> *Took the train into Sofia 1 to 11 February 2025, then flew to Paris 20 to 25 February 2025, then an 8 hour airport layover on 3 June 2026 where I never cleared immigration.*

and the agent resolves it against the corpus, shows its confidence, and refuses the leg it is not sure about.

Three rules, and the third is the one that matters:

1. **It can only choose from a set it retrieved.** The territory list comes from `groq_query` against Sanity Context. If a place is not in the corpus there is no option to select, and the output is "No place named" — which is what the layover in that example gets.
2. **It cannot do arithmetic.** Classification goes through TypeSafe's System One models, which return `{choice, probabilities, confidence}` — a value from a set I defined, plus how sure it is. There is no channel through which a day count could travel.
3. **It says when it does not know.** Below 0.62 confidence the leg is marked uncertain rather than answered. In the screenshot above, *"flew to Paris 20 to 25 February"* lands at 50% and is refused. I would not have got that from a chat completion, and in this domain it matters more than fluency.

Note the dependency count: the agent needs no chat-model SDK. The whole web app has five runtime dependencies and none of them is a model provider.

---

## Code

https://github.com/PhiBao/beyond-vibe

Monorepo. `studio/` is a standalone Sanity Studio — 11 document types, 7 object types; `web/` is Next.js 16.

```
studio/     Sanity Studio. 11 document types, 7 object types.
web/
  src/lib/engine/     Pure TypeScript. No Sanity client, no model, no env vars.
  src/lib/agent/      Retrieve, classify, then hand off to the engine.
  src/lib/data/       The authored corpus, shared by the tests and the seed.
  src/lib/sanity/     GROQ, the snapshot loader, the Sanity Context client.
  scripts/            Seed, verification, evaluation, demo recording.
eval/RESULTS.md       The evaluation output, committed.
```

### The engine has no model in it

`src/lib/engine/evaluate.ts` makes **no network call and imports no model**. It takes a snapshot of the rules and an itinerary and returns a verdict. Same inputs, same answer, every time — and you can check it by hand.

There are 56 tests. They cover the things that are genuinely easy to get wrong: that the day of arrival counts and the day of departure does not, that a same-day visit is one day, that 1–29 February 2024 costs 28 days and the same calendar span in 2026 costs 27, that a pending application is not a permit, that Iceland is EEA but not Schengen, and that an air arrival into Sofia in February 2025 is not the same journey as a train.

---

## My Build Process

The prompt asks which AI-native IDE I used, which prompts worked, which did not, where the model got stuck, and how I course-corrected. I used **OpenCode** with a large model. I built this in about a day, which I want to be honest about up front: it was fast because I made three decisions early that a slower build would have discovered too late.

### What I decided before writing code

**1. The engine before the interface.** I wrote the date arithmetic and the verifier before a single component. Every bug after that was in plumbing, not in thinking, because the thinking was already pinned down by tests.

**2. No model in the verdict.** The agent may retrieve, classify and explain, but it may never produce a number. This is the whole technical thesis and it cost nothing to adopt.

**3. The evaluation before the polish.** I built the case set in the first third. It immediately started catching me.

### Where it got stuck, honestly

**The dataset looked empty and I nearly believed it.**

`pnpm seed` reported success, but every query returned zero documents. Not an error — a `200 OK` with an empty result. That is the signature of a private dataset and it looks exactly like a broken schema. I burned time on the schema before noticing that an unauthenticated read returned `0` while an authenticated read returned `36`. The fix was a server-side read token, and I added `pnpm verify:data` so that failure mode can never be silent again.

**GROQ is whitespace-sensitive, in a way that reads like a syntax error.**

My snapshot query kept returning empty. The cause:

```groq
"allowances": *[_type == "allowance"]
{ "id": _id, ... }
```

A newline between `]` and `{` makes GROQ read the braces as a block. The fix was to write every projection as `[...]{...}` with no gap, and to leave a comment at the top of the file saying why so the next person does not "tidy" it back.

**`@sanity/client` v8 silently no-oped my dispute update.**

The adjudication wrote a precedent and returned `200`. The dispute stayed open. A partial `patch` on a document with nested typed objects did nothing, without throwing. I only found it because I checked the dataset afterwards instead of trusting the status code. Both the write and the reset now use a full document replace, and failures surface as a `503` with the underlying message.

**The module-level cache had no TTL.**

My snapshot loader memoised forever, which is fine in a script and wrong on Vercel: a warm lambda served stale rules, so the demo appeared to ignore its own adjudication until the process happened to recycle. Thirty seconds fixed it. I would have shipped that bug if I had not recorded the demo against the *deployed* site rather than locally.

**The evaluation caught my own arithmetic, six times.**

I hand-wrote 23 expected answers so the runner could not grade itself. Six were wrong:

- Five cases asked about a February 2025 rule "as of October 2026", so the rolling window had aged the trip out and the correct answer was `0`. The engine was right; my expectation was wrong. I added a per-case `asOf`, because a rule that applied in February 2025 has to be evaluated against February 2025.
- One case: I expected 29 days for 1–29 February 2024. The answer is 28, because the departure day is not charged.

The engine was right every single time. That is the argument for writing it before you write the prose about it.

### The two bugs I am most glad I found

Both were invisible by construction, which is why they are worth writing down.

**A test that passed for the wrong reason.** My evaluation had a case for the Canary Islands, written against the territory code `es-canary`. `es-canary` is a *document key*; the code is `XCI`. The engine's response to an unknown territory is a warning and zero charged days — so the case passed, because the Canary days had been silently dropped rather than classified as a carve-out. The number was right. The reasoning was nonsense.

**A real-world error, in my own corpus.** I had modelled Iceland as a full member, using a shared helper that stamps the Schengen founding date onto every state. Iceland is in the EEA but has never joined the Schengen Area, so Reykjavík days were being charged against 90/180. That is a mistake a lot of tools make, and mine made it silently, in the one file I had been treating as ground truth.

Neither was findable by reading the code. Both came from writing a check that looks at *what the engine actually did* rather than at the number it returned:

```bash
pnpm check:codes      # every territory code the product uses resolves
pnpm check:fallback   # the bundled corpus and Sanity produce identical verdicts
```

`check:codes` also fails the build if any evaluation case contains a dropped stay. A case that passes because its input was ignored is worse than a case that fails.

### The prompts that mattered

The ones that worked were **constraints, not descriptions**. "Do not let the model state a number" produced a better result than "make an agent". "Refuse visibly rather than guessing" produced visible refusals everywhere. "Every classification resolves to at least one source, or the day is undecided" produced a schema where that is structurally true.

The one that did not work: I asked for a single-file schema at first. It produced a `territory.isSchengen: boolean`, which is exactly the modelling error the product exists to catch. It took me restating the requirement as *"the same ten-day trip into Sofia counts overland and does not count by air in February 2025"* before the schema stopped lying.

---

## Thoughtfulness of the Schema

Three decisions carry the weight. A fourth is the reason the whole thing works.

**1. Membership is a band, not a flag.**

```ts
{key: 'bg', name: 'Bulgaria', code: 'BG', kind: 'state', accessBands: [
  {from: '2000-01-01', to: '2024-12-31', counted: false, ...},
  {from: '2024-12-31', to: '2025-03-31', counted: true,
   modes: ['land', 'sea'], ...},
  {from: '2025-03-31', counted: true, ...},
]}
```

My first pass used a shared `FULL('2000-01-01')` helper for every state, which is a lie for anyone who joined later — and, as the Iceland bug above shows, for anyone who never joined at all. Fixing it meant going and dating each accession properly: the 1995 founding group, the Nordic members, the 2004 and 2007 enlargements, Switzerland in 2008, Croatia in 2023, Bulgaria and Romania in 2024–25, and the four territories that are in the EEA, the EU, or neither but not in the area.

**2. Carve-outs are first-class territories.**

The Canary Islands, Madeira, Åland, Svalbard, the French overseas departments, and Ireland, Cyprus and Iceland as external are each their own `territory` document with their own bands — not a boolean on the parent state. That way the ledger can say *"Canary Islands (Spain) — outside the Schengen area despite being Spanish territory"*, and name the exact place a day was spent.

**3. Ambiguity is data, not an exception.**

A `presenceRule` can be marked `disputed`. When it is, the engine will not classify a day of that kind, reports the count as a range, and routes the day to an adjudication. The ruling becomes a `precedent` scoped to that presence kind and effective from the date of the ruling — which is why the September layover in the first demo correctly stays unresolved after a ruling made in October. Days already counted are not revisited.

**4. The rules and the traveller are different kinds of thing.**

`allowance`, `territory`, `nationalityClass`, `visaRegime`, `permitExemption`, `presenceRule` and `source` are reference data — effectively one document each, seeded under deterministic IDs. `itinerary` and `trip` are a person's record. `dispute` and `precedent` are decisions about the first group, made in light of the second. Keeping those three layers apart is what let me seed, test, snapshot and reset each independently — and what lets the app fall back to a bundled copy of the corpus and still produce byte-identical verdicts when Sanity is unreachable.

---

## Did the structured content actually matter?

The challenge says: *"If a keyword search would have gotten you the same answer, aim higher."* So I measured it.

Two systems, the same corpus, 23 adversarial histories with hand-computed expectations. Neither arm uses a language model, so anyone can rerun it with `pnpm eval`.

| Measure | Structured (GROQ + engine) | Keyword search (BM25, same rules) |
| --- | --- | --- |
| Correct answer | **23/23** | **1/23** |
| Produced a day count | 21/23 | 0/23 |
| Named the exact breach date | 1/1 | 0/1 |
| Refused instead of guessing | 2/2 | n/a |

Full results, including why each case is hard: [`web/eval/RESULTS.md`](https://github.com/PhiBao/beyond-vibe/blob/main/web/eval/RESULTS.md)

The keyword arm is not handicapped by a weak index. It sees the same territory records, the same presence rules, the same permit exemptions, flattened into prose, and scores BM25 over them. It returns the right *sentences* most of the time. It just cannot produce a number, because:

**The corpus holds the rules, and never held the traveller.**

Asking "am I still legal" is not a retrieval problem. It is a join between the rule and eleven date ranges, two of which fall in carve-outs and one of which nobody has ruled on, evaluated day by day across a rolling window. Retrieval finds the paragraphs. It cannot join them to a calendar.

---

## Sanity Project Details

- **Project ID:** `jvgi63fz`
- **Dataset:** `production`
- **Contents:** 5 sources, 1 allowance, 36 territories with date-banded access, 3 nationality classes, 3 visa regimes, 5 permit exemptions, 6 presence rules, 2 demo itineraries with 17 trips, 1 open dispute.
- **Reproduce it:** `pnpm --dir web seed && pnpm --dir web verify:data`

Every rule in the dataset carries a `sourceRef` pointing at a real document with a publisher, a URL and a retrieval date. Clicking any day in the ledger shows its authorities. Nothing in Ninety's reasoning is unattributed.

---

## What this is not

Not legal advice, and not a complete immigration reference. It covers the Schengen short-stay allowance for a handful of passport classes and refuses outside that coverage. The rule corpus is deliberately narrow and dated rather than broad and approximate, because a wrong answer in this domain is not an inconvenience.

If I had another day I would widen the territory set, add the UK 180-day visitor rule and the US admission-parity rule on the same generic engine, ingest the EU source documents as a Knowledge Base so the agent can quote the paragraph rather than the title, and build a real Sanity App SDK app for the desk so adjudication lives inside the Dashboard instead of a separate page.

---

Thanks to the Sanity team for the challenge, and to the DEV community for the review. 🤖
