# Phase 2: Board substrate + Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 2-board-substrate-navigation
**Areas discussed:** General direction rethink, board entry model, result panels → node bodies, time-resolved per-persona prediction (heatmap), dashboard/workspace relationship, sidebar structure, mobile interaction model, performance tiers, milestone restructure

---

## General direction (initial pivot)

User opened with deep dissatisfaction with the original Phase 2 direction ("live persona hive" + stacked result card). Wanted to rethink everything.

References provided:
- **Krea AI Nodes** — node-based persistent canvas, multi-feature, drag-to-connect
- **Meta Tribe v2** — scientific paper composition: input → pretrained encoders → subject block → time-resolved predicted output

**Outcome:** Pivot to a **node-based board model** combining Krea's interaction substrate with Tribe v2's information architecture. The board IS the product, not a sub-page.

---

## Thread 1 — Board entry model

| Option | Description | Selected |
|--------|-------------|----------|
| (i) Empty board from t=0 | Board canvas visible immediately with Input node pulsing | |
| (ii) Form route → board route on submit | Standard form, navigates to board on submit | |
| (iii) Board with form pre-pinned, URL updates in place | Empty scaffold + Input node + drawer pattern, URL updates via pushState | ✓ |
| (iv) Modal form over preview board | Modal entry, dismisses on submit | |

**User's choice:** (iii) with Input node + drawer pattern (variant iii-b).

**Sub-decisions:**
- Bottom command bar = context-aware AI command bar (entry → co-pilot transformation). Scoped Phase 2 to scripted chip actions; free-form natural language deferred to M2-II/III.
- `/dashboard` route fate: redirect to `/analyze`. Dedicated dashboard surface deferred to Workspace milestone.
- Browser navigation: pushState (not replaceState) so browser back/forward semantics work.

**Notes:** User confirmed dashboard concept makes sense for agencies in future Workspace milestone but not Phase 2. Current `/dashboard` was effectively just the entry to `/analyze` — simplifies retire path.

---

## Thread 2 — Result panels as node bodies

| Option | Description | Selected |
|--------|-------------|----------|
| Single-panel nodes | Every R1 panel = top-level node (~25 nodes) | |
| Compound group nodes | Group containers with related panels inside | |
| Hybrid: compound groups + signature elevated nodes | Group frames with key outputs (Audience, Verdict) visually dominant | ✓ |

**User's choice:** Hybrid — 5 group container frames (Input, Engine, Audience, Verdict, Actions, Content Analysis).

**Sub-decisions:**
- Group rename: Subjects → Audience, Pipeline → Engine (creator-readable nouns)
- Spatial layout: Audience as large central node, Verdict as hero on right
- Default complete-state camera: fits Audience + Verdict as hero pair
- Anti-virality is a **cross-group coordinated state** (Verdict + Audience + Actions ripple together) — established as design principle
- Phase 1 ResultCard skeleton: scratch and rebuild (not migrated/wrapped)

---

## Thread 3 — Time-resolved per-persona prediction (the killer feature)

### Engine tier

| Option | Description | Selected |
|--------|-------------|----------|
| L1: Structured output, single call | Same persona call, structured per-segment output embedded | |
| L2: Dedicated per-persona timeline call | Pass 2 dedicated call after main verdict | |
| L2+: L2 with Qwen-thinking-mode | Pass 2 with chain-of-thought reasoning per segment | ✓ |
| L3: Tribe-style multi-encoder + trained subject block | Frozen encoders + retrained subject block on outcome data | |

**User's choice:** L2+ (cost not a concern after Qwen migration; quality > cost). L3 deferred to M3 "Tribe Engine" milestone.

### Heatmap visual aesthetic

| Option | Description | Selected |
|--------|-------------|----------|
| Pure piano-roll matrix | Persona × segment grid only | |
| Stacked line graphs | 10 persona lines overlaid | |
| Stream graph (river chart) | Stacked area with persona flows | |
| TikTok-Studio retention curve + annotations | Familiar curve only | |
| Persona faces on timeline | Avatars at swipe points | |
| **Combined: curve overlay + dropoff markers + heatmap underlay + filmstrip + headline metrics** | All layers integrated | ✓ |

**User's choice:** Combined layered composition. TikTok-Studio retention curve as primary signal (immediately readable), persona dropoff markers attribution layer, heatmap underlay collapsible for power view, filmstrip top axis anchors to content, headline metrics chip row above for scannability.

### Aggregate weighting

**User's choice:** Redo properly for the new system. Baseline weights: FYP 0.65 / niche 0.20 / loyalist 0.10 / cross 0.05. Transparency badge in UI. Schema future-proofed for per-niche / per-creator / per-analysis overrides.

### Mobile layout

| Option | Description | Selected |
|--------|-------------|----------|
| Landscape rotate on tap (Apple Health pattern) | Detail view rotates to landscape | |
| Portrait-native with smart layout + scroll/pinch-zoom | Portrait does everything | ✓ |

**User's choice:** Optimize for portrait. No rotation, no fullscreen escape. Pinch-zoom + tap-row-expand for detail.

### Tribe v2 engine integration

**User's choice:** Defer to M3 milestone. Phase 3 ships L2+ Qwen Pass 2 as the immediate quality answer.

---

## Thread 4 — Dashboard relationship + workspace

| Option | Description | Selected |
|--------|-------------|----------|
| Instant analyze (`/dashboard` redirects to `/analyze`) | Single entry surface | ✓ (Phase 2) |
| Dedicated dashboard with feed + canvas views | Multi-view workspace surface | (deferred to Workspace milestone) |

**User's choice:** Both have merit; Phase 2 ships instant-analyze (cleanest, smallest scope), dedicated dashboard arrives in future Workspace milestone when projects/templates/custom-personas give it content to host.

**Sub-decisions:**
- Existing tier-hive at `/dashboard`: fully deleted (not just deprecated) — D-26
- DB schema for `projects` table ships in Phase 2; UI deferred
- Sidebar restructure ships in Phase 2 with placeholder Projects section

---

## Sidebar structure (explicit user ask)

**Locked structure:**

| Section | Phase 2 ships? |
|---------|----------------|
| ⊕ New analysis (CTA + ⌘N) | Yes |
| Navigate (Boards / Trending / Settings) | Yes (minimal) |
| ● Running (only when streaming) | Yes |
| ⭐ Pinned | Yes (basic star action) |
| 🕐 Recent (paginated) | Yes |
| 📁 Projects (collapsed placeholder) | Schema only — UI deferred |
| 👤 Account | Yes |

Collapse to icon-only via ⌘\. Mobile: hamburger top-left → full-height drawer.

---

## Mobile vs Desktop interaction model

| Option | Description | Selected |
|--------|-------------|----------|
| Two shells (board on desktop, story-mode on mobile) | Different UX per platform | |
| Same canvas, different camera policies | Single substrate, smart camera assists | (mid-discussion) |
| Same canvas, **identical navigation**, different authoring affordances | Free pan/zoom on both; editing desktop-only | ✓ |

**User's choice:** Identical navigation on both platforms. Free pan/zoom on mobile too. Difference is authoring (move/delete/add nodes, real-time co-edit) — desktop only, and mostly future scope.

---

## Performance tiers

User has iPhone 11 for testing. Asked if FPS can drop if needed.

**Locked structure:**

| Tier | Devices | Target FPS |
|------|---------|------------|
| High | iPhone 13+, modern Android, desktop | 60fps |
| Medium | iPhone 11-12, mid-range Android | 45-60fps |
| Low | older devices, thermal-throttled | 30fps min |

Auto-detect via UA + GPU hints; runtime sampling drops tier if sustained <40fps.

---

## Milestone restructure

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 7 phases, expand Phase 2 into mega-phase | Minimal roadmap surgery, dense P2 | |
| Split into 8 phases (P2 → P2 substrate + P3 engine + P4 audience), restructure downstream | Each phase focused, parallelizable | ✓ |
| Close current milestone, open new "Board Engine + Audience" milestone | Cleanest framing, most overhead | |

**User's choice:** Option B (8 phases). Quality > speed. Split further if needed.

**New phase structure:**
- P1 ✅ Foundation
- P2 Board substrate + Navigation
- P3 Engine rework (Pass 2 + weighted aggregator + heatmap schema + filmstrip)
- P4 Live Audience node (centerpiece)
- P5 Other group nodes (Verdict + Actions + Content Analysis)
- P6 Reshoot script + optimal post time
- P7 Share & export
- P8 Mobile + onboarding + integration + regression

---

## Claude's Discretion

Areas user explicitly deferred to Claude or planner/researcher:

- Konva implementation details (layer composition, animation engine choice within Konva-runtime decision)
- State machine implementation (Zustand vs XState vs handcrafted)
- Tier-hive deletion strategy (single PR vs staged)
- Sidebar styling specifics (within Raycast scale, no new tokens)
- URL camera-state encoding format (query vs hash vs path)
- Performance tier detection heuristics (UA vs GPU vs WebGL vs benchmark)
- Default project creation timing (signup vs first-analysis vs lazy)
- Reduced-motion fallback specifics within "option (a)" (which animations stay, which go)

---

## Deferred Ideas

- Free-form conversational AI co-pilot (M2-II / M2-III)
- Workspace milestone: project management UI, canvas dashboard, compare/cohort nodes, templates, custom personas, team sharing, real-time co-edit
- Tribe v2 engine integration (M3 milestone): frozen encoders for grounding (a), retrained subject block on outcome data (b)
- Outcome feedback loop (M2-III): real TikTok analytics overlay on predicted heatmap
- Multi-video boards (A/B compare on one canvas)
- Custom personas dropped into Audience group
- Per-niche / per-creator / per-analysis weight overrides UI
- Heatmap layer toggle (Attention / Emotion / Engagement)
- Real-time collaboration (Figma-style cursors)
- Export-as-report node (PDF for client deliverables)
- API node + Zapier/Slack integrations
- Live-stream "AI thinking" voice-over
