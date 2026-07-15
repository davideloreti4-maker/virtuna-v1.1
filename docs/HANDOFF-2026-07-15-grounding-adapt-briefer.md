# Handoff — grounding-as-remix Phase 1 (adapt-as-briefer) is LANDED (2026-07-15, session 5)

**Read `docs/DECISION-grounding-as-remix-2026-07-15.md` for the full reasoning. This is the
"what's done + how to resume" wrapper.** Prior handoff: `docs/HANDOFF-2026-07-15-grounding-as-remix.md`.

---

## 0. One paragraph

The blind transplant is dead. Between retrieval and the hooks writer there is now a **briefer**
(`src/lib/grounding/adapt.ts`): one focused LLM call sees each retrieved structure's FULL decoded
anatomy and, per structure, picks a **dosage** (clone / swap / angle / none), re-voices the keepers to
the creator, drops the no-fits, and emits a compact **fitted brief**. The existing hooks writer
consumes that brief in place of today's raw madlib slice — so the SIM gate, the `sourceIndex→receipt`
link, and per-persona targeting all survive unchanged (only the `corpus` STRING's content changes).
Landed behind a default-off flag, hooks-only, committed on `experiment/ab-grounding-blind`. A live
8-case parity run confirmed it works on the REAL path. **The honest gate is still OPEN: does it make a
hook that PERFORMS? No view data exists — craft-read + our own Flash SIM are not evidence.**

---

## 1. What is DONE (committed this session)

Phase 1 = **ADAPT-AS-BRIEFER**, flag-off, hooks-only. tsc + eslint clean, 225 tests green.

- **`src/lib/grounding/adapt.ts` (new)** — `adaptCorpusBlock({skill,ask,niche,platform,profile,examples})
  → {corpus, used}` (same shape as `buildCorpusBlock`). The model authors only `dosage` + `fitted` +
  `fitReason`; the **receipt is CODE-stamped** (`receipt()` reused from prompt.ts) so a curated row can
  never be dressed "proven". **Fail-safe:** any LLM failure OR every structure judged 'none' → falls
  back to `buildCorpusBlock` (the raw slice). Never crashes, never silently ungrounds admissible rows.
  Injectable `complete` fn for tests. Word cap = **20** (a HOOK-only norm — see §5).
- **`src/lib/grounding/gather-for-run.ts`** — `adapt?`/`adaptProfile?` on input, `adapt?` on deps.
  ONE `finalize()` helper routes all three emit paths (cache hit · non-scrapable partial · scrape)
  → adapt when `adapt && skill==='hooks' && adaptProfile`, else the raw slice.
- **`src/lib/tools/runners/hooks-runner.ts`** — `isGroundingAdaptEnabled()` reads
  `GROUNDING_HOOKS_ADAPT === "true"` (default-off, INDEPENDENT of `GROUNDING_HOOKS_ENABLED`; you need
  both on for the briefer to run). Maps `genProfileRow → AdaptProfile`. Hardened
  `flattenTargetAudience` (accepts a string) + `toOutcomeList` (accepts `{url}[]` OR `string[]`, drops
  empties → never renders "undefined") — inert in prod, robust for harness/string-shaped profiles.
- **`src/lib/grounding/prompt.ts`** — exported `receipt`, `WARRANT_NOTE`, `clip` for reuse.
- **Tests:** `src/lib/grounding/__tests__/adapt.test.ts` (6) + `gather-for-run.test.ts` adapt-routing (4).
- **Harness + evidence:** `scripts/ab-grounding-briefer.ts` + `docs/AB-GROUNDING-BRIEFER-2026-07-15.md`.

**Nothing is pushed unless the auto-push hook fired (see commit output). Prod grounding flags OFF.**

## 2. The live parity result (`docs/AB-GROUNDING-BRIEFER-2026-07-15.md`)

Ran the REAL path (`runHooksPipeline`, both flags on → retrieve → briefer → actual writer → SIM) vs
the CACHED cold/transplant arms (same 8 asks/profiles from the 3-arm run).

- **Grounding engaged everywhere** — 8/8 cases retrieved 6 across 6 archetypes; no VOID, no fallback.
- **The dial varies AND drops non-fits** — of 48 retrieved, 28 kept as **swap 14 / angle 10 / clone 4**,
  and **20 dropped as no-fit**. Not a transplant (not all-clone), not a rubber-stamp.
- **Wiring survives end-to-end** — the writer consumed the brief and cited real proven sources; 7/8
  cases every hook attributed, case 8 wrote 2 cold (`sourceIndex 0` — honest).
- **Craft read** — hooks are tight + in-voice ("The most expensive thing in your pipeline is your
  ego"; "You didn't fail the interview. You failed the risk assessment.") with genuine fit reasoning.
- **Length** — the run flagged 3/28 fitted lines at 17–18w against the OLD cap of 15; the cap is now
  **20**, so all pass. Not re-run (deterministic: 17–18 ≤ 20).

## 3. 🔴 THE HONEST GATE IS STILL OPEN

Dosage-varies + tight + re-voiced proves the machine works **as designed** — NOT that it makes a hook
that gets more views. That needs a real OUTCOME signal (which hooks users pick / post / perform), or at
minimum a blind panel of social-native people. Our taste and our Flash SIM cannot settle it. **Keep
`GROUNDING_HOOKS_ADAPT` (and `GROUNDING_HOOKS_ENABLED`) OFF in prod until that exists.**

## 4. Next steps — ranked

1. **Read the A/B with the owner** (`docs/AB-GROUNDING-BRIEFER-2026-07-15.md`). Design call, not a gate.
2. **Phase 2 — extend adapt to ideas + script** (only after the read). NOT a copy of the hooks prompt:
   - **Ideas stays SUBJECT-BOUND** (belief↔reality tension matched to the creator's TOPIC — locked in
     the prior handoff; do NOT give ideas the structural cross-niche axis). Fit measure = the fitted
     output states a belief AND a contradicting reality, not a word cap.
   - **Script gets its BEATS** (the parse fix keeps `template.beats` alive). Map Hook→Setup→Turn→
     Payoff→CTA onto the proven rhythm. Fit measure = beat-arc completeness/order, not a word cap.
   - The per-skill fit measures are written into `adapt.ts` (comment above `SYSTEM_PROMPT`).
   - Do NOT force chat/explore/predict/simulate through the generate adapter (decision doc §4d: three
     consumption modes over one corpus).
3. **The honest gate** — wire a real outcome signal before ANY prod flag flips.
4. **Parse-fix standalone PR** — the `template` JSONB parse fix (`11b67f1f`) is PR-worthy on its own.
   ⚠️ It carries **4 pre-existing tsc errors** in `types.ts`/`types.test.ts`: making beat timings
   `.optional()` left the Zod-inferred type incompatible with the `TeardownBeat` interface (still
   requires `startSec`/`endSec`). Fix = make the interface optional + loosen `fmtBeat`'s `!== null`
   to `!= null`. Do this WHEN cutting that PR, not on this experimental branch.

## 5. Gotchas / how to run

- **Tests:** `node ./node_modules/vitest/vitest.mjs run src/lib/grounding` (NOT `npm test` — fake
  results in this repo). Runner tests: `... run src/lib/tools/runners`.
- **🔴 `rtk` sandbox blocks external network.** `/opt/homebrew/bin/rtk` is auto-prepended to Bash and
  silently DROPS DashScope/Supabase calls → node sits at 0% CPU, no output, looks hung. Any live
  script MUST run **sandbox-off in the FOREGROUND** (background + disabled-sandbox did NOT compose).
- **Run the parity harness:** `npx tsx scripts/ab-grounding-briefer.ts` (foreground, sandbox off).
  Needs `.env.local` (DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY + URL). ~8.5 min, 8 real pipeline
  runs. Knobs: `AB_LIMIT=1` (one case), `AB_PEEK_ONLY=1` (skip the writer arm — retrieval+briefer only).
  Raw dump lands OUTSIDE the repo (`../ab-grounding-briefer-raw.json`) — run residue, not committed.
- **Word cap = 20 is HOOKS-ONLY.** A hook is one line; length is the fit constraint. Ideas/script use
  the fit measures in §4. Do NOT inherit the word cap into them.
- **Escape hatches (default-off):** `GROUNDING_HOOKS_ADAPT`, `GROUNDING_HOOKS_SURFACE=structure`,
  `GROUNDING_HOOKS_RANK=topical`.
- **Memory-store note:** the `.claude` memory store is outside this worktree's git root and a path
  guard blocks writes to it from here — this repo doc is the durable record instead.

## 6. Immediate next action for the fresh session

Read this + the decision doc, then either (a) walk the A/B with the owner, or (b) start Phase 2 —
extend the adapt stage to ideas (subject-bound) using the per-skill fit measure, NOT the word cap.
