# Phase 11: Existing UI Integration + Privacy Policy - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Three coupled tasks:

1. **Engine v3 wiring** — Verify `/api/analyze` has no leftover Phase 10 dev guards; confirm `engine_version` field surfaces `3.0.0-dev` in results; run smoke test end-to-end in both `tiktok_url` and `video_upload` modes.

2. **Dashboard basic display** — Updated `PredictionResult` renders: viral score (no calibration badge unless explicitly calibrated), `signal_availability` as a chip list under the score ring, no new detail panels (persona/audio/hook/retrieval all deferred to M2). Existing `ViralScoreRing` + `FactorsList` + `FactorCard` components unchanged.

3. **Storage retention + privacy** — 30-day auto-delete cron for uploaded videos (unless user opts in via Settings toggle). Expandable "About your data" disclosure below video-upload dropzone. INT-07 (GDPR data export) deferred to M2.

4. **PROFILE-16 micro-card** — Re-prompt "Is your goal still X?" every 10 analyses via inline banner post-result. Increment `analysis_count` on `creator_profiles` in `/api/analyze` on successful result.

**Out of scope this phase:**
- Polished result panels (persona viz, audio breakdown, hook decomp, retrieval evidence cards) — M2
- INT-07 GDPR data export / deletion request — M2
- ENGINE_VERSION `3.0.0-dev` → `3.0.0` flip — Phase 12 acceptance gate
- Any new engine pipeline changes (Phase 10 owns aggregator + calibration)
- Watermark detection UI, anti-virality UI surfaces — M2

**Phase 10 speculative sync note:** Before executing Phase 11 plans, confirm from Phase 10:
1. Final `ENGINE_VERSION` tag (should be `3.0.0-dev`)
2. Whether `ML_SIGNAL_WEIGHT` was set to 0 (ML disabled) or a tuned value
3. Whether `platt_parameters` DB table exists (Platt training CLI ran)

</domain>

<decisions>
## Implementation Decisions

### Dashboard Display

- **D-01: Score + availability only for M1.** Updated viral score renders as-is. No calibration badge. All new detail panels (personas, audio, hook decomp, retrieval evidence) are hidden until M2. `FactorsList` renders only existing known factors — new top-level fields (`platform_fit`, `retrieval_score`) are ignored in the UI.

- **D-02: signal_availability as chip list under score ring.** Small chip row beneath `ViralScoreRing`: e.g., `Audio ✓`, `Personas ✓`, `Retrieval ✗`. Chips greyed/strikethrough if that signal was unavailable on this prediction. Handles ML disabled case naturally (`ML ✕` chip) with no special code path.

- **D-03: No calibration badge if is_calibrated = false.** Score shows normally. No "beta accuracy" label. Simplest path — surfaces calibration status only implicitly via chip list.

### Storage Retention Policy

- **D-04: One-time settings toggle for opt-in.** Settings page (existing Profile tab or new Data subsection): "Keep my uploaded videos for re-analysis" toggle. Sticky preference. Default off (auto-delete at 30 days). No per-upload friction.

- **D-05: Expandable disclosure in upload UI.** `video-upload.tsx` gets an "About your data ▾" expandable below the dropzone. Collapsed by default. Expands to: "Videos are automatically deleted after 30 days. Adjust this in Settings." Satisfies INT-06 without visual noise.

- **D-06: INT-07 (GDPR export/deletion) deferred to M2.** Out of Phase 11 scope. Note in REQUIREMENTS.md traceability.

### PROFILE-16 Micro-card

- **D-07: Inline banner post-result.** When `analysis_count % 10 === 0` and user has a profile, render a collapsible banner at the top of the results view: "Quick check — is your goal still X?" with single-tap answer. Non-blocking; user can dismiss.

- **D-08: analysis_count incremented in /api/analyze on success.** After pipeline completes and prediction stored, fire `UPDATE creator_profiles SET analysis_count = analysis_count + 1 WHERE user_id = $userId`. Atomic with the analysis result write, no background lag.

### Engine v3 Wiring

- **D-09: Remove Phase 10 dev guards if any; then smoke test.** Check aggregator.ts + pipeline.ts for any disabled-by-default flags added in Phase 10. If found, enable. Then run smoke test for both `tiktok_url` and `video_upload` modes end-to-end. If Phase 10 left no guards (expected per Phase 10 D-02 pattern), this is a no-op + smoke test.

- **D-10: ML disabled = chip shows 'ML ✕', no special handling.** If `signal_availability.ml_classifier = false`, the chip list renders it as unavailable. No UI branch, no special message. Smoke test does not need to assert ML-disabled behavior specifically.

### Claude's Discretion

- Exact placement of "About your data" expandable within `video-upload.tsx` layout (below dropzone, above submit area, or as an icon tooltip)
- Whether retention settings toggle lives in existing Profile tab (6th tab from Phase 2) or warrants a new "Data" subsection
- Chip list component choice: reuse existing `Badge` component (already imported in video-upload.tsx) or inline spans

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Components to Modify
- `src/components/app/video-upload.tsx` — add "About your data" disclosure below dropzone; increment analysis_count trigger lives in the API route not here
- `src/components/viral-results/ViralScoreRing.tsx` — add signal_availability chip list below ring
- `src/components/viral-results/FactorsList.tsx` — confirm it ignores unknown fields gracefully (no changes if it already does)
- `src/components/ui/badge.tsx` — candidate component for chip list rendering (already in video-upload.tsx imports)

### API Route
- `src/app/api/analyze/route.ts` — Phase 11 smoke test target; analysis_count increment added here on success

### Profile Gate (Phase 2 work — reference only)
- `src/components/app/video-upload.tsx` — INT-02 already wired (profile gate on upload click); Phase 11 adds disclosure UI only, not gate logic
- `src/app/(app)/settings/` — retention toggle destination

### Engine + Aggregator (read-only for Phase 11)
- `src/lib/engine/aggregator.ts` — Phase 10 modified; Phase 11 reads to confirm no dev guards remain
- `src/lib/engine/version.ts` — verify ENGINE_VERSION is `3.0.0-dev`; do NOT modify (Phase 12 owns the flip)
- `src/lib/engine/types.ts` — `PredictionResult` interface; Phase 11 reads to confirm dashboard handles new optional fields gracefully

### DB Schema
- `src/types/database.types.ts` — `analysis_count` column already exists on `creator_profiles` (confirmed in scout)
- `supabase/migrations/` — retention cron may need a `storage_retention_opted_in` boolean column on `creator_profiles` or `user_settings`

### Requirements
- `.planning/REQUIREMENTS.md` §INT-01..07 — Phase 11 requirements; INT-07 deferred
- `.planning/ROADMAP.md` §Phase 11 — success criteria (6 SCs; SC2 and SC6 already met in Phase 2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Badge` component (`src/components/ui/badge.tsx`): already used in `video-upload.tsx`; reuse for signal_availability chips
- `ProfileInterviewModal` (Phase 2): micro-card is NOT the full modal — it's a single-question inline banner; do not reuse the modal
- `analysis_count` column: already in DB schema, no migration needed for the counter itself
- Existing cron infrastructure at `src/app/api/cron/` (confirmed by Phase 6 + 10 context): retention cron follows same pattern

### Established Patterns
- `creator_profiles` UPDATE pattern: Phase 2 used `supabase.from('creator_profiles').upsert(...)` — retention toggle + analysis_count increment use same client
- Cron scripts in `src/app/api/cron/`: Phase 10 added `calibration-audit` cron; retention cron follows same vercel.json config pattern
- Phase 10 D-02: no feature flags, direct constant edits — expect no dev guards in aggregator

### Integration Points
- `ViralScoreRing` → add chip list below ring for signal_availability
- `/api/analyze` route → add analysis_count UPDATE on success + retention-opted-in flag check before Supabase Storage delete scheduling
- `video-upload.tsx` → add "About your data ▾" expandable disclosure
- Settings page (6th tab from Phase 2) → add retention toggle

</code_context>

<specifics>
## Specific Ideas

- PROFILE-16 banner question: "Is your goal still [goal from Card 0]?" — pull from `creator_profiles.goal` field
- Chip list layout: horizontal row, muted text, e.g.: `Audio ✓  Personas ✓  Retrieval ✓  ML ✕` — small, non-intrusive
- "About your data ▾" expandable: collapsed by default; expand reveals: "Your uploaded video is stored temporarily for analysis and deleted automatically after 30 days. To keep it for re-analysis, go to Settings > [Data/Profile]."

</specifics>

<deferred>
## Deferred Ideas

- **INT-07 GDPR data export + deletion request** — Deferred to Intelligence Surface milestone (M2). Phase 11 ships retention cron + disclosure; user-triggered export/deletion is out of M1 scope.
- **Polished result panels** (persona viz, audio breakdown, hook decomp cards, retrieval evidence cards, calibration confidence banner) — M2 Intelligence Surface milestone.
- **Anti-virality / don't-post-yet UI** — Logic ships M1, surfacing waits for M2.
- **Watermark detection UI** — Logic ships M1, surfacing waits for M2.

</deferred>

---

*Phase: 11-Existing UI Integration + Privacy Policy*
*Context gathered: 2026-05-20*
