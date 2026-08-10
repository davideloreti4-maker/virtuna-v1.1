# Owner review pack — v8 copy inventory + drop economics number (handoff §4 items 2–3)

> Prep only, 2026-08-10. Nothing here is changed in code; this collects what the owner
> needs to rule on open items 2 (drop economics) and 3 (copy review) without a live session.

## 1. Drop economics — the real cost number (owner call #3)

Per **(user × audience) per day**, the warm is `drop-reactions.ts`: 1 embedding + ≤6 adapt
calls + 1 batched Flash call, cached once/day (`surface_reactions`). Measured prompt sizes
(real builders, chars/4≈tokens) × the pricing recorded in `qwen/client.ts`
(qwen3.7-flash $0.03/M in · $0.13/M out at ≤32K input):

| call | count | in tok | out tok | cost |
|---|---|---|---|---|
| adapt (system 28,858 chars ≈ 7.2k tok + row) | 6 | ~8k | ~1k (cap 1200) | $0.00144 + $0.00078 |
| Flash batch (system ~1.7k generic + panel) | 1 | ~3k | ~2.3k (cap 3500) | ~$0.0004 |
| text-embedding-v3 | 1 | ~0.1k | — | negligible |

**≈ $0.003 per user-audience-day, ≈ $0.09/month per daily-active user-audience.**
10k DAU ≈ $30/day. Day-0 lanes run (1 synthesis + ≤3 adapt + 1 Flash batch) ≈ $0.0015,
one-time. Caveats: static estimate (chars/4, no retries, DashScope cache discounts not
counted — they make it cheaper); a metered live warm would confirm. At this size the
free-tier stance is a product decision, not a cost one; `BILLING_ENFORCE_QUOTA` is live
with free `limit:0`, so un-gating the drops for free users requires an explicit quota call.

## 2. Copy inventory for review (owner call, handoff §5 — all shippable-grade, none reviewed)

**Arrival headline** (`v8/arrival.tsx`): `Tonight's remixes` when the shelf is ready;
time-of-day greeting (`Welcome back` fallback) before that.

**Rest placeholder** (`composer.tsx`): `Paste a video, or tell me your idea…`

**Chips row** (`v8/chips-row.tsx`): `Remix a proven video` · `Test a draft` · `Find outliers` · `More ▸`

**Skills taxonomy** — the panel groups by verb (Make / Test / Ask) over the REAL registry
(`composer-controls.tsx` SKILLS). Rows as they render today:
- Make: `Hooks` · `Ideas` · `Script` · `Remix` · `Explore`
- Test: `A real video` (/test) · `Your account` (/account) — verb-flavored labels, not nouns
- Ask: `Chat`
- Disabled rows (marketing): `Offer Validation` · `Ad Creative` — appear only when enabled
- Hidden (HORIZONTAL_ENABLED off): `Profile` · `Simulate` · `Predict`
The mock's row list was a sketch (SSOT §5); this registry is what ships. The naming
question for the owner: keep the verb-flavored Test labels ("A real video") or normalize.

**PROMISE_BY_TOOL** (`v8/skills-panel.tsx` — the preview pane's one-paragraph promise):
- hooks: "Openers that stop the scroll. Give me a topic — or nothing at all — and I'll write ranked hook lines your audience would actually stop for."
- idea: "Funnel-top ideas for your niche, ranked — cards you can take straight to a script."
- script: "A beat-by-beat script with retention markers: where to hold, where to cut, where they'd drop."
- remix: "Take a proven video — paste any link — and I'll decode why it worked, then rebuild its format for your niche."
- explore: "See what's breaking out — in your niche, or any competitor's."
- test: "Upload a real video or paste a link. SIM-1 Max watches it the way your audience would and hands back the full read."
- account: "A read on your own posts — what's landing, what isn't, and why."
- chat: "Ask anything in your context — your niche, your audience, an idea you're weighing."
- offer: "Test a product, a price, a positioning — before you build the funnel."
- ad: "Pre-flight an ad concept, ROAS-framed, before you spend."
- profile: "Build a SIM of anyone from a chat export or screenshot."
- simulate: "Run a draft through your audience and hear who stops."
- predict: "Put a scenario in front of the analyst panel and read the spread."

**Day-0 lane reveal** (`lane-reveal.tsx`, Phase 5 — new copy, same review bucket):
heading `Three ways you could show up.` (count word varies) · kicker
`pre-tested · pick the one that sounds like you` · seeded remix turn
`Remix this for me: "<hook>"` (`drop-seed.ts`).

Related but separate: the lane `who`-as-description prefill question is in
`docs/EVAL-2026-08-10-lane-synthesis.md` (owner call surfaced by the eval).
