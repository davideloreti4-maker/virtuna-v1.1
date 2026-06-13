# Requirements: Numen Rework (v5.0)

**Defined:** 2026-06-13
**Core Value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — delivered as one clean thread per video (a "Reading").
**Source:** `.planning/NUMEN-REWORK-BRIEF.md` (LOCKED). Presentation-layer only — engine frozen at 3.19.0.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Shell — home, composer & ingestion

- [ ] **SHELL-01**: User lands on a clean home — serif greeting + the universal composer, centered, with starter chips (Paste link · Upload · Try a demo) and the Numen stele glyph. No Reading list under the composer.
- [ ] **SHELL-02**: User can start a Reading by pasting a video URL into the composer (URL auto-detected).
- [ ] **SHELL-03**: User can start a Reading by uploading a video file via the composer `+` control.
- [ ] **SHELL-04**: Once a Reading exists, the composer drops to bottom-pinned and the thread fills the scroll area; the same composer serves follow-ups (no separate dock).
- [ ] **SHELL-05**: User sees past Readings in a sidebar — collapsible on desktop, drawer on mobile — sourced from `useAnalysisHistory` / `/api/analysis/history`.
- [ ] **SHELL-06**: User can reopen a past Reading from the sidebar and the full thread is restored (permalink).
- [ ] **SHELL-07**: The shell is mobile-first and renders correctly on phones; desktop is the same thread, widened.

### Reading — the consolidated result thread

- [ ] **READ-01**: The Reading lays out top-to-bottom: hero → 3 driver rows → Fix First → deeper read → composer.
- [ ] **READ-02**: The hero shows `overall_score`, zone-colored (green/amber/red), with no prose narration.
- [ ] **READ-03**: The hero surfaces the go/no-go gate (`anti_virality_gated` + reason) when the video is gated.
- [ ] **READ-04**: The hero shows watch-through % (`weighted_completion_pct`/`completion_pct`) — shown exactly once, owned here — plus an audience persona cloud.
- [ ] **READ-05**: The Reading shows 3 always-visible driver rows: Hook (stop-power), Retention (where they drop — `weighted_top_dropoff_t`), Shareability (`share_pull`).
- [ ] **READ-06**: Tapping a driver row reveals its detail (e.g. Hook → modality breakdown + weakest modality).
- [ ] **READ-07**: A "Fix First" block shows the top timestamped fix(es) + copyable hook rewrite(s); extra fixes collapse behind "N more fixes →".
- [ ] **READ-08**: A "Deeper read" expand reveals the remaining 3 Apollo dims (clarity / substance / credibility) + supporting signals.
- [ ] **READ-09**: All existing rich board visuals (RetentionChart, PersonaGraph, filmstrip, FactorBars, SegmentTable, emotion arc, niche/ghost curves…) are preserved as drill-downs — nothing visual is deleted.
- [ ] **READ-10**: Cut data never appears in the Reading (`feature_vector`, `score_weights`, `signal_availability`, dead sub-scores, telemetry, model names, `critique`, `predicted_engagement`, dead modules).

### Reveal — stage-by-stage materialization

- [ ] **REVEAL-01**: While analysis runs, each Reading block/headline materializes as its engine stage completes (driven by `useAnalysisStream`), so the ~45–60s wait reads as progress, not a spinner.
- [ ] **REVEAL-02**: When all stages complete, the thread settles into a stable resting Reading (no layout thrash on completion).

### Theme — flat-warm visual system (HUMAN-UAT-GATED)

- [ ] **THEME-01**: A flat-warm token system replaces the cold base — warm-neutral hue, matte (no glow / shine / halo / ambient lighting); contrast comes from elevation, not effects.
- [ ] **THEME-02**: The Raycast glass (137deg gradient + blur + inset white shine) is removed everywhere it appears, including the sidebar.
- [ ] **THEME-03**: Score zones (green / amber / red) + an evolved (warmer) coral are the only colors; everything else is neutral.
- [ ] **THEME-04**: Serif is used for voice moments (greeting, hero line); sans for all data.
- [ ] **THEME-05**: Hairline borders, generous spacing, and calm/soft motion throughout (Linear / Things restraint).
- [ ] **THEME-06**: The flat-warm visual system passes an explicit human-UAT review gate before it is locked for rollout.

### Chat — basic text follow-up

- [ ] **CHAT-01**: After the Reading, the user can ask a free-text follow-up in the same composer and receive a response inline in the thread (reuse "Ask the expert" `/api/analyze/[id]/chat`).
- [ ] **CHAT-02**: Quick-action chips (e.g. "why this?", "rewrite hook") seed follow-up prompts in the composer.

### Demo — first-run magic

- [ ] **DEMO-01**: A first-time user sees a live demo Reading on a known viral video before uploading anything (rendered with the real Reading components).

## v2 Requirements

Acknowledged but deferred — not in this roadmap. ("The moat gets built on top of a shipped surface, not before it.")

### Agentic tools

- **TOOLS-01**: In-thread agentic tools (e.g. Apify competitor analysis) as follow-up turns.

### Monetization

- **MON-01**: In-thread monetization turns.

### Desktop instrument

- **DESK-01**: Desktop dense-instrument (Konva successor) — revisit only if power users demand it.

### Growth

- **SHARE-01**: Share a Reading as an exported image or public link (growth loop).

## Out of Scope

Explicitly excluded for this milestone.

| Feature | Reason |
|---------|--------|
| Engine / `lib/engine/` changes | Frozen at 3.19.0 — this milestone is presentation-only |
| Konva canvas board | Retired; DOM/React/SVG frames transplant, the canvas shell (pan/zoom/camera) dies |
| Reusing `milestone/numen-surface` `numen/` + `reading/` kit | Reference only — fresh build on the existing board components instead |
| Deleting `/analyze` | Left dormant (not deleted) until we're sure the thread fully replaces it |
| Prose narration / horoscope verdict copy | Vetoed — score-forward instrument, confidence shows through restraint |
| Glow / shine / halo / ambient "presence" lighting | Vetoed — flat-warm matte; contrast from elevation |
| `predicted_engagement` "projected views" | Code flags it false precision (`followers×(score/100)²`) — cut |

## Traceability

Populated during roadmap creation (each requirement maps to exactly one phase).

| Requirement | Phase | Status |
|-------------|-------|--------|
| *(all v1 REQ-IDs — filled by roadmapper)* | TBD | Pending |

**Coverage:**
- v1 requirements: 28 total (SHELL ×7, READ ×10, REVEAL ×2, THEME ×6, CHAT ×2, DEMO ×1)
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 28 ⚠️ (resolved at roadmap creation)

---
*Requirements defined: 2026-06-13*
*Last updated: 2026-06-13 after initial definition (derived from locked NUMEN-REWORK-BRIEF.md)*
