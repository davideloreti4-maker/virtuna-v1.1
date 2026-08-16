# Grounded attribution — adapt-first hooks + query distillation

**Date:** 2026-08-16 · **Status:** approved design, pre-implementation
**Scope:** hooks first; ideas/script fan out only after the hooks gate passes.

## Problem

Grounded runs almost always render "Original — not drawn from a retrieved video" on every
card (~4% receipt rate), even when a live Apify scrape succeeded and its rows reached the
prompt. Two causes, both verified in code and logs on 2026-08-16:

1. **Retrieval relevance.** The scrape/search query is the first non-empty of
   `[ask, anchor, niche]` (`gather-for-run.ts:304`, fed from each runner, e.g.
   `hooks-runner.ts:612`). A full chat ask (400+ chars) goes to TikTok search verbatim and
   returns topically random videos.
2. **Generation never starts from the sources.** With `GROUNDING_<SKILL>_ADAPT` unset, the
   raw-slice path shows the model madlib skeletons and asks it to volunteer a borrow; it
   almost always honestly tags `sourceIndex: 0`. The honesty guard chain
   (`prompt.ts:216`, `output-guards.ts` templateInstantiated / trimExamplesToBundle /
   diversity cap) is **correct and stays** — ~81% of pre-guard citations were false.

3. **Receipt fidelity (owner-reported 2026-08-16).** When a receipt *does* appear, its
   claimed hook/topic sometimes doesn't match the real video it links to, and the card's
   seed line sometimes duplicates the hook line. The receipt is a verbatim copy of the
   `RetrievedExample` row (`build-proof.ts` — index-guarded, no transformation), so a wrong
   receipt means the *example row itself* is wrong — pointing at the extraction/decode step
   (known trap: the live decoder can echo its few-shot example back verbatim and it reads
   as a perfect decode) or at stale/misattributed cache rows. Cause not yet measured —
   this lane gathers the evidence (§5) before any fix is designed.

The built fix already exists: the adapt-as-briefer (`src/lib/grounding/adapt.ts`) fits each
retrieved example to the creator *before* generation and sets `adapted=true`, which the
lexical guard already respects (`hooks-runner.ts:807`). All three
`GROUNDING_<SKILL>_ADAPT` flags are currently unset (verified via `scripts/flag-audit.mjs`).
Its known nondeterminism failure modes are mechanically fenced (retry, `clampOverCapProse`,
degrade); the exemplar-echo defect is fenced (#482, 43%→0%). It ships dark only because it
was never flipped after those fixes.

## Goal and success bar

**Goal:** cards genuinely built from retrieved videos — receipts because the hook actually
adapts a source, never decorative.

**Gate:** aggregate ≥70% of hook cards carry a genuine receipt across N≥6 sends through the
**real chat route** (new thread per send), varied asks. Measured as a rate, never a single
run — the adapt call is nondeterministic (see memory: one live run cannot clear a
stochastic gate). Receipts may come from fresh scrape rows or cached corpus teardowns; both
are retrieved videos.

## Design

### 1. Query distillation (`src/lib/grounding/distill-query.ts`, new)

- Called from `gather-for-run.ts` immediately after the query candidate is picked.
- If query length > ~80 chars → one Qwen-flash call: distill to a 3–6 word video-subject
  search query. Short queries pass through untouched.
- Any LLM failure/timeout (short timeout, ~10s) → fall back to the undistilled query
  (today's behavior). The run never blocks or degrades because of the distiller.
- Injectable via the existing `GatherCorpusDeps` pattern; unit tests never hit the network.
- Lives inside the gather so all three skills and every caller (HTTP routes + chat
  dispatch) inherit it, and cache read-backs benefit too, not just live scrapes.
- Log the distillation: `[grounding] distilled query "<short>" from <n>-char ask`.

### 2. Adapt flip (env only, no code)

- `GROUNDING_HOOKS_ADAPT=true` in this worktree's `.env.local` (dev). Prod is a Vercel
  deposit — deploys are off; merging does not deploy.
- Runtime effect: gather routes examples through `adaptCorpusBlock`; `adapted=true`
  bypasses the lexical madlib check (correct — the model consumes fitted lines, not
  madlibs); receipts attach via the `used` mapping, still subject to bundle-trim and the
  per-source diversity cap (2 per source — a single-source run maxes at 2 of 3 cards; the
  70% bar is aggregate).
- Constraints honored unchanged: `enable_thinking` stays off (blows the 90s timeout);
  existing retry/clamp/degrade stays as-is.

### 3. Attribution instrumentation (`hooks-runner.ts` BUILD loop)

- Refactor the single proof ternary (~line 805) into an explicit per-card classifier:
  `kept | model-zero | trimmed-from-bundle | lexical-mismatch | diversity-capped`.
  Behavior byte-identical; the classifier is unit-tested per reason.
- One log line per run:
  `[attribution] hooks: kept 2/3 — [1:kept, 2:model-zero, 3:diversity-capped]`.
- Permanent. Today's diagnosis required log archaeology; this makes it one grep.

### 4. Measurement probe (`scripts/probe-attribution-rate.ts`)

- Drives the real `/api/tools/chat` on the local dev server as the signed-in e2e user
  (Supabase auth REST + chunked cookie recipe; e2e creds are a real prod account).
- `maven_active_thread=__new__` on every send — N sends must be N threads.
- 6 varied asks: the platform-pitch ask that surfaced this, plus ordinary niche asks.
- Counts hook-card blocks off the SSE/persisted payload — never the DOM
  (emit-card timing and innerText traps are both known measurement hazards).
- Reports per-run + aggregate receipt rate, strip-reason tallies (from §3's log),
  and cost. Pre-flight: check the Apify account against its $5 cap before ~6 × $0.11.

### 5. Receipt fidelity checks (evidence-gathering, fix deferred to findings)

- Instrumentation (§3) additionally logs, per kept receipt, the cited source's row id,
  handle, and videoUrl — so a bad receipt is traceable to its exact example row.
- The probe (§4) cross-checks every kept receipt: fetch the cited row from
  `outlier_teardowns` (or the fresh-scrape payload) and flag receipts whose
  `hookTemplate`/topic cannot be reconciled with the row's own transcript/caption fields;
  flag cards where `seedHook` ≈ `hookLine` (near-duplicate).
- Output: a mismatch tally + concrete examples alongside the receipt rate. If mismatches
  trace to the index mapping or bundle trim, fix in this lane (cheap, mechanical). If they
  trace to decode fabrication/echo or stale cache rows, that fix is a follow-up with its
  own design — this lane ships the evidence, not a guessed fix.

### 6. Testing & rollout

- Unit tests: distiller (long→short, short untouched, failure→fallback), gather wiring
  (injected distiller dep), strip classifier (each reason).
- Gates before push: `tsc`, `npm run build`, targeted vitest (grounding + runners), full
  suite with `--maxWorkers=3` (known flake families: scraping/resolve-video,
  engine/omni-analysis, composer-* under load — pre-existing).
- Hooks gate passes → follow-up flips `GROUNDING_IDEAS_ADAPT` / `GROUNDING_SCRIPT_ADAPT`
  with a lighter probe each. Not part of this implementation.

## Explicitly out of scope / settled

- The honesty guard chain is not weakened or reverted (owner-ruled correct).
- Live-first ordering (#517/#519) is settled — no re-litigation.
- Apify people-search matching (D12) is settled — the distiller changes the *query*, not
  the matching strategy.
- No forced-citation prompt rewrite (measured to hurt voice — 07-14 blind A/B).
- Ideas/script flips are follow-up work gated on the hooks measurement.

## Risks

- **Adapt output quality jitters** run to run (measured). Mitigation: the gate is a rate
  over N runs; existing retry/clamp handles structural failures.
- **Distilled query changes cache hit patterns.** Expected and desired (better matches);
  the cache read-back floor is unchanged, so a worse match degrades to ungrounded exactly
  as today.
- **Latency** grows by one flash call (distill) + the adapt call on grounded runs.
- **Apify budget** during measurement: ~6 authorized sends ≈ $0.66 against the $5/mo cap;
  pre-flight the account.
