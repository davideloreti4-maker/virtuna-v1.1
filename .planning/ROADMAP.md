# Roadmap: Numen Surface (v5.0)

## Overview

Numen Surface is a presentation-layer rebuild: it replaces the Konva canvas board with **one thread per video** where the AI's first turn IS the **Reading** (stage-revealed engine output; verdict = calibrated band + one-line why in a reserved "throne" slot). The engine (v4.1, ENGINE_VERSION 3.19.0) is frozen — every phase re-composes existing output, never touches `lib/engine/`. The journey is forced by its dependency graph: build the new warm-neutral design kit (no gate dependency, runs early), build the view-model crux that both live and replay paths funnel through, pass the SMOKE GATE + verdict-banding calibration before any Reading-against-real-output, then build the mobile Reading thread, wrap it in the app shell + ingestion, add the follow-ups + agentic-tool tail (the moat) and in-thread monetization, and finally — only after mobile ships — the desktop instrument layer where the Konva-keep-vs-retire decision is made.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Milestone-scoped numbering (fresh worktree, `--reset-phase-numbers`): phases start at 1.

- [x] **Phase 1: Design System Foundation + Brand Migration** - Warm-neutral dark kit, verdict scale, ground-up component vocabulary; retire Raycast/coral/glass-everywhere — COMPLETE 2026-06-11
- [x] **Phase 2: View-Model + Data Contract** - Pure `toReadingBlocks()` mapping ~40 engine fields → ~10 Reading blocks; live + replay funnel through one module
- [ ] **Phase 3: SMOKE GATE + Verdict-Banding Calibration** - Hard precondition: real-video E2E proves honest live output; band buffers wider than score noise
- [ ] **Phase 4: Mobile Reading Thread + PWA Shell** - The core paradigm: AI pronounces first, stage-reveal blocks, throne verdict, re-openable resting document, installable PWA
- [ ] **Phase 5: App Shell + Ingestion** - Home = list of past Readings, per-video thread routing, upload + paste-URL + Android share_target entry
- [ ] **Phase 6: Follow-ups + Agentic Tools + Monetization** - Suggested taps → free text; instant (re-interpret) vs agentic (Apify competitors); oracle-initiated brand-deal-fit turn
- [ ] **Phase 7: Desktop Instrument Layer** - Same thread widened on desktop + dense instrument for powerusers; Konva keep-vs-retire decided here (mobile ships first)

## Phase Details

### Phase 1: Design System Foundation + Brand Migration

**Goal**: A ground-up warm-neutral dark design kit exists — verdict-scale color discipline, warm-clay brand accent, sans-led + serif voice type — so every later Reading component is built on it, and the old Raycast/coral/glass-everywhere brand is bounded and retired.
**Depends on**: Nothing (first phase; no gate dependency — runs early/parallel to Phase 2)
**Requirements**: DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, DS-07, DS-08
**Success Criteria** (what must be TRUE):

  1. A new warm-neutral dark theme renders with no pure black; all L<0.15 dark tokens authored as exact hex (Tailwind v4 oklch bug avoided), verified on a deployed build
  2. The verdict color scale (muted green / amber / clay-red) is the only load-bearing functional color; everything else reads near-neutral; brand accent is matured warm clay used only on logo, primary action, focus
  3. The component vocabulary (full-pill tool chips, circular icon buttons, hairline warm borders, soft elevation) and a glass primitive (backdrop-filter via inline style, not class) render correctly without Lightning CSS stripping the blur
  4. Type system shows sans for body and serif reserved for voice moments (greeting/hero + verdict line); calm motion (no bounce/snap) on the key reveal; keyframe stills carry the chroma while warm-neutral chrome recedes
  5. A documented migration boundary exists: a grep audit of hardcoded `#07080a` / `#FF7F50` / Raycast GlassPanel / fake macOS chrome / chat dock, with a decision of what v5.0 replaces vs defers

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Foundation: install gate + Wave-0 tests + APCA script + .numen-surface token layer + palette calibration + serif wiring (DS-01/02/03/04) — DONE 2026-06-11
- [x] 01-05-PLAN.md — DS-06 migration boundary: grep inventory + replace/defer boundary doc (DS-06) — DONE 2026-06-11

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Core primitives: glass (inline backdrop), surface, pill-chip, icon-button, verdict-swatch on tailwind-variants (DS-05/02) — DONE 2026-06-11
- [x] 01-03-PLAN.md — Calm motion: StageBlock stage-reveal + reduced-motion + new calm easing token (DS-07) — DONE 2026-06-11

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Kit showcase route + serif specimen + keyframe-chroma + deployed-build verification (DS-04/05/07/08) — DONE 2026-06-11

**UI hint**: yes

### Phase 2: View-Model + Data Contract (ENG-06 D-12)

**Goal**: One pure module maps the engine's ~40 fields to ~10 value-bearing Reading blocks plus a verdict (band + why), and both the live `complete` path and the persisted-row replay path funnel through it — so a Reading and its re-opened resting document are identical. This is the architectural crux; it ships before any UI consumes it.
**Depends on**: Phase 1 (token/type direction informs block shapes; can overlap)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):

  1. `lib/reading/view-model.ts` `toReadingBlocks()` is a pure function (no React, no fetch) that, given a persisted `PredictionResult` fixture, returns ~10 value-bearing blocks — unit-tested against real persisted fixtures
  2. The live `complete` path and the persisted-row replay path call the SAME view-model; the same fixture yields identical blocks via both
  3. A consumed-vs-dead field map is documented (resolves F27/F28/F43) — which engine fields the Reading uses and which it drops — with no `lib/engine/` edits and ENGINE_VERSION unchanged
  4. Verdict derivation returns a band + one-line why grounded in a specific signal; the `/100` number is demoted to supporting evidence (resolves F41/F45)

**Plans**: TBD

### Phase 3: SMOKE GATE + Verdict-Banding Calibration

**Goal**: A hard precondition is cleared — one real-video E2E on live infra proves the engine returns sane/honest output and yields the real latency number, and the verdict banding is calibrated so band buffer zones are wider than the engine's known score noise. No Reading-against-real-output is built before this passes.
**Depends on**: Phase 2 (need the field contract to know what to smoke-test; the prune is the test subject)
**Requirements**: GATE-01, GATE-02, GATE-03
**Success Criteria** (what must be TRUE):

  1. One real-video E2E on live Vercel returns sane/honest output (F46/F47 truncation, F22 confidence, F23 §-cites hold live) and the real ENG-03 latency number is measured with DashScope-429 behavior documented
  2. A same-video-N-times variance check produces a documented score-noise figure (~±15pt over the ~26–86 range)
  3. Calibrated band thresholds exist with buffer zones provably WIDER than that measured variance, and "Mixed signals" fires on boundary scores as a first-class, common verdict
  4. UAT sign-off passes: F42 authenticated permalink + full measure-pipeline, with a recorded verdict-banding go/no-go (a fail blocks Phase 4)

**Plans**: TBD

### Phase 4: Mobile Reading Thread + PWA Shell

**Goal**: The core paradigm works on mobile — the AI pronounces first (unprompted), engine stages stage-reveal into structured blocks below a reserved throne that crystallizes the verdict last, the expert insight is foregrounded, and a completed Reading persists as a re-openable resting document that opens on the verdict. The surface is an installable PWA. Replaces the Konva canvas as the primary surface.
**Depends on**: Phase 3 (gates), Phase 2 (view-model), Phase 1 (design kit)
**Requirements**: READ-01, READ-02, READ-03, READ-04, READ-05, READ-06, READ-07, SHELL-04
**Success Criteria** (what must be TRUE):

  1. On a new analysis the AI pronounces first with no blank prompt; each completed engine stage materializes its structured block (reshaped from existing `StageEvent`/SSE — NOT chatbot token streaming)
  2. The verdict sits in a reserved top throne slot, visibly forming while evidence assembles below and crystallizing last as the climax, reading as a calibrated band + one-sentence why (judgment, not metric; confidence in the band's language)
  3. ~10 evidence blocks render from value-bearing engine fields with the Apollo expert insight foregrounded (not buried), in plain language with no engine jargon surfaced
  4. A completed Reading re-opens as a resting document that opens on the verdict, identical to the live render (via the Phase 2 view-model)
  5. The app installs as a PWA (Serwist + `manifest.ts`) with mobile-native feel; iOS shows Add-to-Home-Screen coaching (installability verified via Lighthouse on a deployed build)

**Plans**: TBD
**UI hint**: yes

### Phase 5: App Shell + Ingestion

**Goal**: The full app spine wraps the Reading thread — home is a vertical list of past Readings (a content-intelligence portfolio), per-video thread routing reuses the existing persistence, and content gets in via upload, paste-URL, and Android share_target. iOS native share-sheet is explicitly out (WebKit #194593 → Capacitor milestone).
**Depends on**: Phase 4 (the thread must work before wiring the shell around it)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, IN-01, IN-02, IN-03
**Success Criteria** (what must be TRUE):

  1. Home shows a vertical list of past Readings, each a compact verdict card (keyframe thumb + band + why + date), with one persistent "analyze new" action
  2. Tapping a card opens its per-video thread; thread routing (list → conversation) reuses `analysis_results` + `analysis_chats` + the existing history API
  3. In-app video upload kicks the stage-reveal immediately
  4. Paste-URL ingestion (TikTok/Reels) works with clipboard auto-detect, and an Android `share_target` entry from the native share sheet lands an analysis

**Plans**: TBD
**UI hint**: yes

### Phase 6: Follow-ups + Agentic Tools + Monetization

**Goal**: The thread tail — the moat — works: scoped suggested follow-ups (instant re-interpretation vs agentic fetch), at least one agentic tool turn (competitor analysis via the existing Apify provider) appended as a structured tool result, in-persona failure voicing, and an oracle-initiated brand-deal-fit monetization turn inside the thread. Persists via a minimal `analysis_chats` schema extension.
**Depends on**: Phase 5 (needs the thread + shell + persistence spine)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, MON-01
**Success Criteria** (what must be TRUE):

  1. After a Reading, 3–4 contextual suggested follow-up taps appear (scoped to "about this Reading / your content"), with free text below; instant follow-ups (why this score, rewrite the hook, highest-leverage fix) re-interpret existing data via the existing chat route with no engine spend
  2. One agentic tool turn (competitor analysis via the existing Apify `ScrapingProvider`) runs and appends a structured tool-result turn; agentic taps are visually distinct from instant chips and show a natural "working…" beat
  3. Tool failures are voiced in-persona with partial-result/timeout copy — never a red error toast or modal
  4. An oracle-initiated monetization turn (brand-deal fit for the creator's niche) appears inside the thread, not as a separate tab
  5. Structured tool and monetization turns persist (via the `kind` + `payload` columns and `'tool'` role) and replay correctly on reload

**Plans**: TBD
**UI hint**: yes

### Phase 7: Desktop Instrument Layer

**Goal**: Desktop gets the same thread widened (one product, two densities — not a separate app) plus a dense instrument layer for the ~10% poweruser path. The Konva-keep-vs-retire decision is made here, based on what mobile shipped. Deliberately last — mobile is non-negotiably first.
**Depends on**: Phase 6 (and the full mobile thread; the Konva decision can't be made until mobile proves the paradigm)
**Requirements**: DESK-01, DESK-02
**Success Criteria** (what must be TRUE):

  1. On a desktop breakpoint the same thread renders widened — visibly one product at two densities, not a divergent app
  2. A dense instrument layer survives desktop-only for powerusers (today's Konva board or a dense linear successor), behind the desktop breakpoint
  3. A recorded keep-vs-retire decision exists for the Konva canvas, with the chosen dense successor specified if it retires

**Plans**: TBD
**UI hint**: yes

> **Research flag (Phase 7):** Konva-keep-vs-retire is open (vision §9) and the dense-linear successor is undefined. Plan this phase with `/gsd-plan-phase --research-phase`.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Design System Foundation + Brand Migration | 5/5 | Complete | 2026-06-11 |
| 2. View-Model + Data Contract | 4/4 | Complete (DATA-01/02/03/04 — deep-equal GREEN vs real pair WEkihfOzJphv) | 2026-06-12 |
| 3. SMOKE GATE + Verdict-Banding Calibration | 0/TBD | Not started | - |
| 4. Mobile Reading Thread + PWA Shell | 0/TBD | Not started | - |
| 5. App Shell + Ingestion | 0/TBD | Not started | - |
| 6. Follow-ups + Agentic Tools + Monetization | 0/TBD | Not started | - |
| 7. Desktop Instrument Layer | 0/TBD | Not started | - |
