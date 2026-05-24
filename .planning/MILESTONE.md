# Milestone: Engine Hardening

**Branch:** `milestone/engine-hardening`
**Worktree:** `~/virtuna-engine-hardening/`
**Started:** 2026-05-24
**Status:** Active
**Part of:** Intelligence Surface drop (parallel sibling to Result Surface, predecessor to Iteration & Niche Intelligence and Compounding Intelligence)

## Purpose

Close the engine debt left open by M1 (Engine Foundation) so the v3.0.0 pipeline can stand behind a polished UX without quiet bypasses. M1 shipped the engine; this milestone makes it **production-honest** — calibrated, fingerprint-active, type-clean, and verified.

This is a parallel-track milestone to Result Surface. UX work in `~/virtuna-result-surface/` does not depend on this branch and vice versa — both rebase on top of `main`. They merge in any order.

## Position in the Intelligence Surface drop

```
Engine Foundation (M1) ── merged 2026-05-24 ── main
                                                │
                  ┌─────────────────────────────┼────────────────────────┐
                  ▼                             ▼                        │
        Result Surface (M2-I)        Engine Hardening (this)     (later) Iteration & Niche → Compounding
        ~/virtuna-result-surface     ~/virtuna-engine-hardening
        UX magic moment              Engine debt + verification
        (parallel session)           (this session)
```

The two parallel milestones merge independently to `main`. M2-II and M2-III fork only after both are landed.

## Scope (in)

### Calibration debt (M1 carry-forward)
- ~~Refit Platt parameters against a Qwen-scored corpus~~ **REMOVED 2026-05-24** — Platt calibration dropped from the engine entirely (`platt_parameters` table dropped, `calibration.ts` deleted). Framing mismatch surfaced in Phase 15 execution: corpus-based eval ran text-mode on captions but production runs video-mode Omni-Plus; corpus carries post-publication engagement metrics that production never sees at inference. See `.planning/phases/15-calibration-refit-on-qwen-corpus/15-DISCUSSION-LOG.md` tail.
- ~~Rerun Plans 06/07 stratified validation under Qwen with fresh baselines~~ **REMOVED 2026-05-24** — was contingent on the refit landing.
- ~~Re-tune Wave 3 (≥7/10 personas) and Wave 4 (numeric platform_fit) thresholds for the Qwen distribution~~ **REMOVED 2026-05-24** — thresholds remain at their current values; no calibration-driven retune.
- Wire DashScope International billing into the smoke runner for live cost-budget tracking (CALIB-04 — still active in Phase 17, independent of Platt)

### Audio + embedding pipeline (M1 stubs)
- Re-enable `audio-fingerprint.ts` — currently returns `null`; needs re-embed via DashScope embedding model
- Implement `embedder.ts` `embedQuery` + `embedBatch` (both currently `throw "deferred to M2"`)
- Re-enable inline cron embedding pipeline at `/api/cron/calculate-trends` (D-F4 was disabled at the route level)
- Unskip the 17 `.skip`'d tests covering audio-fingerprint, embedder, and D-F4 cron paths

### Type hygiene (pre-existing blocker)
- 966 TypeScript errors in `src/app/api/{profile,settings,team}/*` reference a `user_settings` table that does not exist on the live Supabase project (`qyxvxleheckijapurisj`).
- **Decision required** (Phase 1 of this milestone): either (a) write the migration to actually create `user_settings` + RLS, or (b) rip out the consumers. Path picked once we audit which call sites are still live.
- Goal: clean `pnpm exec tsc --noEmit` across the entire app, not just `src/lib/engine/`.

### Verification debt (M1 deferrals)
- **Phase 2** — UAT deferred (creator-profile 9-card interview end-to-end)
- **Phase 3** — SC#4 + SC#5 DEFERRED-PENDING-LIVE-DEPLOY (post-deploy smoke tests on `/api/analyze` SSE + cache hit)
- **Phase 4** — HUMAN-UAT partial: 2 live-API tests pending (end-to-end Wave 0 content-type via `/api/analyze`, niche-detector cost-cents > 0 with cache breakdown absent)
- **Phase 6** — Code-review follow-ups: WR-04 (cron N+1), WR-05 (audio_description bounds nesting), IN-01 (video-analysis retry restructure), IN-02 (pgvector cast helper), IN-03 (sound_url SSRF allowlist — Phase 12 threat model T-06-13)

## Scope (out — belongs elsewhere)

- Any UX/UI surface work → **Result Surface (M2-I)** in `~/virtuna-result-surface/`
- Concept mode, A/B variant flow, hook archetype library → **Iteration & Niche Intelligence (M2-II)** (not yet drafted)
- Outcome feedback loop, weekly intelligence report → **Compounding Intelligence (M2-III)** (not yet drafted)
- New engine signals (`optimal_post_window`, emotion arc) → Result Surface soft deps (handled there)
- Engine architecture changes — the M1 pipeline is treated as locked; this milestone fixes only what M1 left explicitly open

## Stack decisions (locked at milestone start)

- **Embedding model:** DashScope `text-embedding-v3` (768-dim, matches M1 pgvector schema). No fallback to Gemini — the migration to DashScope-only is intentional and aligns with the Qwen-only engine post-`9794ffa`.
- ~~**Calibration storage:** Reuse the existing `platt_parameters` row schema...~~ **REVERSED 2026-05-24.** `platt_parameters` table dropped. Calibration removed from engine.
- **Smoke runner billing:** Read DashScope billing endpoint at the end of each smoke run, persist `cost_cents_actual` alongside `cost_cents_estimated`. No mid-run polling (avoid hot path).
- **TS errors:** Default path is **write the migration** (option a). Only rip out consumers if the call-site audit shows the routes are dead. Decision locked in Phase 1.

## Dependencies

### Hard (must exist before this milestone implementation)
- ✅ Engine Foundation milestone closed (commit `8c50635` on `main`, ENGINE_VERSION 3.0.0 at `791a577`)
- ✅ Qwen migration landed (`9794ffa` + follow-ups in `10eb111`)
- ✅ pgvector + `trending_sounds.audio_embedding vector(768)` + HNSW index live on Supabase (M1 Phase 6 deliverable)
- ✅ `analysis_results` cache with content-hash + engine-version + user-id keying (M1 Phase 3 deliverable)
- ✅ Pre-flight green state: `pnpm vitest run` 996/996 (17 skipped), `pnpm exec tsc --noEmit` 0 errors *in engine paths*, `pnpm build` green
- ✅ Live DashScope International account with billing enabled (already used in production)

### Soft (will be confirmed in Phase 1)
- DashScope embedding API quota fits the corpus size (225 rows + ongoing trending-sounds ingest)
- `user_settings` consumer audit confirms whether the migration path or rip-out path is correct

## Success criteria

This milestone ships when:

1. `pnpm vitest run` passes with **zero `.skip`** in audio-fingerprint, embedder, and D-F4 cron paths
2. `pnpm exec tsc --noEmit` returns **0 errors across the entire app** (not just engine paths)
3. ~~Platt calibration row in `platt_parameters`...~~ **REMOVED 2026-05-24** — Phase 15 cancelled; Platt calibration dropped from engine; success criterion no longer applicable.
4. ~~Stratified validation report~~ **REMOVED 2026-05-24** — was contingent on the Platt refit.
5. `audio_fingerprint` match returns non-null on at least one trending sound in a live `/api/analyze` E2E run (against a real video with a known matching audio)
6. Smoke runner output includes a `cost_cents_actual` field sourced from DashScope billing
7. All M1 verification-debt items (Phases 2/3/4/6) are either resolved or moved to an explicit "permanently deferred" list with rationale

## Identity

This file is immutable. Signals to all sessions opened in this worktree that they are scoped to the Engine Hardening milestone, regardless of which branch is checked out.

**Sibling milestone:** Result Surface (`~/virtuna-result-surface/`, branch `milestone/result-surface`) — magic-moment UX layer.

**Next after merge:** Once both Engine Hardening and Result Surface are on `main`, fork `milestone/iteration-intelligence` and `milestone/compounding-intelligence` as parallel worktrees from `main`.
