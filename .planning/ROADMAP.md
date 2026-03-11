# Roadmap: UI Dashboard

## Overview

| Property | Value |
|----------|-------|
| Milestone | UI Dashboard |
| Total phases | 5 |
| Total requirements | 22 |
| Estimated complexity | Medium-High |

## Execution Waves

| Wave | Phases | Rationale |
|------|--------|-----------|
| 1 | Phase 1, Phase 2 | Foundation — model selector + account chip (no dependencies) |
| 2 | Phase 3 | Hive 2.5D upgrade (depends on Phase 1 for node count state) |
| 3 | Phase 4, Phase 5 | Result card + integration (depends on Phase 1 model state + Phase 3 hive) |

## Phase Summary

| Phase | Name | Requirements | Wave |
|-------|------|-------------|------|
| 1 | Model Selector & Oracle Placeholder | MOD-1, MOD-2, MOD-4, MOD-5, MOD-6 | 1 |
| 2 | Top Bar Account Selector | ACC-1, ACC-2 | 1 |
| 3 | Hive 2.5D Visualization | HIVE-1, HIVE-2, HIVE-3, HIVE-4, HIVE-5, HIVE-6, HIVE-7 | 2 |
| 4 | TikTok Result Card | RES-1, RES-2, RES-3, MOD-3 | 3 |
| 5 | Integration & Polish | INT-1, INT-2, INT-3 | 3 |

---

## Phase Details

### Phase 1: Model Selector & Oracle Placeholder
**Goal:** Overhaul Apollo model selector with Lite/Pro/Ultra tiers, add Perplexity-style descriptions with 10M database messaging, persona-account link text, and Oracle coming-soon card.
**Wave:** 1
**Dependencies:** None
**Requirements:** MOD-1, MOD-2, MOD-4, MOD-5, MOD-6

**File Ownership:**
- `src/components/app/content-form.tsx` — model selector UI overhaul
- `src/components/app/model-selector/` — new directory for extracted model components
- `src/lib/models.ts` — model tier definitions, descriptions, node counts

**Success Criteria:**
- Apollo 1.5 Lite/Pro/Ultra with descriptions and node counts
- 10M database reference in each tier description
- Persona-account link text below selector
- Oracle card with branding + "Join waitlist"
- Apollo | Oracle toggle/tab

---

### Phase 2: Top Bar Account Selector
**Goal:** Add persistent TikTok account chip to the top navigation bar, visible on all pages and devices.
**Wave:** 1
**Dependencies:** None
**Requirements:** ACC-1, ACC-2

**File Ownership:**
- `src/components/app/top-bar-account-chip.tsx` — new component
- `src/components/app/app-shell.tsx` or equivalent — integrate chip into nav
- `src/components/app/tiktok-account-selector.tsx` — shared hook/state

**Success Criteria:**
- "@handle" chip in top bar on desktop + mobile
- "Connect TikTok" CTA when no account
- Dropdown works on mobile (full-width)
- Syncs with sidebar selector

---

### Phase 3: Hive 2.5D Visualization
**Goal:** Upgrade hive to 2.5D with depth layers, parallax, organic cloud layout, bezier connections, center video, and dynamic node count.
**Wave:** 2
**Dependencies:** Phase 1 (node count from model tier state)
**Requirements:** HIVE-1, HIVE-2, HIVE-3, HIVE-4, HIVE-5, HIVE-6, HIVE-7

**File Ownership:**
- `src/components/hive/hive-layout.ts` — organic cloud layout algorithm
- `src/components/hive/hive-renderer.ts` — 2.5D rendering (depth, bezier, parallax)
- `src/components/hive/hive-constants.ts` — depth layer config, node count tiers
- `src/components/hive/hive-types.ts` — depth layer types
- `src/components/hive/HiveCanvas.tsx` — parallax mouse handler, video overlay
- `src/components/hive/use-hive-interaction.ts` — updated hit detection for depth
- `src/components/hive/HiveNodeOverlay.tsx` — persona demographic labels

**Success Criteria:**
- Three depth layers with size/opacity variation
- Mouse parallax on desktop
- Organic cloud layout (not symmetric)
- Bezier connections with distance fade
- Video thumbnail → playback in center rect
- Node count changes on model tier switch (300/1K/10K)
- Persona labels on hover reflect selected account
- 60fps at 10K nodes

---

### Phase 4: TikTok Result Card
**Goal:** Build TikTok-style post mockup card with autoplay video and predicted engagement metrics, shown above existing results panel.
**Wave:** 3
**Dependencies:** Phase 1 (model state), Phase 3 (video handling)
**Requirements:** RES-1, RES-2, RES-3, MOD-3

**File Ownership:**
- `src/components/app/simulation/tiktok-result-card.tsx` — new TikTok mockup component
- `src/components/app/simulation/results-panel.tsx` — integrate mockup above existing panel
- `src/lib/engine/` or API route — extend response with predicted_engagement
- Analysis loading UI — add "Scanning 10M+ database" step

**Success Criteria:**
- Vertical TikTok-style card with video autoplay (muted)
- Engagement overlay: likes, comments, shares, saves from prediction engine
- Tap to unmute, loops continuously
- "Scanning 10M+ video database..." in loading sequence
- Renders above existing ResultsPanel

---

### Phase 5: Integration & Polish
**Goal:** Wire all new components together, ensure state sync, responsive layout, and polish.
**Wave:** 3
**Dependencies:** Phase 1, Phase 2, Phase 3, Phase 4
**Requirements:** INT-1, INT-2, INT-3

**File Ownership:**
- All files from phases 1-4 (integration wiring)
- Shared state store (Zustand or context)
- Responsive CSS adjustments

**Success Criteria:**
- Model tier change → hive updates node count
- Account change → persona labels update
- Analysis complete → TikTok card + hive video sync
- All components responsive (320px+)
- No stale state between any components
- 60fps performance maintained

---

## Requirement Coverage Matrix

| Requirement | Phase | Status |
|-------------|-------|--------|
| RES-1 | 4 | Planned |
| RES-2 | 4 | Planned |
| RES-3 | 4 | Planned |
| HIVE-1 | 3 | Planned |
| HIVE-2 | 3 | Planned |
| HIVE-3 | 3 | Planned |
| HIVE-4 | 3 | Planned |
| HIVE-5 | 3 | Planned |
| HIVE-6 | 3 | Planned |
| HIVE-7 | 3 | Planned |
| MOD-1 | 1 | Planned |
| MOD-2 | 1 | Planned |
| MOD-3 | 4 | Planned |
| MOD-4 | 1 | Planned |
| MOD-5 | 1 | Planned |
| MOD-6 | 1 | Planned |
| ACC-1 | 2 | Planned |
| ACC-2 | 2 | Planned |
| INT-1 | 5 | Planned |
| INT-2 | 5 | Planned |
| INT-3 | 5 | Planned |

All 22 requirements mapped. Zero gaps.
