# Requirements: Numen Rework (v5.0)

**Defined:** 2026-06-13
**Core Value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — delivered as one clean thread per video (a "Reading").
**Source:** `.planning/NUMEN-REWORK-BRIEF.md` (LOCKED). Presentation-layer only — engine frozen at 3.19.0.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Shell — home, composer & ingestion

- [x] **SHELL-01**: User lands on a clean home — serif greeting + the universal composer, centered, with starter chips (Paste link · Upload · Try a demo) and the Numen stele glyph. No Reading list under the composer.
- [x] **SHELL-02**: User can start a Reading by pasting a video URL into the composer (URL auto-detected).
- [x] **SHELL-03**: User can start a Reading by uploading a video file via the composer `+` control.
- [x] **SHELL-04**: Once a Reading exists, the composer drops to bottom-pinned and the thread fills the scroll area; the same composer serves follow-ups (no separate dock).
- [x] **SHELL-05**: User sees past Readings in a sidebar — collapsible on desktop, drawer on mobile — sourced from `useAnalysisHistory` / `/api/analysis/history`.
- [x] **SHELL-06**: User can reopen a past Reading from the sidebar and the full thread is restored (permalink).
- [x] **SHELL-07**: The shell is mobile-first and renders correctly on phones; desktop is the same thread, widened.

### Reading — the consolidated result thread

- [x] **READ-01**: The Reading lays out top-to-bottom: hero → 3 driver rows → Fix First → deeper read → composer.
- [x] **READ-02**: The hero shows `overall_score`, zone-colored (green/amber/red), with no prose narration.
- [x] **READ-03**: The hero surfaces the go/no-go gate (`anti_virality_gated` + reason) when the video is gated.
- [x] **READ-04**: The hero shows watch-through % (`weighted_completion_pct`/`completion_pct`) — shown exactly once, owned here — plus an audience persona cloud.
- [x] **READ-05**: The Reading shows 3 always-visible driver rows: Hook (stop-power), Retention (where they drop — `weighted_top_dropoff_t`), Shareability (`share_pull`).
- [x] **READ-06**: Tapping a driver row reveals its detail (e.g. Hook → modality breakdown + weakest modality).
- [x] **READ-07**: A "Fix First" block shows the top timestamped fix(es) + copyable hook rewrite(s); extra fixes collapse behind "N more fixes →".
- [x] **READ-08**: A "Deeper read" expand reveals the remaining 3 Apollo dims (clarity / substance / credibility) + supporting signals.
- [ ] **READ-09**: All existing rich board visuals (RetentionChart, PersonaGraph, filmstrip, FactorBars, SegmentTable, emotion arc, niche/ghost curves…) are preserved as drill-downs — nothing visual is deleted.
- [x] **READ-10**: Cut data never appears in the Reading (`feature_vector`, `score_weights`, `signal_availability`, dead sub-scores, telemetry, model names, `critique`, `predicted_engagement`, dead modules).

### Reveal — stage-by-stage materialization

- [x] **REVEAL-01**: While analysis runs, the Reading shows a branded skeleton of its IA that fills in from the real signals surviving the composer→permalink nav (personas streaming + keyframes extracting, via the reconnect SSE), so the ~45–60s wait reads as progress, not a spinner. *(Real-signal fidelity — the approved Phase-4 scope: literal per-engine-stage block reveal isn't reachable because stage events don't survive nav and the frozen engine doesn't persist stage progress. See STATE decision.)*
- [x] **REVEAL-02**: When the Simulation completes, the core blocks (hero → rows → Fix First) cascade in via a calm reduced-motion-gated fade-up and settle with no layout thrash (the skeleton reserves the IA rhythm).

### Theme — flat-warm visual system (HUMAN-UAT-GATED)

- [x] **THEME-01**: A flat-warm token system replaces the cold base — warm-neutral hue, matte (no glow / shine / halo / ambient lighting); contrast comes from elevation, not effects.
- [x] **THEME-02**: The Raycast glass (137deg gradient + blur + inset white shine) is removed everywhere it appears, including the sidebar.
- [x] **THEME-03**: Score zones (green / amber / red) + an evolved (warmer) coral are the only colors; everything else is neutral.
- [x] **THEME-04**: Serif is used for voice moments (greeting, hero line); sans for all data.
- [x] **THEME-05**: Hairline borders, generous spacing, and calm/soft motion throughout (Linear / Things restraint).
- [x] **THEME-06**: The flat-warm visual system passes an explicit human-UAT review gate before it is locked for rollout.

### Chat — basic text follow-up

- [x] **CHAT-01**: After the Reading, the user can ask a free-text follow-up in the same bottom-pinned composer and receive a response inline in the thread (reuses "Ask the expert" `/api/analyze/[id]/chat` verbatim; no separate dock).
- [x] **CHAT-02**: Quick-action chips ("Why this score?", "Rewrite my hook", "How do I fix retention?") seed follow-up prompts into the same composer (seed, not auto-send).

### Demo — first-run magic

- [~] **DEMO-01**: A first-time user sees a live demo Reading on a known viral video before uploading anything (rendered with the real Reading components). **DEFERRED 2026-06-15** — descoped from v5.0 at the user's direction during milestone close (follow-up shipped without it). Carry to a later milestone.

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

Each v1 requirement maps to exactly one phase. 28/28 mapped — no orphans, no duplicates.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 1 | Complete |
| SHELL-02 | Phase 1 | Complete |
| SHELL-03 | Phase 1 | Complete |
| SHELL-04 | Phase 1 | Complete |
| SHELL-05 | Phase 1 | Complete |
| SHELL-06 | Phase 1 | Complete |
| SHELL-07 | Phase 1 | Complete |
| THEME-01 | Phase 1 | Complete |
| THEME-02 | Phase 1 | Complete |
| THEME-03 | Phase 1 | Complete |
| THEME-04 | Phase 1 | Complete |
| THEME-05 | Phase 1 | Complete |
| THEME-06 | Phase 1 | Complete |
| READ-01 | Phase 2 | Complete |
| READ-02 | Phase 2 | Complete |
| READ-03 | Phase 2 | Complete |
| READ-04 | Phase 2 | Complete |
| READ-05 | Phase 2 | Complete |
| READ-06 | Phase 2 | Complete |
| READ-07 | Phase 2 | Complete |
| READ-08 | Phase 2 | Complete |
| READ-10 | Phase 2 | Complete |
| READ-09 | Phase 3 | Complete |
| REVEAL-01 | Phase 4 | Complete |
| REVEAL-02 | Phase 4 | Complete |
| CHAT-01 | Phase 5 | Complete |
| CHAT-02 | Phase 5 | Complete |
| DEMO-01 | Phase 5 | Deferred (descoped from v5.0) |

**Coverage:**
- v1 requirements: 28 total (SHELL ×7, READ ×10, REVEAL ×2, THEME ×6, CHAT ×2, DEMO ×1)
- Mapped to phases: 28 ✓ (Phase 1: 13 · Phase 2: 9 · Phase 3: 1 · Phase 4: 2 · Phase 5: 3)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-13*
*Last updated: 2026-06-13 — traceability populated by roadmapper (28/28 v1 requirements mapped across 5 phases).*
