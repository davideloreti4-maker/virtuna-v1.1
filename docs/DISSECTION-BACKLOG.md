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
| A-T | 🎯 | **Implement target 3-position model** (STEER real via attributes; weights → REACT+REFINE) | — | OPEN |

## Generative skills + Flash SIM (§03)

| # | Sev | Item | file:line | Status |
|---|-----|------|-----------|--------|
| S1 | 🟠 | `script` + `remix` build SIM panel without `resolveNicheKey` → niche-blind "all Mixed" reactions | script-runner, remix-runner | OPEN |
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
| E1 | 🟠 | CSRF guard missing on `ideas`, `ideas/develop`, `refine`, `react` (ideas header falsely claims it) | tool routes | OPEN |
| E2 | 🟢 | 10-line audience-resolve block copy-pasted into ~7 routes → extract one helper | tool routes | OPEN |
| E3 | 🟡 | Grounded-thread machinery has no production writer (`createGroundedThreadLazy` test-only) | `threads.ts` | OPEN |

## Grounding / KC + cross-cutting cuts (§05)

| # | Sev | Item | file:line | Status |
|---|-----|------|-----------|--------|
| G1 | 🟢 | `_dormant/` tree ~7.3K LOC, zero real imports | `src/lib/engine/_dormant/` | OPEN |
| G2 | 🟢 | Dead-shipped simulation UI (14 files) | `src/components/app/simulation/*` | OPEN |
| G3 | 🟢 | `refresh-corpus` cron stub (no-op) | `cron/refresh-corpus/route.ts:23` | OPEN |
| G4 | 🟡 | Fake §N chat citations (no real RAG) — fix taxonomy or drop | `chat/seed-context.ts:90-106` | OPEN |
| G-D | 🎯 | **Decide: is M2 RAG alive?** gates ~2K LOC of cuts (pgvector + corpus scripts) | `engine/retrieval/` | OPEN |

---

## DONE
_(move items here with FIXED sha as they land)_
