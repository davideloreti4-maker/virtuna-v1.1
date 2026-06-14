# Roadmap — v5.0 Numen Rework

## Overview

A **presentation-layer rework**. The engine is FROZEN at 3.19.0 — no phase touches `lib/engine/`. Every phase works in `src/components/**`, `src/app/**`, hooks, and design tokens only. The product collapses to **one thread per video (a "Reading")**: the user drops a video, the first AI turn IS the Reading, and a persistent composer handles follow-ups. The Konva canvas is retired; the rich board *visuals* are reused — transplanted off Konva, reskinned to a new flat-warm system, and re-authored as drill-downs (nothing visual is deleted, nothing rebuilt that already exists).

The journey: lay the flat-warm visual foundation and the shell the Reading lives in (gated by a human visual-UAT review against that real surface) → author the consolidated Reading thread's information architecture → transplant the rich board visuals into the Reading as drill-downs → make the ~45–60s analysis read as progress via stage-reveal → add the text follow-up tail and the first-run demo. Each phase is an independently shippable, demoable slice. Concrete to-dos are discovered at `/gsd-discuss-phase` / `/gsd-plan-phase` time; the requirements below are the contract this roadmap maps, not a frozen task list.

**Source of truth:** `.planning/NUMEN-REWORK-BRIEF.md` (LOCKED) · **Requirements:** `.planning/REQUIREMENTS.md`

## Phases

**Phase Numbering:**
- Milestone-scoped: restarts at Phase 1 (per project convention; no global counter).
- Integer phases (1, 2, 3): planned milestone work.
- Decimal phases (2.1, 2.2): urgent insertions (marked INSERTED).

- [x] **Phase 1: Foundation & Shell** - Flat-warm token system + the home/composer/sidebar shell the Reading lives in, locked by a human visual-UAT gate (completed 2026-06-14)
- [ ] **Phase 2: The Reading** - The consolidated result thread's information architecture: hero → 3 driver rows → Fix First → deeper read, cut-data clean
- [ ] **Phase 3: Rich Visuals as Drill-Downs** - Transplant the board visuals (RetentionChart, PersonaGraph, filmstrip, FactorBars, SegmentTable…) off Konva, reskinned, into the Reading's disclosure surfaces
- [ ] **Phase 4: Stage-Reveal** - The Reading materializes block-by-block as engine stages complete, then settles to a stable resting document
- [ ] **Phase 5: Follow-up & Demo** - Text follow-up in the same composer (reuse "Ask the expert") + a first-run live demo Reading on a known viral video

## Phase Details

### Phase 1: Foundation & Shell
**Goal**: Establish the flat-warm visual system and build the app shell the Reading lives in — the clean home (serif greeting + universal composer + starter chips), the two composer layouts (centered when empty → bottom-pinned when a Reading exists), ingestion via the composer (`+` upload / paste-URL auto-detect), and the reskinned sidebar of past Readings (reuse `useAnalysisHistory`). The flat-warm system is reskinned OFF the Raycast glass and is **human-UAT-gated against this real built shell** before it's locked for rollout — most downstream surfaces reskin onto it, so it must be approved here, against something real, not in the abstract. Mobile-first; desktop is the same shell, widened. Reuse `src/components/app/app-shell.tsx` + `src/components/sidebar/Sidebar.tsx` (keep structure + history wiring; strip the 137deg gradient, blur, and inset shine). Do NOT reuse the `milestone/numen-surface` `numen/`+`reading/` kit.
**Depends on**: Nothing (first phase — the visual foundation + the frame everything else sits in)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, SHELL-07, THEME-01, THEME-02, THEME-03, THEME-04, THEME-05, THEME-06
**Success Criteria** (what must be TRUE):
  1. A first-time user lands on a clean home — serif greeting + the centered universal composer with starter chips (Paste link · Upload · Try a demo) and the Numen stele glyph; no Reading list crowds the composer
  2. A user can start a Reading by pasting a video URL (auto-detected) OR uploading a file via the composer `+`; once a Reading exists the same composer drops to bottom-pinned and the thread fills the scroll area above
  3. A user sees their past Readings in a sidebar — collapsible on desktop, drawer on mobile (sourced from `useAnalysisHistory`) — and reopening one restores the full thread via permalink
  4. The shell renders correctly on a phone (mobile-first) and as the same shell widened on desktop, with the Raycast glass (137deg gradient + blur + inset shine) gone everywhere including the sidebar — surfaces read flat-warm matte (no glow/shine/halo), serif for the greeting, sans for chrome, hairline borders, calm motion, coral as the lone accent
  5. The flat-warm visual system passes an explicit **human-UAT review gate** on this built shell and is signed off as locked for rollout before later phases reskin onto it
**Plans**: 5 plans
- [x] 01-01-PLAN.md — Flat-warm @theme token migration (charcoal hex, terracotta coral, glass strip Layer A) + serif wiring (THEME-01..05)
- [x] 01-02-PLAN.md — Sidebar reskin: strip inline glass (Layer B), revive collapse (⌘\), cut dead affordances, "Simulations" list + app-shell offset (SHELL-05/07, THEME-02/05)
- [x] 01-03-PLAN.md — Clean home + slim TikTok/upload composer (two-layout) + serif greeting + NumenMark (SHELL-01..04/06, THEME-04/05)
- [x] 01-04-PLAN.md — Repoint authed landing → /home (middleware + auth callback), keep /analyze dormant (SHELL-06, D-23)
- [x] 01-05-PLAN.md — THEME-06 human-UAT gate: full-suite + clean-build precondition, 4 UAT screenshots, blocking sign-off (THEME-01/03/06, SHELL-07)
**UI hint**: yes

### Phase 2: The Reading
**Goal**: Author the consolidated Reading thread — the information architecture that reduces the engine's ~40 fields to the four questions a creator actually has. Lay it out top-to-bottom: **hero** (`overall_score` zone-colored green/amber/red with NO prose narration; the go/no-go gate `anti_virality_gated`+reason when gated; watch-through % `weighted_completion_pct`/`completion_pct` shown exactly once and owned here; an audience persona cloud) → **3 always-visible driver rows** (Hook = stop-power; Retention = *where they drop*, `weighted_top_dropoff_t`; Shareability = `share_pull`) with a tap target on each row → **Fix First** (top timestamped fix(es) + copyable hook rewrite(s); extras collapse behind "N more fixes →") → **Deeper read** expand (remaining 3 Apollo dims clarity/substance/credibility + supporting signals). Cut data never appears (`feature_vector`, `score_weights`, telemetry, model names, `critique`, `predicted_engagement`, dead modules — see brief §2.9). This phase ships the thread structure with simple/native detail content; the rich transplanted visuals fill the disclosure surfaces in Phase 3.
**Depends on**: Phase 1 (the Reading renders inside the shell frame and on the locked flat-warm system)
**Requirements**: READ-01, READ-02, READ-03, READ-04, READ-05, READ-06, READ-07, READ-08, READ-10
**Success Criteria** (what must be TRUE):
  1. After analysis, a user sees a Reading laid out hero → 3 driver rows → Fix First → deeper read, in that order, inside the thread
  2. The hero shows the `overall_score` zone-colored (green/amber/red) with no prose/horoscope narration, surfaces the go/no-go gate + reason when the video is gated, and shows watch-through % exactly once (owned by the hero) alongside an audience persona cloud
  3. A user sees three always-visible driver rows — Hook, Retention (showing *where they drop*, e.g. "⚠ 0:08"), Shareability — and tapping a row reveals its detail (e.g. Hook → modality breakdown + weakest modality)
  4. A "Fix First" block shows the top timestamped fix(es) with copyable hook rewrite(s), extra fixes collapsed behind "N more fixes →", and a "Deeper read" expand reveals the remaining 3 Apollo dimensions (clarity / substance / credibility) plus supporting signals
  5. No cut/jargon data appears anywhere in the Reading (no `feature_vector`, `score_weights`, telemetry, model names, `critique`, `predicted_engagement`, or dead-module output)
**Plans**: 5 plans
- [x] 02-01-PLAN.md — Foundation: Wave-0 test scaffold + fixtures, ScoreGauge (zone-colored arc), DrillSheet (generic disclosure container)
- [x] 02-02-PLAN.md — Hero atoms: static PersonaCloud + watch%, ThumbnailStrip, AntiViralityHeader gate-banner re-export
- [ ] 02-03-PLAN.md — DriverRows (3 levers, 0-100 bars, Retention drop-time, only-weakest-colored) + sidebar score-chip token unify
- [ ] 02-04-PLAN.md — Fix First: copyable RewriteItem, FixFirstList (top-3 + inline "N more" + D-14 empty), inline DeeperRead (3 dims)
- [ ] 02-05-PLAN.md — Integration: Reading container (D-13 gate, single source, vertical IA, one DrillSheet) + /analyze layout restructure + READ-10 no-cut-data guard
**UI hint**: yes

### Phase 3: Rich Visuals as Drill-Downs
**Goal**: Preserve every rich board visual by transplanting it into the Reading's disclosure surfaces (the driver-row detail taps and the deeper-read expand built in Phase 2). Take `RetentionChart`, `PersonaGraph`, the filmstrip, `FactorBars`, `SegmentTable`, the emotion arc, niche/ghost curves, hook-modality sub-scores, `InsightHero`, `ScoreDistribution`, etc. from `src/components/board/**`, drop the Konva *shell* (pan/zoom, camera, world-space positioning) while keeping the DOM/React/SVG frame *components*, and reskin them to the locked flat-warm tokens. Nothing visual is deleted; nothing already-built is rebuilt. They become the heavy content that's one tap away from the headline.
**Depends on**: Phase 2 (the drill-down surfaces — row-detail + deeper-read — must exist to receive the visuals) and Phase 1 (visuals reskin onto the locked flat-warm system)
**Requirements**: READ-09
**Success Criteria** (what must be TRUE):
  1. From a driver row or the deeper-read expand, a user can open the rich visuals — RetentionChart, PersonaGraph, filmstrip, FactorBars, SegmentTable, emotion arc, niche/ghost curves — as drill-downs from the Reading
  2. Every preserved visual renders correctly outside the Konva canvas (transplanted to DOM/React/SVG, no pan/zoom shell) with real engine output, no throwing or grey-cell fallbacks
  3. The drill-down visuals are reskinned to the flat-warm system — no Raycast glass, no glow/shine — and read consistently with the rest of the Reading
**Plans**: TBD
**UI hint**: yes

### Phase 4: Stage-Reveal
**Goal**: Make the ~45–60s analysis wait read as progress, not a spinner. Drive the Reading off the existing `useAnalysisStream` so each block/headline materializes as its corresponding engine stage completes (hero appears, then driver rows, then Fix First, etc.), then settles into a stable resting Reading with no layout thrash on completion. Reuse the existing stream + permalink hooks; calm-motion taste bar (no flashy reveals).
**Depends on**: Phase 3 (all Reading blocks and their drill-downs must exist before they can be progressively revealed; reveal animates the real, complete Reading)
**Requirements**: REVEAL-01, REVEAL-02
**Success Criteria** (what must be TRUE):
  1. While analysis runs, a user watches the Reading build block-by-block as each engine stage completes (driven by `useAnalysisStream`) — the wait reads as visible progress, not a single spinner
  2. When all stages finish, the thread settles into a stable resting Reading with no layout thrash, reflow, or jump on completion
  3. The reveal motion stays within the calm/soft taste bar (no flashy or jarring transitions) and respects reduced-motion
**Plans**: TBD
**UI hint**: yes

### Phase 5: Follow-up & Demo
**Goal**: Close the loop with the two tail features. **Follow-up:** after the Reading, the same bottom-pinned composer accepts a free-text follow-up and returns the answer inline in the thread — repurpose the existing "Ask the expert" chat (`/api/analyze/[id]/chat`) as the thread tail (no separate dock), with quick-action chips ("why this?", "rewrite hook") that seed follow-up prompts into the composer. **Demo:** a first-time user sees a live demo Reading on a known viral video before uploading anything, rendered with the real Reading components (show the magic first). Presentation only — reuse the existing chat backend; no engine changes.
**Depends on**: Phase 4 (the demo renders a complete Reading with stage-reveal; follow-ups append to the finished thread)
**Requirements**: CHAT-01, CHAT-02, DEMO-01
**Success Criteria** (what must be TRUE):
  1. After a Reading, a user can type a free-text follow-up into the same composer and receive a response inline in the thread (reusing "Ask the expert"), with no separate chat dock
  2. Quick-action chips (e.g. "why this?", "rewrite hook") seed follow-up prompts into the composer when tapped
  3. A first-time user sees a live demo Reading on a known viral video — rendered with the real Reading components — before uploading anything of their own
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Shell | 5/5 | Complete   | 2026-06-14 |
| 2. The Reading | 2/5 | In Progress|  |
| 3. Rich Visuals as Drill-Downs | 0/TBD | Not started | - |
| 4. Stage-Reveal | 0/TBD | Not started | - |
| 5. Follow-up & Demo | 0/TBD | Not started | - |
