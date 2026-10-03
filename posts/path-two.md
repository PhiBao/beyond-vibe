*This is a submission for the [Sanity Challenge, Path Two: Vibe-Code Something Strange](https://dev.to/challenges/sanity-2026-09-16)*

**Live:** https://web-eight-amber-6zft3r0kdf.vercel.app
**Code:** https://github.com/PhiBao/beyond-vibe
**Sanity project:** `jvgi63fz` · dataset `production`

---

## What I Built

**Ninety** knows the exact day you went over.

Every Schengen short-stay calculator tells you *how many* days you have used. None of them tell you *which day* you crossed the line, *why* that day counted, or *what to change*. Ninety does all three.

It is a day accountant for the 90-in-any-180 rule. You give it your trips; it resolves the rules that apply on **each individual day**, counts a rolling window, and tells you:

- **74 of 90 days used** — and 17 remain
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

The second demo sits at **exactly 90 of 90** with a landed transit booked for three days' time. Ninety will not pick a side, so the answer is a range.

A person then rules. That ruling is written as **precedent** — typed, dated, attributed, and superseded rather than overwritten — and every later calculation reads it. Rule it "counts" and the demo flips from *inside the limit* to *crosses the limit on 6 October*, live:

https://raw.githubusercontent.com/PhiBao/beyond-vibe/main/web/demo/ninety-demo.mp4

(30 seconds. The desk is at the end. The dataset is reset afterwards, so you will find it open.)

---

## Code

https://github.com/PhiBao/beyond-vibe

Monorepo. `studio/` is a standalone Sanity Studio; `web/` is Next.js 16.

```
studio/     Sanity Studio. 12 document types, 7 object types.
web/
  src/lib/engine/     Pure TypeScript. No Sanity client, no model, no env vars.
  src/lib/data/       The authored corpus, shared by the tests and the seed.
  src/lib/sanity/     GROQ, the snapshot loader, the Sanity Context client.
  scripts/            Seed, verification, evaluation, demo recording.
eval/RESULTS.md       The evaluation output, committed.
```

### The engine has no model in it

`src/lib/engine/evaluate.ts` makes **no network call and imports no model**. It takes a snapshot of the rules and an itinerary and returns a verdict. Same inputs, same answer, every time — and you can check it by hand.

There are 40 tests. They cover the things that are genuinely easy to get wrong: that the day of arrival counts and the day of departure does not, that a same-day visit is one day, that February 2024 costs 28 and February 2026 costs 27 for an identical calendar span, that a pending application is not a permit, and that an air arrival into Sofia in February 2025 is not the same as a train.

---

## My Build Process

The prompt asks which AI-native IDE I used, which prompts worked, which did not, where the model got stuck, and how I course-corrected. I used **OpenCode** with a large model. I built the whole thing in about a day, which I want to be honest about up front: this was fast because I made three decisions early that a slower build would have discovered too late.

### What I decided before writing code

**1. The engine before the interface.** I wrote the date arithmetic and the verifier before a single component. That was the single best decision I made. Every bug I hit afterwards was in plumbing, not in thinking, because the thinking was already pinned down by tests.

**2. No model in the verdict.** I told myself and the agent: the agent may retrieve, classify and explain, but it may never produce a number. Anything numeric comes from the deterministic engine. This is the whole technical thesis and it cost nothing to adopt.

**3. The evaluation before the polish.** I built the 22-case eval in the first third. It immediately started catching me.

### Where it got stuck, honestly

**The dataset looked empty and I nearly believed it.**

`pnpm seed` reported success, but every query returned zero documents. Not an error — a `200 OK` with an empty result. That is the signature of a private dataset, and it looks exactly like a broken schema. I burned time on the schema before noticing that the unauthenticated read returned `0` while the authenticated read returned `36`. The fix was a server-side read token, and I added `pnpm verify:data` so that failure mode can never be silent again.

**GROQ is whitespace-sensitive, in a way that reads like a syntax error.**

My snapshot query kept returning empty. The cause:

```groq
"allowances": *[_type == "allowance"]
{ "id": _id, ... }
```

A newline between `]` and `{` makes GROQ read the braces as a block. The fix was to write every projection as `[...]{...}` with no gap, and to leave a comment at the top of the file saying why so the next person does not "tidy" it back.

**`@sanity/client` v8 silently no-oped my dispute update.**

The adjudication wrote a precedent and returned `200`. The dispute stayed open. A partial `patch` on a document with nested typed objects did nothing, without throwing. I only found it because I checked the dataset afterwards instead of trusting the status code. Both the write and the reset now use a full document replace.

**The module-level cache had no TTL.**

My snapshot loader memoised forever, which is fine in a script and wrong on Vercel: a warm lambda served stale rules, so the demo appeared to ignore its own adjudication until the process happened to recycle. Thirty seconds fixed it. I would have shipped that bug if I had not recorded the demo on the *deployed* site rather than locally.

**The evaluation caught my own arithmetic, twice.**

I hand-wrote 22 expected answers so the runner could not grade itself. Six were wrong:

- Five cases asked about a February 2025 rule "as of October 2026", so the rolling window had aged the trip out and the correct answer was `0`. The engine was right; my expectation was wrong. I added a per-case `asOf`, because a rule that applied in February 2025 has to be evaluated against February 2025.
- One case: I expected 29 days for 1–29 February 2024. The answer is 28, because the departure day is not charged.

The engine was right every single time. That is the argument for writing it before you write the prose about it.

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

My first pass used a shared `FULL('2000-01-01')` helper for every state, which is a lie for anyone who joined later. Fixing it meant going and dating each accession properly: the 1995 founding group, the Nordic members, the 2004 and 2007 enlargements, Switzerland in 2008, Croatia in 2023, Bulgaria and Romania in 2024–25. A dataset that models date-banded membership while filling every band with the same date is modelling nothing.

**2. Carve-outs are first-class territories.**

The Canary Islands, Madeira, Åland, Svalbard, the French overseas departments, and Ireland and Cyprus as external-but-EU are each their own `territory` document with their own bands — not a boolean on the parent state. That way the ledger can say *"Canary Islands (Spain) — outside the Schengen area despite being Spanish territory"*, and name the exact place a day was spent.

**3. Ambiguity is data, not an exception.**

A `presenceRule` can be marked `disputed`. When it is, the engine will not classify a day of that kind, reports the count as a range, and routes the day to an adjudication. The ruling becomes a `precedent` scoped to that presence kind and effective from the date of the ruling — which is why the September layover in the first demo correctly stayed unresolved after a ruling made in October. Days already counted are not revisited.

**4. The rules and the traveller are different kinds of thing.**

`allowance`, `territory`, `nationalityClass`, `visaRegime`, `permitExemption`, `presenceRule` and `source` are reference data — effectively one document each, seeded deterministically. `itinerary` and `trip` are a person's record. `dispute` and `precedent` are decisions about the first group, made in light of the second. Keeping those three layers apart is what let me seed, test and reset each independently.

---

## Did the structured content actually matter?

The challenge says: *"If a keyword search would have gotten you the same answer, aim higher."* So I measured it.

Two systems, the same corpus, 22 adversarial histories with hand-computed expectations. Neither arm uses a language model, so anyone can rerun it with `pnpm eval`.

| Measure | Structured (GROQ + engine) | Keyword search (BM25, same rules) |
| --- | --- | --- |
| Correct answer | **22/22** | **1/22** |
| Produced a day count | 20/22 | 0/22 |
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

If I had another day I would widen the territory set, add the UK 180-day visitor rule and the US admission-parity rule on the same generic engine, and build a real Sanity App SDK app for the desk so the adjudication lives inside the Dashboard instead of a separate page.

---

Thanks to the Sanity team for the challenge, and to the DEV community for the review. 🤖