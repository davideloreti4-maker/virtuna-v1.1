# Roadmap — v4.1 MVP Ready

## Overview

A **brownfield refinement pass**. The platform already ships end-to-end; this milestone walks each major pillar one at a time — fixing, optimizing, and refining toward an MVP-ready state. The walk follows the natural data flow: fix the brain first (engine), then the surfaces that render it (test board → remix board → chat), then cross-cutting polish last (general UI/UX). Every phase is a pillar run as **audit → fix-list → verify** over an EXISTING surface. Concrete to-dos are discovered at `/gsd-discuss-phase` time, not frozen here. The requirements are a starting audit backlog, not a contract — surfaced issues get added via `/gsd-phase add` or peeled off with `/gsd-quick`.

## Phases

**Phase Numbering:**
- Milestone-scoped: restarts at Phase 1 (v4.0 Apollo phases archived to `milestones/v4.0-phases/`).
- Integer phases (1, 2, 3): planned pillar work.
- Decimal phases (2.1, 2.2): urgent insertions (marked INSERTED).

- [ ] **Phase 1: Engine Pipeline** - Audit → refine the Apollo 3-call flow toward correct, fast, honest output
- [ ] **Phase 2: Board / Test Mode** - Audit → refine the analyze board so every frame renders real engine output
- [ ] **Phase 3: Board / Remix Mode** - Audit → refine the remix board to the Test-mode quality bar
- [ ] **Phase 4: Chat Feature** - Audit → refine the "ask the expert" dock for trustworthy, grounded answers
- [ ] **Phase 5: General UI/UX** - Cross-cutting polish so the product holds together for a real user

## Phase Details

### Phase 1: Engine Pipeline
**Goal**: Audit → refine pass over the EXISTING Apollo 3-call pipeline (Omni verbatim sensor → fold ∥ Apollo reasoner). Walk Qwen inputs/outputs, prompt quality, latency, and correctness end-to-end; resolve known drift/grounding/determinism issues. This is a refinement of a shipped engine — concrete to-dos are discovered at discuss-phase time.
**Depends on**: Nothing (first phase — fix the brain before the surfaces that render it)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06
**Success Criteria** (what must be TRUE — the pillar is MVP-ready):
  1. A full E2E analyze run completes on a real video with every Qwen call returning usable output — no silent fallbacks, no thrown frames
  2. The Apollo reasoner stays grounded in the knowledge core (§ citations resolve to the real corpus, not flat fake legend labels)
  3. The same video analyzed twice yields an identical (within provider noise band) honestly-banded score, with the engagement range grounded in follower_count × quality read — no fabrication
  4. Latency stays under the Vercel cap and trends toward the <90s E2E goal where free-tier allows
  5. omni-flash drift is hardened (emotion_arc.label, weakest_modality, verbatim hook/segments hold across runs) and Qwen prompt I/O is reviewed for quality and token efficiency
**Plans**: 5 plans
- [x] 01-01-PLAN.md — ENG-02 §-grounding: apollo-core-smoke audit -> restore/remap/redesign co-review -> engine-side honesty fix
- [x] 01-02-PLAN.md — ENG-05 read-model re-audit (flash vs plus A/B) co-review + D-11 critical-field retry + drift logging
- [x] 01-03-PLAN.md — ENG-06 step-by-step prompt I/O co-review (3 calls) + T3.x trim audit + consumed-vs-dead field map prune/tighten
- [x] 01-04-PLAN.md — ENG-04/06 coupled aggregator set: audit + co-review (Stage-10 fate / verdict_line) → F22/F44 confidence apollo-vs-fold + F24 drop + F34 + hero block (F37/F41) + persist (F42) + version bump
- [ ] 01-05-PLAN.md — ENG-01/03/04/06 closeout: F7 race + fold robustness (F18/F20/F19) + partial_analysis + dead-tail prune (F12/F35/F43) + E2E verify + honesty LOCK + latency reclaim

### Phase 2: Board / Test Mode
**Goal**: Audit → refine pass over the EXISTING analyze board (Test mode) UI/UX — frames, rendering, wiring, mobile. Confirm every frame holds together against real engine output and strip dead UI. Refinement of a shipped surface; concrete to-dos discovered at discuss-phase time.
**Depends on**: Phase 1 (board renders the engine's output — engine must be sound first)
**Requirements**: BTEST-01, BTEST-02, BTEST-03, BTEST-04, BTEST-05
**Success Criteria** (what must be TRUE — the pillar is MVP-ready):
  1. Every board frame renders end-to-end with real engine output — no throwing frames, no grey-cell / warm-gradient fallbacks masking missing data
  2. The insight-hero frame leads the board (dual-read, copyable rewrites, demoted band) and reads correctly
  3. Filmstrip / keyframes persist across reload and the content-craft frame is stable
  4. The mobile card-stack view is coherent (auto <768px + manual toggle)
  5. Dead UI is removed (dead percentile rank, fake-engagement remnants, number overload, aria-live storm)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Board / Remix Mode
**Goal**: Audit → refine pass over the EXISTING remix board UI/UX, bringing it to the Test-mode quality bar against the shared Apollo reasoner. Refinement of a shipped surface; concrete to-dos discovered at discuss-phase time.
**Depends on**: Phase 2 (Remix shares components and the quality bar set by Test mode)
**Requirements**: BRMX-01, BRMX-02, BRMX-03
**Success Criteria** (what must be TRUE — the pillar is MVP-ready):
  1. Remix mode runs end-to-end and renders correctly against the shared Apollo reasoner (R12 one-brain path)
  2. The remix board UI/UX matches the Test-mode quality bar (frames, wiring, mobile)
  3. Remix ↔ Test mode transitions and shared components behave consistently
**Plans**: TBD
**UI hint**: yes

### Phase 4: Chat Feature
**Goal**: Audit → refine pass over the EXISTING "ask the expert" chat dock — UI/UX and grounding. Make the chat trustworthy and tied to the analyzed video. Refinement of a shipped surface; concrete to-dos discovered at discuss-phase time.
**Depends on**: Phase 2 (chat is docked on the board and grounds on its engine output)
**Requirements**: CHAT-01, CHAT-02, CHAT-03
**Success Criteria** (what must be TRUE — the pillar is MVP-ready):
  1. Chat citations are real and grounded — the §-scheme mismatch is resolved (inject KNOWLEDGE-CORE / fix taxonomy, or drop fake citations) so the chat is trustworthy
  2. The chat dock UI/UX is refined (markdown, frame-tags, streaming/stop, composer, mobile full-height sheet) and verified on desktop + mobile
  3. Chat answers stay tied to the analyzed video's engine output (context grounding), not generic
**Plans**: TBD
**UI hint**: yes

### Phase 5: General UI/UX
**Goal**: Cross-cutting refinement pass over the EXISTING surfaces — Numen brand consistency, Raycast design language adherence, mobile, accessibility, dead routes — so the whole product holds together for a real user. Refinement, not a feature build; concrete to-dos discovered at discuss-phase time.
**Depends on**: Phase 4 (cross-cutting polish runs last, over all surfaces refined above)
**Requirements**: UIUX-01, UIUX-02, UIUX-03, UIUX-04
**Success Criteria** (what must be TRUE — the pillar is MVP-ready):
  1. The Numen rebrand is fully consistent (logo, wordmark, titles, meta, OG, copy) — no stray "Virtuna" anywhere user-facing
  2. Raycast design language adherence holds across all surfaces (6% borders, 10% hover, 12px card radius, Inter, glass pattern)
  3. Mobile responsiveness + accessibility (WCAG AA) pass on the core flow (analyze → board → chat)
  4. The end-to-end first-run flow holds together for a real user (auth → analyze → result → chat) — no dead routes or broken handoffs
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Pipeline | 4/5 | In Progress|  |
| 2. Board / Test Mode | 0/TBD | Not started | - |
| 3. Board / Remix Mode | 0/TBD | Not started | - |
| 4. Chat Feature | 0/TBD | Not started | - |
| 5. General UI/UX | 0/TBD | Not started | - |
