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
  `kept | model-zero | invalid-index | no-handle | trimmed-from-bundle | lexical-mismatch | diversity-capped`.
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

## Measured (2026-08-16)

- Receipt rate: 17/18 (94.4%) — gate ≥70%: **PASS** (cache arm — see Cost)
- Strip reasons across runs: `model-zero` ×1 (ask 2, card 2); no other reasons observed —
  17 of 18 attribution decisions kept a receipt, matching the wire-level card count exactly
  (no shipped-vs-decided divergence this run).
- Distillation: **0/6** asks exercised the distiller's `defaultComplete` (LLM) path — not a
  defect in Tasks 2/3. The `[grounding] distilled query "…"` line never appears in the dev
  log for any of the 6 sends. Root cause, confirmed by reading `skill-dispatch.ts:148-160,230`:
  `/api/tools/chat` runs a tool-calling agent (`runChatAgentStream`) that itself extracts a
  compact `topic` argument from the creator's message before ever handing off to
  `gatherCorpusForRun`/`distillSearchQuery` — `ask: args.topic ?? ""`, schema description
  "extracted from the creator's message + the conversation." All 6 topics the agent produced
  this run landed at or under `DISTILL_THRESHOLD` (80 chars), so the distiller's early-return
  fired for all 6 and no DashScope call happened at that stage. Queries retrieval actually ran
  on (from `[grounding] cache HIT for "…"` lines): "AI platform that simulates audience
  reaction before posting", "high protein breakfasts for busy people", "why most runners
  train their easy days too hard", "negotiating a raise without threatening to quit",
  "restoring a 1970s film camera found at a flea market", "growing a balcony vegetable garden
  in a rental" — all agent-authored topic strings, not distiller output.
  - Corroborating isolated test (not part of the live run — a direct call to
    `distillSearchQuery` against the 6 *literal probe ask strings*, i.e. what the module would
    do if it received the raw HTTP body text instead of the agent's `topic`): 2/6 exceed the
    80-char threshold and do invoke `defaultComplete` (asks 1 and 3, at 109 and 81 chars), at
    **2081ms and 1073ms** respectively; the other 4 short-circuit at ~0ms. This is the only
    live-DashScope-measured latency the distiller module has ever produced; it does not
    describe this run's actual traffic, since the real runner input (the agent's `topic`) never
    reached the LLM branch here. **Distill latency observed for THIS run's live traffic: n/a —
    the branch never fired.**
- Fidelity: 0 receipt/row template mismatches; seed-line duplicates 3/18.
- Cost: Apify $0.00 this run (account held at $4.5907/$5 before and after — every send fell
  back to cache pre-flight, no job launched) + DashScope: 6 hooks-generation calls + 6
  adapt-briefer calls (`GROUNDING_HOOKS_ADAPT=true`), no per-call cost script exists for
  DashScope in this repo so no measured total — order-of-magnitude cents, not an isolated
  figure.
- Verdict/next: PASS, ship as measured. The one architectural finding worth carrying forward
  (not a blocker for this gate): on the real `/api/tools/chat` path, Tasks 2/3's distiller is
  effectively dead code today, because the upstream tool-calling agent's `topic` extraction
  already does equivalent compression before the distiller ever sees the ask. The distiller
  still guards a real path (any `queryCandidates` source >80 chars — e.g. a longer `topic`, or
  a skill route that isn't agent-dispatched), so it should not be removed on this evidence
  alone; the follow-up is to check whether a skill route with no upstream agent layer (a
  direct `/api/hooks`-style dispatch, if one exists) is where its 80-char branch actually
  earns its keep, and to log the input length distribution the `topic` argument itself
  produces once traffic is real. Live-scrape arm remains unmeasured (Apify capped at $0.41
  headroom, need ~$0.70) — this run is the cache arm only, consistent with the dry run.
