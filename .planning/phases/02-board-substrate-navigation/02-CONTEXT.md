# Phase 2: Board substrate + Navigation - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the universal **board canvas** as `/analyze` — the persistent Konva-based runtime that every subsequent phase plugs into. This is the **substrate layer** of the node-based board model: canvas + camera + group container frames + node base components + board state machine + sidebar restructure + universal context-aware command bar + Input node + drawer + `/dashboard` → `/analyze` redirect + tier-hive deletion + reduced-motion fallback + performance tier detection + accessibility scaffolding + first-board orientation tooltip + Engine group children scaffolding.

This phase delivers the **empty board scaffold** with all 5 group container frames visible in preview state, plus the live state machine that fills them in during streaming. **It does not populate the Audience node** (Phase 4), the Verdict/Actions/Content Analysis node bodies (Phase 5), or the engine extensions powering them (Phase 3). It delivers the *shell*.

**Major direction shift:** This phase replaces the original "live audience simulation viz" inside a stacked result card with a **board-substrate-first architecture**. Phase 1's `ResultCard` skeleton at `/analyze/[id]` is deprecated and rebuilt from scratch. Phase 1's engine + hook + route work remains the foundation.

**In scope:**
- Konva canvas runtime + camera (pan/zoom, fit-to-content, presets, deep-link camera state via URL)
- 5 group container frames (Input, Engine, Audience, Verdict, Actions, Content Analysis) as labeled Konva shapes + DOM overlay
- Node base component (Konva + DOM overlay hybrid)
- Board state machine (idle / streaming / complete / anti-virality / edit-input)
- Sidebar restructure (sections: New / Navigate / Running / Pinned / Recent / Projects placeholder / Account)
- Universal context-aware command bar (placeholder + chip actions per route + state)
- Input node + drawer (compact card + slide-out edit drawer with "Recent inputs" picker)
- `/dashboard` → `/analyze` redirect
- Existing `src/components/hive/*` tier-hive component fully removed
- Reduced-motion fallback (animations off, board structure + pan/zoom intact)
- Performance tier auto-detection (high / medium / low) with runtime FPS sampling fallback
- Accessibility scaffolding (ARIA, focus management, keyboard nav, alt text, contrast)
- First-board orientation tooltip
- Engine group children scaffolding (5 stage placeholders wired to existing SSE event stream from Phase 1)
- DB schema additions: `projects` table + `project_id` FK + default "My Boards" project migration (schema only, no UI)

**Out of scope:**
- Audience node implementation (Phase 4) — node container frame exists, body deferred
- Verdict / Actions / Content Analysis node bodies (Phase 5) — frames exist, bodies deferred
- Engine extensions (Pass 2, weighted aggregator, heatmap schema, filmstrip) (Phase 3)
- Reshoot script + optimal post time (Phase 6)
- Share & export (Phase 7)
- Mobile polish + onboarding overlays + Lighthouse audit (Phase 8)
- Project management UI (workspace milestone — future)
- Free-form conversational co-pilot (M2-II / M2-III)
- Canvas view of dashboard (workspace milestone)
- Templates, custom personas, team sharing (workspace milestone)
- Tribe v2 engine integration (M3 milestone)

</domain>

<decisions>
## Implementation Decisions

### Entry model + routing

- **D-01:** `/analyze` is the entry surface and the board canvas. Form is pre-pinned as the **Input node** with form rendered in a slide-out drawer (not inside the node body — node body shows compact submitted state, drawer shows full editable form). Empty board scaffold visible from t=0 with all 5 group container frames in preview-greyed state. On submit, URL updates to `/analyze/[id]` via **`pushState` (not replaceState)** so browser back/forward semantics work normally. Phase 1's D-09 holds (auth, `(app)` group). Phase 1's D-10 softens — submit doesn't navigate to a separate route, URL updates in place. Phase 1's D-11 (server shell at `/analyze/[id]`) holds, just wraps the board client component instead of the deprecated ResultCard.
- **D-02:** `/dashboard` redirects to `/analyze`. Existing `/dashboard` was the form + tier-hive entry; both functions move into the board. Existing `src/components/hive/*` tier-hive component is **fully deleted** (not deprecated) — agent doing this work must audit zero imports remain.
- **D-03:** "Dedicated dashboard" surface (workspace overview with projects/canvas view/templates) is **deferred to a future Workspace milestone**, not Phase 2. Schema for `projects` table ships now so workspace UI can layer on later without data migration pain.

### Canvas runtime + node architecture

- **D-04:** Canvas runtime = **Konva (React-Konva)**. Proven for node-graph apps, good perf, built-in hit-testing, plays well with React. Existing hive's raw Canvas 2D pattern is not reused — Konva replaces it. Architecture: **Konva for the spatial layer** (frames, wires, hit-test, animations), **DOM overlay for node body content** (charts via Recharts, text, accessibility, text-selection). This mirrors the working pattern from `HiveCanvas` + `HiveNodeOverlay` split — same pattern, new runtime, new content.
- **D-05:** 5 group container frames are **labeled rectangles (Miro Frames pattern)**, not compact supernodes that fan-out. Frames are always visible (preview-greyed when empty). Each frame has a title bar with name + count + expand/collapse chevron. Children laid out inside.
- **D-06:** Default spatial layout (auto-arranged, deterministic, same on phone and desktop for spatial-consistency mental model):
  - **Input** + **Engine** (compact, left column)
  - **Audience** (large central, the centerpiece)
  - **Verdict** (large hero, right column) with **Actions** flowing below it
  - **Content Analysis** (supporting row, beneath Audience+Verdict)
- **D-07:** Default complete-state camera = **fits Audience + Verdict as the hero pair** in viewport. On mobile portrait, stacks them vertically. On desktop, side-by-side.
- **D-08:** Camera presets (keyboard shortcuts on desktop, buttons on mobile): `1` fit Verdict, `2` fit Audience, `3` fit Content Analysis, `0` fit overview, `R` reset view.
- **D-09:** Live-stream camera intelligence: camera auto-pans to the active SSE stage during streaming (Wave 0 fires → glides to Engine + Hook decomp area, Wave 3 fires → glides to Audience area, `complete` → glides to Verdict + Audience hero). User touch override cancels auto-follow.
- **D-10:** **Spatial consistency is a feature** — node positions are part of the product. Same coordinates on phone and desktop. URL encodes camera state (`?focus=audience&zoom=2.4`) for deep-linkable boards (agency shares URL with client → opens at exactly the persona being discussed).

### Sidebar

- **D-11:** Sidebar sections (top to bottom):
  - ⊕ **New analysis** (CTA + `⌘N` shortcut, always visible, routes to fresh `/analyze` empty board)
  - **Navigate** (compact route nav: Boards (current), Trending, Settings)
  - ● **Running** (only visible when streaming, shows live progress per in-flight analysis; tap = jump to that board; disappears on complete, item moves to Recent)
  - ⭐ **Pinned** (starred boards, manual reorder, ~10 limit)
  - 🕐 **Recent** (chronological history, paginated/infinite-scroll, search input above section when expanded)
  - 📁 **Projects** (collapsed placeholder in Phase 2 — UI deferred to Workspace milestone, schema ships now)
  - 👤 **Account** (user + settings dropdown, bottom-anchored)
- **D-12:** Sidebar collapsible to icon-only column (40px wide) on desktop via `⌘\`. Mobile: hidden behind hamburger top-left, slides as full-height drawer.

### Universal command bar

- **D-13:** Bottom-pinned command bar exists on both `/analyze` and (future) `/dashboard` workspace surface. **Context-aware behavior:**
  - **Empty board:** placeholder *"Paste URL, drop file, or describe…"*; submit materializes Input node, pipeline starts
  - **Streaming:** disabled, shows live stage text + cancel button
  - **Complete:** placeholder *"Ask about your audience or generate variant…"*; suggested chip actions (rewrite hook, compare to last 3, generate variant, re-weight audience)
  - **Editing input (drawer open):** field hidden or replaced by drawer's own form
- **D-14:** Phase 2 ships **command bar surface + chip actions only**. Free-form natural-language interpretation (the conversational agent that answers "Why did Persona 3 swipe?" by reading board state) is **deferred to M2-II / M2-III**. Phase 2's chip actions are scripted: each chip triggers a specific known operation. Bar preserves AI-app muscle memory; full interpretation lands when worth the engineering investment.
- **D-15:** Bar auto-hides on idle option (slides down with chevron to re-open) — gives users a clean "board only" view mode when desired.

### Input node + drawer pattern

- **D-16:** Input node is a compact card on the board showing video thumbnail + brief snippet. Tap node → drawer slides out **from left (desktop)** or **as bottom sheet (mobile)** with full editable form. Drawer includes a **"Recent inputs" picker** (top-3 most-recent briefs/videos for one-tap reuse). Re-run → drawer closes, board updates in place, URL stays at `/analyze/[id]`, prior verdict optionally archived as a small "Previous: 2 min ago" ghost node beside Input.
- **D-17:** **One concurrent streamed analysis per session.** New run while one is in flight prompts confirm-or-cancel. Background-complete analyses queue and notify on completion (browser tab favicon dot, sidebar Running entry updates).

### State machine

- **D-18:** Board state machine has 5 states: **idle** (no analysis active) / **streaming** (SSE stream active) / **complete** (analysis finished) / **anti-virality** (complete + threshold triggered, cross-group visual state) / **edit-input** (drawer open, input node interaction). State changes drive node visibility, camera auto-follow, command bar behavior. State persists in URL + Supabase analysis record so resume from refresh / cross-device works.
- **D-19:** **Anti-virality is a cross-group coordinated state.** When triggered: Verdict shows orange "Don't post yet" + top 3 fixes; Audience highlights critical drop zones with orange treatment + rework guidance anchored to segments; Actions promotes reshoot script to hero. Phase 2 ships **the state machine + visual scaffolding** for this; Phase 4/5 ship the actual content.

### Performance tiers

- **D-20:** Three performance tiers, auto-detected via UA + GPU hints, runtime-validated via FPS sampling:
  - **High** (iPhone 13+, modern Android, desktop): 60fps target, full effects + animations
  - **Medium** (iPhone 11-12 — the test device — mid-range Android): 45-60fps, reduced parallax + simpler curve interpolation
  - **Low** (older / thermal-throttled): 30fps minimum, auto-engage reduced-motion subset
- **D-21:** Runtime sampling: if sustained <40fps for 3 seconds, drop tier with small "Optimized for your device" toast. Manual override available in settings (force tier).
- **D-22:** Phase 2 ships the **detection + degradation logic** baseline. Phase 4's Audience node is where perf will be most challenged and must respect the tier system.

### Reduced-motion fallback

- **D-23:** Option (a): **same composition, animations off, pan/zoom navigation intact**. User can still navigate the board freely with `prefers-reduced-motion` set; only the on-reveal animations, auto-pan, and parallax are disabled. No rotation, no fullscreen escape, no different layout.

### Accessibility (designed in, not retrofit)

- **D-24:** Phase 2 bakes accessibility into the substrate — Phase 8 audit doesn't retrofit:
  - All board nodes keyboard-navigable (tab order = spatial reading order)
  - Screen reader: Engine group announces stage transitions, Audience node (when built in P4) announces verdict + key dropoffs
  - WCAG AA contrast across all components
  - Heatmap accessibility scaffolding (numeric attention scores on tap, pattern-variant toggle for color-blind, persona row labels always visible, alt text on filmstrip frames) — substrate provides the hooks, Phase 4 fills in the heatmap-specific content
  - Focus rings visible, not suppressed
  - `aria-live` regions for streaming state changes

### `/dashboard` fate + tier-hive deletion

- **D-25:** `/dashboard` → `/analyze` redirect implemented in middleware or as a `redirect()` at the route level. Old `/dashboard` page contents removed.
- **D-26:** `src/components/hive/*` (existing tier-hive — `HiveCanvas`, `HiveNodeOverlay`, `hive-constants`, `hive-interaction`, `hive-layout`, `hive-mock-data`, `hive-renderer`, `hive-types`, `use-canvas-resize`, `use-hive-animation`, `use-hive-interaction`) is **fully deleted**. Audit zero imports remain. The new Audience node (Phase 4) uses a fresh component, not the tier-hive (despite ROADMAP risk wording — confirmed user decision: optimize for new system, remove old).

### Workspace schema foundation

- **D-27:** Phase 2 ships the **DB schema for projects** so future Workspace milestone can land without data migration:
  - `projects` table: `id`, `user_id`, `name`, `color`, `created_at`, `archived`
  - `analyses` table: add `project_id` FK
  - Migration: existing analyses default to user's "My Boards" project (created on first migration touch)
- No project management UI in Phase 2. Sidebar's `📁 Projects` section shows a collapsed placeholder.

### Claude's Discretion

- **Konva implementation details** — exact layer composition, refs vs declarative components, animation-engine choice (Konva built-in vs Framer Motion overlay for DOM), AbortController wiring for camera animations. Researcher/planner picks within the established Konva-runtime decision (D-04).
- **State machine implementation** — Zustand vs XState vs handcrafted reducer. Existing codebase uses Zustand for client state; lean toward Zustand unless researcher finds a strong reason otherwise.
- **Tier-hive deletion strategy** — single PR removing all files + import-audit, or staged removal. Researcher decides based on coupling depth.
- **Sidebar styling** — adapt existing layout patterns, no new tokens (NF3). Designer can adjust hierarchy/spacing within Raycast scale.
- **URL camera-state encoding format** — query params (`?focus=audience&zoom=2.4`) vs hash (`#audience@2.4`) vs path segment. Lean toward query params; researcher/planner picks.
- **Performance tier detection heuristics** — UA parsing vs Navigator.gpu vs WebGL feature detection vs initial benchmark frame burst. Researcher picks the most reliable signal.
- **Default project creation timing** — on user signup vs on first analysis vs lazy on first read. Planner decides.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + roadmap
- `.planning/MILESTONE.md` — Result Surface milestone scope, stack decisions locked, success criteria
- `.planning/ROADMAP.md` §Phase 2 — phase goal, plan list, success criteria, dependencies (refactored 2026-05-25 for board model)
- `.planning/REQUIREMENTS.md` §R1 (Result Board), §R2 (Audience Engine), §R3 (Mobile board), §R7.4 (first-board orientation), §NF1 (tiered FPS), §NF2 (accessibility), §NF3 (regression safety) — requirements refactored 2026-05-25 to reflect board model
- `.planning/PROJECT.md` §Key Decisions — locked architecture conventions (server-first, TanStack Query, Zustand, Canvas → Konva for this phase, React.useId)

### Phase 1 prior context (still applies)
- `.planning/phases/01-foundation-sse-consumer-engine-signal-extensions/01-CONTEXT.md` — Phase 1 decisions; D-04 (GET stream endpoint), D-07 (3-layer hook return), D-08 (`partial.personas[]` shape) all still apply. D-09 (auth + `(app)` group) still applies. D-10 softened (URL updates in place via pushState, not navigation). D-11 (server shell at `/analyze/[id]`) still applies (wraps board, not deprecated ResultCard).
- `.planning/phases/01-foundation-sse-consumer-engine-signal-extensions/01-PATTERNS.md` — engineering patterns from P1 carry forward (TanStack Query for server state, Zustand for UI state)

### Codebase intel
- `.planning/codebase/STACK.md` — Next.js 16, React 19, TanStack Query, Zustand, Recharts, Vitest. Phase 2 adds Konva (`react-konva` + `konva`) as new dependency.
- `.planning/codebase/ARCHITECTURE.md` — route groups, data flow, prediction pipeline, Supabase client trio
- `.planning/codebase/INTEGRATIONS.md` — Supabase tables, Sentry, env vars
- `.planning/codebase/STRUCTURE.md` — file-layout conventions for hooks/, components/, lib/engine/, app/

### Existing engine + hook surfaces (must read; remain valid post-Phase-1)
- `src/hooks/queries/use-analysis-stream.ts` — Phase 1's SSE consumer hook with `{ start, result, stages, partial, panelReady, phase, error, reconnect, analysisId }`. Phase 2's board consumes this directly.
- `src/lib/engine/events.ts` — `StageEvent` discriminated union, `StageEventCallback` contract
- `src/lib/engine/panel-mapping.ts` — Phase 1's panel-ready mapping module. Phase 2 may extend with a node-ready equivalent OR reuse mapping with renamed keys (researcher decides).
- `src/app/(app)/analyze/page.tsx` + `src/app/(app)/analyze/[id]/page.tsx` — Phase 1's route shells. Phase 2 rebuilds the client component (`ResultCard` → `Board`). Server shell stays.
- `src/middleware.ts` + `src/lib/supabase/middleware.ts` — auth gating for `(app)/analyze` routes (still applies). Update needed for `/dashboard` → `/analyze` redirect logic.

### Components to deprecate / replace
- `src/components/hive/*` — **DELETE** all files in this directory. Tier-hive is sunset per D-26.
- `src/app/(app)/dashboard/page.tsx` (and related) — **DELETE / REDIRECT** per D-25.
- Phase 1's `ResultCard` skeleton — **DELETE / REPLACE** by `Board` component built in this phase.

### Existing components to study (engineering patterns to inherit, not extend)
- `src/components/hive/HiveCanvas.tsx` + `HiveNodeOverlay.tsx` — Canvas + DOM overlay split pattern. Phase 2's Konva implementation mirrors this architecture (Konva for spatial layer, DOM for content + accessibility).
- `src/components/hive/use-hive-animation.ts` — RAF-driven animation loop pattern. Phase 2 may borrow patterns (module-level state for animation-once-only, refs over React state for per-frame perf) when building Konva animations.
- `src/components/hive/use-canvas-resize.ts` — DPR-aware resize handling.
- `src/components/ui/GlassPanel.tsx` (or wherever) — Raycast-styled container; use for node body backgrounds.

### Brand + design
- `BRAND-BIBLE.md` — Raycast design language (GlassPanel, 6% borders, 12px radius, coral #FF7F50)
- `CLAUDE.md` §Raycast Design Language Rules — verified token values, anti-patterns to avoid

### External docs
- React-Konva docs (https://konvajs.org/docs/react/) — official Konva React bindings reference. Researcher should verify SSR compatibility (Konva requires client-only rendering — `'use client'` directive + dynamic import with `ssr: false` needed).
- Konva.js performance guide (https://konvajs.org/docs/performance/All_Performance_Tips.html) — for tier-system implementation reference.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`useAnalysisStream` hook** (`src/hooks/queries/use-analysis-stream.ts`, Phase 1 D-01..D-08) — fully reusable. Board's state machine consumes `phase`, `stages`, `partial`, `result`, `panelReady`, `error` keys. No hook changes needed in Phase 2.
- **`(app)/analyze` server shell** (Phase 1 D-11) — wraps the board client component. Server fetches initial analysis state by id (if present in URL), client hydrates. Pattern stays.
- **Existing auth middleware** (Phase 1 D-09) — `(app)` route group already auth-gated. `/dashboard` → `/analyze` redirect inherits this.
- **TanStack Query** — server state. Phase 2's board reads from existing query keys; new queries (project list, recent boards) follow same convention at `src/lib/queries/query-keys.ts`.
- **Zustand stores** (`src/stores/*`) — client UI state. Phase 2's board state machine fits here (camera state, selected node, drawer open/closed, command bar focus).
- **GlassPanel primitive** — Raycast-styled container, used for all node bodies + group container frames.
- **Hive component pattern (HiveCanvas + HiveNodeOverlay split)** — engineering pattern to inherit. Phase 2 deletes the implementation but borrows the architecture (Konva spatial + DOM overlay = same two-layer split, new runtime).

### Established Patterns

- **Server components by default**, client only when interactive. Board is client (`'use client'` mandatory for Konva). Server shell at `(app)/analyze/[id]/page.tsx` fetches initial data, hands to client `Board`.
- **TanStack Query for server state, Zustand for ephemeral UI state.** Board camera state, drawer open/closed, selected node = Zustand. Analysis result + project list + recent boards = TanStack Query.
- **Three-layer auth**: middleware → server layout check → AuthGuard. New routes inherit this for free. `/dashboard` → `/analyze` redirect happens before auth check (always redirect, then auth-check the destination).
- **Pipeline graceful degradation** — every non-critical UI fragment renders fallback content on error. Group container frames render preview-greyed if their data isn't ready. Persona rows show skeleton state until streaming Pass 2 fills them in (Phase 4 detail).
- **Structured logger** (`src/lib/logger.ts`) — instrument board lifecycle events (board_opened, node_tapped, camera_preset_used, command_bar_submitted) per NF4.
- **`prefers-reduced-motion` respected** via `usePrefersReducedMotion` hook (already exists for hive). Phase 2 reuses or reimplements.

### Integration Points

- **New route components:** Phase 2 rebuilds `src/app/(app)/analyze/page.tsx` (empty board landing) and `src/app/(app)/analyze/[id]/page.tsx` client component (`Board.tsx`).
- **New canvas runtime:** `src/components/board/` (new directory):
  - `Board.tsx` — top-level client component, hosts Konva `Stage`, camera state, state machine wiring
  - `BoardCanvas.tsx` — Konva `Stage` + `Layer` setup, hit-test, camera transformations
  - `GroupFrame.tsx` — labeled rectangle container component
  - `Node.tsx` — base node component (Konva shape + DOM overlay)
  - `InputNode.tsx` + `InputDrawer.tsx` — Input node + slide-out edit drawer
  - `EngineGroup.tsx` — Engine group children scaffolding (stage placeholders)
  - `BoardStateMachine.ts` — state machine module (Zustand store or XState)
  - `use-camera.ts` — camera state + presets + auto-follow
  - `use-board-keyboard.ts` — keyboard shortcuts
  - `board-constants.ts` — layout positions, sizes, padding, tier-specific perf budgets
  - `board-types.ts` — TypeScript interfaces for nodes, groups, camera, state
- **New shared components:**
  - `src/components/sidebar/` — Sidebar restructure (sections per D-11)
  - `src/components/command-bar/` — Universal context-aware command bar
- **Redirect logic:** `src/middleware.ts` — add `/dashboard` → `/analyze` rule, OR `src/app/(app)/dashboard/page.tsx` exports `redirect('/analyze')` server-side.
- **Deletion:** `src/components/hive/*` (all files), `src/app/(app)/dashboard/*` (old contents), Phase 1's `ResultCard` (per D-26).
- **DB migration:** `supabase/migrations/<timestamp>_add_projects.sql` — creates `projects` table, adds `project_id` FK to `analyses`, default-project seed for existing users.
- **Performance detection:** `src/lib/perf-tier.ts` (new) — UA + GPU detection, runtime FPS sampling, Zustand store for current tier, subscribe API for components.
- **Accessibility utility:** `src/lib/a11y.ts` (extend or new) — `aria-live` helpers, focus management, keyboard nav utilities for the board.

### Konva integration notes

- React-Konva requires **`'use client'` directive** and is SSR-unsafe by default. Pattern: top-level `Board.tsx` is a client component; lazy-load Konva pieces with `next/dynamic({ ssr: false })` to avoid hydration errors.
- Konva text rendering is acceptable but less crisp than DOM. **All readable text content (labels, metrics, chart values) lives in the DOM overlay layer**, not in Konva. Konva renders only spatial primitives (frames, wires, dropoff markers, heatmap cells in Phase 4).
- DPR-aware rendering — Konva has built-in `pixelRatio` support; mirror the pattern from `use-canvas-resize.ts`.
- Hit-test happens at the Konva layer; tap events bubble up to React handlers; DOM overlay also receives pointer events for nodes that need text-selection or accessibility.

</code_context>

<specifics>
## Specific Ideas

- **No new design tokens** (NF3) — reuse Raycast scale already in BRAND-BIBLE.md. Coral #FF7F50 is the only accent color across the board.
- **Spatial consistency is a feature, not a constraint** — same node positions across phone + desktop. Agency screen-sharing with client on phone = same board, same coordinates, shared vocabulary ("look at the verdict node, bottom-right"). Bake this into the layout algorithm.
- **Krea AI Nodes** (`~/Downloads/Krea AI Nodes.webp`) — visual reference for the node-board interaction model. Studio aesthetic: dark monochrome, persistent canvas, nodes as manipulable objects, wires showing data flow. Raycast-compatible restraint.
- **Meta Tribe v2** (`~/Downloads/Meta-Tribe-V2-2_1.jpeg`) — information architecture reference. Pipeline boxes labeled with framework names → engine stages. Subject blocks → persona rows. Time-resolved output → audience heatmap. Filmstrip top axis → keyframe thumbnails. Borrow IA + restraint, replace neuroscience visuals with audience-specific ones.
- **Claude desktop sidebar pattern** (`~/Downloads/<screenshot>.png`) — Phase 2 sidebar mirrors Claude's structure (collapsible left sidebar with sections + recents + account), Virtuna nouns swapped in (Projects, Pinned, Recent, Running).
- **Sidebar collapse shortcut** = `⌘\` (Claude convention). New analysis = `⌘N`. Camera presets = `1`/`2`/`3`/`0`/`R`.
- **Performance test device** = iPhone 11 (user's). Medium tier target (45fps). Validate empirically; if below, drop further or harden tier degradation.
- **Tribe v2 engine integration** = M3 milestone, NOT this milestone. Phase 3 ships Qwen Pass 2 + thinking-mode as the per-segment quality answer; Tribe-style frozen encoder grounding and trained subject block are roadmapped for after Intelligence Surface drop.
- **Cost not a concern** — Qwen migration removed the cost ceiling. Quality > cost everywhere. Engine work in Phase 3 takes the L2+ tier without budget hesitation.
- **`bypassPermissions` rule on subagents** — global agent-teams protocol applies. Workers run with `bypassPermissions: true` so they don't block on permission prompts; auditor/reviewer agents stay in `default` mode.

</specifics>

<deferred>
## Deferred Ideas

- **Free-form conversational co-pilot** ("Why did Persona 3 swipe?", "Compare to my last 3 videos") — Phase 2 ships command bar surface + scripted chip actions only. Full natural-language interpretation with board-state RAG + tool calls deferred to M2-II / M2-III.
- **Workspace milestone** (post-Intelligence-Surface drop): project management UI, canvas view of dashboard with past-analyses-as-nodes, compare node, cohort node, templates, custom personas library, team sharing, real-time co-edit (Figma-style cursors). Schema for `projects` table ships in Phase 2.
- **Tribe v2 engine integration** = M3 milestone. Two options for later: (a) frozen V-JEPA2 + W2vec-BERT + Llama 3.2 encoder grounding for persona prompts, (b) retrained Subject Block on outcome data for ensemble cross-check with LLM persona heatmap. Phase 3 ships L2+ Qwen Pass 2 timeline instead.
- **Outcome feedback loop** (M2-III): once user posts a video, real TikTok analytics overlay on the predicted Audience heatmap → "predicted vs actual" comparison node. Closes the prediction-vs-reality loop. Requires real-engagement data ingestion pipeline.
- **Multi-video boards** (Workspace milestone): "Add variant" button on Input node → second Input + pipeline + subjects appear on the same board for A/B compare. Phase 2's substrate doesn't preclude this — design layout algorithm with future-extensibility in mind.
- **Custom personas dropped onto Audience group** (Workspace milestone): agency uploads a brand persona file, becomes a new subject row.
- **Per-niche / per-creator / per-analysis weight overrides** (Workspace milestone): schema future-proofed in Phase 3, UI deferred.
- **Real-time collaboration** (Workspace milestone): Figma-style cursors, board comments, presenter mode.
- **Export-as-report node** (Workspace milestone): render board snapshot as PDF for client deliverables.
- **API node + integrations** (Workspace milestone): engine output as a wire, pipe into Zapier/Slack.
- **"AI co-pilot" deep node interactions** ("scroll to this", "highlight that"): deferred until conversational co-pilot lands.
- **Heatmap layer toggle** (Attention / Emotion / Engagement / Skip-probability) — Phase 4 ships single attention layer; toggle deferred to v1.5.
- **Dashboard canvas view with past-analyses-as-nodes** — Workspace milestone.
- **Templates marketplace + "save as template" + "apply to new analysis"** — Workspace milestone.
- **Live-stream "AI thinking" voice-over / commentary** — interesting concept but deferred indefinitely.
- **Persona avatars / faces vs abstract dot markers** — Phase 4 design decision; substrate doesn't constrain.

</deferred>

---

*Phase: 2-Board-substrate-Navigation*
*Context gathered: 2026-05-25*
