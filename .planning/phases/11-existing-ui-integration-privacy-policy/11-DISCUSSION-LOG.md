# Phase 11: Existing UI Integration + Privacy Policy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 11-existing-ui-integration-privacy-policy
**Areas discussed:** Dashboard basic display, Retention policy UX, PROFILE-16 micro-card, Analyze route v3 switch

---

## Dashboard Basic Display

| Option | Description | Selected |
|--------|-------------|----------|
| Score + availability only | Viral score + signal_availability chips. All detail panels hidden until M2. | ✓ |
| Collapsed accordions | Collapsed-by-default sections for each signal group (Personas, Audio, Hook, Retrieval). | |
| Existing layout + new top-level fields | Extend FactorsList with platform_fit/audio/behavioral. Retrieval + hook decomp deferred. | |

**User's choice:** Score + availability only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show score as-is, no badge | No calibration status surfaced. Score always shows normally. | ✓ |
| Show 'beta accuracy' label | Small muted label if is_calibrated = false. | |
| You decide | Claude picks fallback display. | |

**User's choice:** Show score as-is, no badge

---

| Option | Description | Selected |
|--------|-------------|----------|
| Stay hidden until M2 | platform_fit + retrieval_score ignored in FactorsList. | ✓ |
| Include if non-null | Add as factor cards if present. | |

**User's choice:** Stay hidden until M2

---

| Option | Description | Selected |
|--------|-------------|----------|
| Small chip list under score ring | Compact chips (Audio ✓, Personas ✓, etc.) under ViralScoreRing. | ✓ |
| Tooltip on score ring | Hover/tap ring to see signal breakdown. | |
| Skip it entirely for now | Don't surface signal_availability in M1 at all. | |

**User's choice:** Small chip list under score ring

---

## Retention Policy UX

| Option | Description | Selected |
|--------|-------------|----------|
| One-time settings toggle | Sticky opt-in in Settings. No per-upload friction. | ✓ |
| Checkbox on upload form | Explicit per-upload consent. More GDPR-defensible. | |
| Both | Settings default + inline override. | |

**User's choice:** One-time settings toggle

---

| Option | Description | Selected |
|--------|-------------|----------|
| Static note below upload zone | Always-visible muted text under dropzone. | |
| Expandable disclosure | "About your data ▾" link expands full policy text. | ✓ |
| You decide | Claude picks placement. | |

**User's choice:** Expandable disclosure ("About your data ▾")

---

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Data & Privacy' section in Settings | 7th tab or subsection with delete + export actions. | |
| Footer link on existing Settings page | 'Manage my data' link at bottom. | |
| Defer INT-07 to M2 | Ship retention cron + disclosure; defer export/deletion to Intelligence Surface. | ✓ |

**User's choice:** Defer INT-07 to M2

---

## PROFILE-16 Micro-card

| Option | Description | Selected |
|--------|-------------|----------|
| Modal interrupt pre-analysis | Blocks briefly before analysis runs. Higher completion rate. | |
| Inline banner post-result | Non-blocking collapsible banner after analysis completes. | ✓ |
| Toast → settings | Low friction, low completion. | |

**User's choice:** Inline banner post-result (Claude recommended option 2; user confirmed)

---

| Option | Description | Selected |
|--------|-------------|----------|
| In /api/analyze on successful result | Atomic with analysis write. No lag. | ✓ |
| In a cron/background job | Count from analysis_results. May lag. | |

**User's choice:** Increment in /api/analyze on success

---

## Analyze Route v3 Switch

| Option | Description | Selected |
|--------|-------------|----------|
| Smoke test only — no code changes needed | Route already calls pipeline; Phase 10 changes aggregator. Phase 11 = verify + smoke test. | |
| Remove any Phase 10 dev guards | Check for flags/gates, enable if found, then smoke test. | ✓ |

**User's choice:** Remove dev guards if any + smoke test (Claude recommended; expected to be no-op per Phase 10 D-02 pattern)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing — signal_availability chip shows 'ML ✕' naturally | No special handling for ML-disabled case. | ✓ |
| Add a note to the smoke test | Assert ML-disabled renders correctly. | |

**User's choice:** Nothing — chip list handles it naturally

---

## Claude's Discretion

- Exact placement of "About your data" expandable within `video-upload.tsx` layout
- Whether retention toggle lives in existing Profile tab (6th) or warrants a new "Data" subsection
- Chip list component choice: `Badge` vs inline spans

## Deferred Ideas

- INT-07 GDPR data export + deletion request — M2 Intelligence Surface milestone
- Polished result panels (persona viz, audio, hook, retrieval, calibration banner) — M2
- Anti-virality / don't-post-yet UI surface — M2
- Watermark detection UI — M2
