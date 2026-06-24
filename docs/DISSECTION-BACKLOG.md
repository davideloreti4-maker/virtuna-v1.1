# Engine Dissection — Living Backlog

> Every refinement, bug, and cut spotted during the live engine dissection. Capture
> immediately with severity + `file:line`. This is the emergent output of the dissection
> (see `ENGINE-ATLAS.md` §"Dissection method"). Check items off / move to DONE as they land.
>
> Severity: 🔴 blocks-trust/moat · 🟠 real bug/quality · 🟡 polish/mismatch · 🟢 cut/cleanup
> Status: `OPEN` · `IN-WORKTREE` · `FIXED <sha>`

Seeded 2026-06-22 from the 5-agent trace. Live dissection will add to this.

---

## Audience (§02) — start here

| # | Sev | Item | file:line | Status |
|---|-----|------|-----------|--------|
| A1 | 🔴 | `resolveAudienceWeights()` computed then `void`-ed in every text runner — numeric calibration influences nothing live | text runners | OPEN |
| A2 | 🔴 | `deriveAudienceProfile()` ignores scraped videos → every audience gets identical profile + grounding line | `calibration.ts` (deriveAudienceProfile) | OPEN |
| A3 | 🟠 | `goal_intent` `sell` and `authority` map to byte-identical weights | `biasForGoalIntent` | OPEN |
| A4 | 🟠 | Presets ship `personas:[]` → near-inert; preset materialization appears unwired | PRESET_AUDIENCES | OPEN |
| A5 | 🟡 | Flywheel nudge is 0.05 in code vs ±0.1 in docs | `recalibration.ts:33` | OPEN |
| A6 | 🟡 | `(supabase as any)` casts throughout audience repo — type debt | `audience-repo.ts` | OPEN |
| A7 | 🟠 | **Orphan draft row** — `audience-form` POSTs `/api/audiences` (draft), then `calibrate` route `createAudience`s a SECOND row; `audienceId` sent by client is ignored (not in `CalibrateSchema`). Every calibrated personal/target audience leaks an uncalibrated dupe. Fix: `calibrate` now accepts `audienceId` and `updateAudience`s the draft in place (falls back to insert when absent). Live-verified 2026-06-24: row_count 1, same draft id enriched. +route test. | `calibrate/route.ts` | FIXED (working tree) |
| A-T | 🎯 | **Implement target 3-position model** (STEER real via attributes; weights → REACT+REFINE) | — | OPEN |

## Generative skills + Flash SIM (§03)

| # | Sev | Item | file:line | Status |
|---|-----|------|-----------|--------|
| S1 | 🟠 | `script` + `remix` build SIM panel without `resolveNicheKey` → niche-blind "all Mixed" reactions. FIX: both now route through shared `buildReactionPanel(profileRow, audience)` (resolveNicheKey + byte-identical repaint), matching hooks/ideas. tsc clean, runner suites 26/26, audience-regression gate green. | script-runner:273, remix-runner:209 | FIXED (working tree) |
| S2 | 🟠 | Follow-up chat is on the hooks/ideas critical path (blocks `done`) — stream after `done` | hooks-runner / ideas-runner | OPEN |
| S3 | 🟢 | 8-call SIM fan-out → collapse to one batched simulation call (eval-gated) | `gateHooks` / `runFlashTextMode` | OPEN |
| S4 | 🟢 | Dead `flashRunner` / `ToolRunner` / `dispatchToolOutput` scaffolding (~200 LOC) | `flash-runner.ts` | OPEN |
| S5 | 🟡 | Rubric critic infra OFF, ~100% fail — recalibrate or delete (255 LOC + dual-branch gates) | `flash/rubric-critic.ts` | OPEN |

## The Read — video pipeline (§04)

| # | Sev | Item | file:line | Status |
|---|-----|------|-----------|--------|
| R1 | 🟡 | `FOLD_MODEL` defaults to omni-flash (unstable); memory says omni-plus PAID — flip + cost decision | `qwen/client.ts`, `wave3/fold.ts` | OPEN |
| R2 | 🟡 | `behavioral_score` + `apollo_score` may double-count the same Apollo call | `aggregator.ts` | OPEN |
| R3 | 🟡 | 0.5/0.5 video blend asserted, never calibrated | `aggregator.ts` | OPEN |
| R4 | 🟢 | Dead engine signals matching logic (ml/rule/trend/audio_fingerprint/platform_fit) | `aggregator.ts:1170-1253` | OPEN |
| R5 | 🟢 | `wave0 confidence:1.0` fabricated; `applyCtaPenalty`/`FeatureVector` no consumer | wave0 / aggregator | OPEN |

## Envelope + spine (§01)

| # | Sev | Item | file:line | Status |
|---|-----|------|-----------|--------|
| E1 | 🟠 | CSRF guard missing on `ideas`, `ideas/develop`, `refine`, `react` (ideas header falsely claims it). FIX: added shared `csrfGuard(request)` right after the auth gate in all 4 (415 Content-Type + 403 cross-origin), matching hooks/script/remix/chat. tsc+eslint clean; 18 route tests green (clients already send `application/json`). | tool routes | FIXED (working tree) |
| E2 | 🟢 | 10-line audience-resolve block copy-pasted into ~7 routes → extract one helper | tool routes | OPEN |
| E3 | 🟡 | Grounded-thread machinery has no production writer (`createGroundedThreadLazy` test-only) | `threads.ts` | OPEN |

## Grounding / KC + cross-cutting cuts (§05)

| # | Sev | Item | file:line | Status |
|---|-----|------|-----------|--------|
| G1 | 🟢 | `_dormant/` tree (80 files, 6.3K prod + 6.4K test LOC), zero hot-path imports | `src/lib/engine/_dormant/` | FIXED 8e84b201 |
| G2 | 🟢 | Dead-shipped simulation UI (14 comp + test-creation-flow, ~1.8K LOC) | `src/components/app/simulation/*` | FIXED bbee1774 |
| G3 | 🟢 | `refresh-corpus` cron stub (no-op) | `cron/refresh-corpus/route.ts:23` | OPEN |
| G4 | 🟡 | Fake §N chat citations (no real RAG) — fix taxonomy or drop | `chat/seed-context.ts:90-106` | OPEN |
| G-D | 🎯 | **DECIDED: M2 RAG is NOT alive** — query path stubbed (`pipeline.ts:34` uses `createEmptyRetrievalResult`; `runBenchmarkRetrieval`/`retrieval-stage`/`pgvector` never called in prod). Cut DEFERRED: `engine/retrieval/` (888+1495 test LOC) is entangled with the MIXED `engine/corpus/` dir (live utils `follower-tier`/`embedder`/`thresholds` + dead eval/RAG harness) → needs a per-module surgical pass w/ cascade check, NOT a wholesale delete. | `engine/retrieval/`, `engine/corpus/` | DEFERRED (verdict logged) |

---

## DONE
_(move items here with FIXED sha as they land)_

### 2026-06-24 — G1 + G2 dead-code cuts + G-D verdict
- **G2 FIXED bbee1774** — deleted `src/components/app/simulation/` (14 components + 5 tests, ~1.8K LOC)
  + `test-creation-flow.tsx` (its only sim consumer, itself dead — only a comment + the barrel referenced
  it). Pruned the dead simulation/test-creation re-export block from `components/app/index.ts`. Zero prod
  consumers (the sole barrel importer, `layout.tsx`, uses only `AppShell`). Test-file "simulation/" matches
  are string placeholders, not imports.
- **G1 FIXED 8e84b201** — deleted `src/lib/engine/_dormant/` (80 files, 6.3K prod + 6.4K test LOC) +
  `engine/__tests__/creator-rules.test.ts` (the one external test importing dormant). Every other external
  ref was a historical-move comment. Live pipeline uses the `retrieval-empty` stub, never dormant modules.
- **G-D DECIDED: M2 RAG is NOT alive.** Live `pipeline.ts:34` imports `createEmptyRetrievalResult`; the real
  retrieval query path (`runBenchmarkRetrieval`/`retrieval-stage`/`pgvector-client`) has zero prod callers —
  only dead orchestrators (`engine/corpus/orchestrator.ts`, no prod importer) + tests import `engine/retrieval/`.
  **Cut deferred** (entangled): `engine/corpus/` is MIXED — live utils (`follower-tier` → account-read +
  audience/calibration; `embedder` → apify webhook; `thresholds` → retrieval) tangled with the dead eval/RAG
  harness. Needs a surgical per-module pass + dependency-cascade check, not a wholesale delete. ~2.4K+ LOC.
- **Verify (both cuts):** tsc error count held at baseline 65 (zero new errors) after each delete · full suite
  3018 pass (only the 3 pre-existing DELETE-415 CSRF quirks fail) · ENGINE_VERSION 3.19.0 untouched.

### 2026-06-24 — Track B step-9 (flywheel/drift re-bake) (working tree)
- **Step 9 DONE — drift cron re-bakes the frozen signature.** Per §P.1 the weekly
  `cron/audience-drift` is the ONLY place the frozen §P signature re-bakes. It already re-scraped
  each personal own-account audience (`calibrateFromScrape`) but **discarded** the freshly-derived
  `result.audience.signature` — using only the personas for drift detection — so the row's frozen
  signature/creator_persona never refreshed (went stale). FIX: after the honesty gate, persist the
  fresh `signature` + `creator_persona` + legacy `profile`/`personas`/`calibration` back to the row
  on **every clean (non-thin) re-scrape** (DECISION: refresh-on-rescrape, not shift-gated).
- **`persona_weights` deliberately NOT written** by the re-bake (DECISION: orthogonal loops) — it's
  the flywheel's analysis_override slot (`propose.confirmProposal` → `buildOverride`), so the
  reality-refresh loop (voice/dispositions) stays separate from the learned-nudge loop (weights).
  Re-bake runs BEFORE drift detection but uses a service-client raw `.update()` (matching the cron's
  existing raw inserts — `updateAudience` can't be used: it calls `auth.getUser()`, null under the
  service role). Drift `predicted` still reads the OLD in-memory stored mix. Re-bake failure is logged,
  never blocks drift logging (independent signals). Response gains a `rebaked` counter.
- **Verify:** tsc clean (audience-drift) · eslint 0 issues · 5 new route tests green
  (no-shift-still-rebakes / shift-rebakes+logs / weights-never-written / thin-skips-both /
  rebake-failure-doesn't-block-drift) · steer-closure General-regression gate green (11/11) ·
  ENGINE_VERSION 3.19.0 untouched. **AudienceSignature build (steps 1-9) now COMPLETE.**

### 2026-06-24 — E1 CSRF guard (§01) (working tree)
- **E1 FIXED:** `ideas`/`ideas/develop`/`refine`/`react` were state-mutating cookie-auth POSTs with NO
  CSRF guard (ideas doc-header falsely claimed it). Added shared `csrfGuard(request)` immediately after
  the auth gate in all 4 (415 on non-`application/json` + 403 on cross-origin Origin mismatch), identical
  to the hooks/script/remix/chat pattern. Production clients (stream hooks + composer react fetch) already
  send `application/json` → no behavior change for them. tsc + eslint clean; 18 route tests green.

### 2026-06-24 — Track B step-8 (composer intent · GAP-C1 + C2) (working tree)
- **GAP-C2 DECIDED: "keep 2, derive down."** Composer keeps the 2-value per-run lens (`grow|sell`);
  new `src/lib/audience/intent-lens.ts` (`goalIntentToLens` 4→2, `parseIntentLens`) maps the audience's
  4-value `goal_intent` down for the default (authority/nurture→grow — they're calibration-time postures
  already baked into `GOAL_INTENT_BIAS` + `GOAL_INTENT_SUFFIX`). Run-body `intent` is the 2-value lens.
- **GAP-C1 FIXED: intent now reaches all 5 skills.** SIM seam = `buildFlashUserContent(text, framing, intent?)`
  appends a `SELL_LENS_DIRECTIVE` to the **user message** only when `intent==='sell'` (verdict tokens
  unchanged; system-prompt cache prefix + ENGINE_VERSION untouched). Threaded: `runFlashTextMode` → 4
  runners (`simIntent` gated to calibrated audiences) → 5 routes (`effectiveIntent = body ?? goal_intent`)
  → 4 `use-*-stream.start(…, intent)` → `composer.tsx` (derived `intent = intentOverride ?? lens(goal_intent)`;
  switch-audience clears the override via the event handler, no setState-in-effect).
- **Gate-safe by construction:** General/no-audience → `intent → undefined` → byte-identical (proven:
  `undefined === grow` in `buildFlashUserContent`; steer-closure General-regression gate green).
- **Verify:** tsc clean (touched src; 17 pre-existing unrelated errors only) · eslint 0 new (composer net
  errors/warnings unchanged vs HEAD) · 413 tests green (incl. new `intent-lens.test.ts` 14 + flash-prompts
  intent block 5). ENGINE_VERSION 3.19.0 untouched. **Still deferred:** step-9 flywheel/drift re-bake;
  remix generation-voice (adapt path); live E2E of the sell lens (LLM-honors-buying-frame, ~$0.05).

### 2026-06-24 — Track A wire-live + Track B step-7 (working tree, auto-wip)
- **Migration applied** `20260624000000_audience_signature.sql` → DB `qyxvxleheckijapurisj`; generated types match hand-added cols (no drift). Full authed browser UAT green (create→calibrate→reveal→persist→navigate, @doctormike, real Apify+DashScope).
- **A7** orphan-draft FIXED — calibrate route accepts `audienceId` → `updateAudience` in place. Live-verified row_count 1.
- **S1** niche-blind FIXED — `script`/`remix` route through shared `buildReactionPanel` (resolveNicheKey).
- **Step-7 SIM half** — FINDING: already live. `personasFromSignature` maps `repaint = reaction_frame`; runners fold repaint into `buildNicheAwareSystemPrompt`. No work needed.
- **Step-7 generation half** — DONE. New `applyCreatorPersona(profileRow, audience)` helper: voice FALLBACK (manual `writing_voice_sample` wins; auto-derived `writing_style_sample` backfills) + `content_description`/`context` steer into overrides. Wired into idea/hooks/script runners (remix generates via adapt, not assembleBundle — deferred). General/no-audience byte-identical (gate-safe, prompt-level proven). +unit test (6 cases) + no-LLM prompt-proof.
- Verify: tsc clean (src), 104 runner+kc + 149 audience/gate tests green, eslint 0 errors. Pre-existing only: 3 DELETE-415 route quirks, 1 stale eslint-disable.
