# Phase 4: Live Audience Node — Research

**Researched:** 2026-05-27
**Domain:** Client-side data viz (canvas curve + CSS-Grid heatmap) + Konva-overlay composition + SSE-driven choreography
**Confidence:** HIGH (most surfaces locked by CONTEXT.md + UI-SPEC.md + Phase 2/3 shipped code)

---

## Executive Summary

Phase 4 builds the **Audience node** entirely inside the Audience group container frame already shipped by Phase 2. Konva owns nothing inside the node body — per **O-1 / D-10**, all rendering is DOM-native: dedicated `<canvas>` for the retention curve, CSS Grid for the heatmap, `<img>` row for the filmstrip, GlassPanel-backed popovers and drawers for tap surfaces. Data is **already locked** by Phase 3: `HeatmapPayload` shape in `src/lib/engine/types.ts` lines 27–50, partial streaming via `partial.personas[].attentions[]` (D-15 / use-analysis-stream lines 162–201), `pass2_persona_start` / `pass2_persona_end` / `filmstrip_segment_ready` SSE events in `src/lib/engine/events.ts`.

**Primary recommendation:** Ship 12 sub-plans in dependency order — **4.1 shell + 4.2 chips → 4.3 filmstrip + 4.4 curve + 4.5 markers in parallel → 4.6 heatmap → 4.7 choreography hook → 4.8 popover + inspector → 4.10 anti-virality + 4.11 weight override → 4.12 mobile portrait pass**. Collapse plan **4.9 into 4.8** (PersonaInspector absorbs the inline-expand pattern per D-14 + UI-SPEC §PersonaInspector "Plan 4.9 fate"). Hand-roll Catmull-Rom α=0.5 in canvas (≤25 LOC, no d3-shape dep needed). Wire choreography off `useAnalysisStream` — no new hook signature required. Mirror `weighted-aggregator.ts` exactly in a shared `lib/engine/persona-weights.ts` pure function for client-side recompute (O-5).

**Top risks (mitigated below):**
1. Konva ↔ DOM overlay sync drift on simultaneous pan + zoom — already solved in Phase 2 (`BoardCanvas.tsx` handleDragMove writes live drag offset to store; `NodeOverlay.tsx` projects via `world * scale + camera.x`).
2. 10 simultaneous L→R cell-fill waves on Pass 2 stream — RAF-shared loop + opacity-only animation keeps GPU paint to compositor thread.
3. iOS Safari momentum scroll vs. Konva pan — Phase 2 already uses `touchAction` + Konva `draggable`; bottom-sheet inspector / drawer must use Radix Sheet + portal (not nested inside Konva Stage) to avoid event capture.
4. Anti-virality re-evaluation during slider drag (D-20) — pure-function `isTimelinePatternTriggered(heatmap)` works client-side; orange band animates in/out on slider change.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Architectural optimizations (O-1 … O-6, all accepted):**
- **O-1** Konva stages Audience frame only; curve = dedicated `<canvas>`, heatmap = CSS Grid, filmstrip = `<img>` row — DOM-native inside the node body.
- **O-2** Per-cell fill during stream, not row-on-complete. Row skeleton at `pass2_persona_start`; cells fade-fill as `partial.personas[i].attentions[j]` arrives; saturation at `pass2_persona_end`.
- **O-3** Curve update strategy = Pass 1 baseline → **single** 800ms morph to weighted curve when ≥7-of-10 Pass 2 complete. Do NOT update curve per persona.
- **O-4** Filmstrip placeholder = coral band + `heatmap.segments[].label` text; swap to `<img>` on `filmstrip_segment_ready`.
- **O-5** Weight override = **client-side recompute**, no engine roundtrip. Pure-function helpers in `lib/engine/persona-weights.ts` (already shipped) + `weighted-aggregator.ts` math mirrored client-side.
- **O-6** Mobile portrait heatmap = collapsed aggregate band by default + bottom sheet (NOT inline) on tap.

**Composition (D-01 … D-04):**
- **D-01** Desktop stack order: Chips → Filmstrip → Curve+markers → Heatmap drawer (collapsed).
- **D-02** 5 chips: Avg watch %, Loop %, Top dropoff, Hook score, vs Niche. Weighted_* when Pass 2 ≥7/10, else fall back to `persona_behavioral_aggregate.*`.
- **D-03** Heatmap closed by default — "Show personas ▾" affordance.
- **D-04** Mobile portrait = same world coordinates as desktop; only heatmap drawer adapts to bottom-sheet.

**Streaming choreography (D-05 … D-07):**
- **D-05** Persona row reveal = **fixed archetype hierarchy** at t=0 (skeletons pre-render): FYP×6 → niche×2 → loyalist×1 → cross-niche×1. NOT completion-order.
- **D-06** Cell fill = L→R wave, 180ms total per row, 18ms stagger per cell.
- **D-07** Curve morph timing: 300ms baseline ease-in on `complete`, **single 800ms morph** to weighted curve when ready. Markers fade in during the same 800ms window.

**Retention curve (D-08 … D-10):**
- **D-08** Coral 2px stroke, gradient fill (coral/15 → transparent), catmull-rom α=0.5, hook zone coral/8 warm band.
- **D-09** Y-axis % labels only. No x-axis labels — filmstrip IS the x-axis.
- **D-10** Curve in dedicated `<canvas>` in DOM overlay, NOT Konva. RAF morph + marker fade.

**Markers + tap interactions (D-11 … D-14):**
- **D-11** Coral dots, archetype-tier ring (FYP=coral-500, niche=coral-300, loyalist=coral-100, cross=white/30). No avatars.
- **D-12** Cluster collapse threshold: ≥3 within 12px OR ≥2 within 6px → single dot + superscript count.
- **D-13** Tap model: popover for glance, bottom sheet (mobile) / right inspector (desktop) for deep read.
- **D-14** **Claude's discretion** — researcher recommends collapsing inline-expand into the inspector (see decision below).

**Anti-virality (D-15 … D-17):**
- **D-15** QUIET treatment — curve gradient transitions coral→orange only in affected x-range. ⚠ chips below filmstrip in those segments. Heatmap cells stay coral.
- **D-16** Fix-chip anchoring = inline chips below filmstrip + full top-3 in Verdict (cross-group ripple per Phase 2 D-19).
- **D-17** BOTH triggers honored: `confidence < 0.4` (border/header only) + `isTimelinePatternTriggered(heatmap)` (full per-segment treatment).

**Weight override (D-18 … D-22):**
- **D-18** Preset chips + Custom slider panel. Default mix 65/20/10/5. Presets: Default / Established (40/20/30/10) / Niche-heavy (30/55/10/5) / New creator (75/15/5/5) — researcher confirms.
- **D-19** Weights badge IS the affordance — tap opens drawer. Same drawer routed from command-bar "re-weight audience" chip.
- **D-20** Recompute = client-side immediate, 16ms RAF debounced on slider drag. Anti-virality re-evaluates during drag.
- **D-21** Persistence = per-analysis sticky default + opt-in "Save as my default" toggle.
- **D-22** DB writes: `analyses.analysis_override` JSONB column on Apply; new `creator_persona_weights` table on Save-as-default opt-in. Phase 4 ships the migration.

### Claude's Discretion (researched in this doc)

- Konva ↔ DOM overlay composition specifics → **resolved**: extend Phase 2 `NodeOverlay.tsx` directly; no new primitive needed (see Architecture §).
- Bezier interpolation library → **resolved**: hand-roll Catmull-Rom α=0.5 (≤25 LOC); no d3-shape dependency (see Sub-component 4.4).
- Cluster-collapse exact pixel thresholds → **start with D-12 values** (≥3 within 12px, ≥2 within 6px); tune empirically against fixtures (open question 4).
- Per-persona row inline expand fate (4.9) → **collapse into PersonaInspector** per UI-SPEC §PersonaInspector "Plan 4.9 fate" — heatmap rows too narrow for in-place expansion.
- Preset values for Established / Niche-heavy / New creator → **ship UI-SPEC values verbatim**; sweep deferred to post-launch outcomes corpus.
- Auto-renormalize algorithm → **proportional** (UI-SPEC §WeightOverrideDrawer Auto-renormalize). Lock-pin gesture deferred.
- Color-blind heatmap pattern variant → **diagonal stripes** at 45°, 2px stroke, `rgba(255,255,255,0.15)`, density proportional to attention (UI-SPEC §HeatmapDrawer Color-blind mode). Test against deuteranopia + protanopia simulators.
- Reduced-motion behavior → **UI-SPEC Motion Budget table is authoritative** — jump-cut curve morph, instant cell saturation, 150ms opacity transitions only.
- Perf-tier degradation → **Low tier**: skip curve morph + skip L→R wave + jump to final values. **Medium tier**: halve L→R wave to 90ms, keep curve morph.

### Deferred Ideas (OUT OF SCOPE)

Heatmap layer toggle (Attention/Emotion/Engagement/Skip-probability), persona avatars in markers, free-form conversational co-pilot, per-niche workspace weight UI, outcome feedback overlay, per-segment audio waveform, multi-video boards comparison, real-time collaboration cursors, pinch-to-zoom synchronized curve+heatmap scrub, counterfactual-anchored cell highlighting, per-marker desktop hover preview (ship if cycles permit), custom personas drop, Audience-node PNG snapshot export.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R1.2 | Audience node centerpiece — chips + filmstrip + curve + markers + heatmap + tap interactions + weights badge + anti-virality + mobile portrait | Entire research doc — covers all sub-components 4.1–4.12 |
| R2.2 | Pass 2 dedicated per-persona timeline call output `{persona_id, segment_reactions[]}` — already shipped | §Engine Data Contract — Pass2PersonaResult shape from `weighted-aggregator.ts` lines 26–47, streamed via `partial.personas[].attentions[]` |
| R2.3 | Weighted aggregator — weighted retention curve, headline metrics from weighted aggregate, future-proofed for overrides | §Engine Data Contract — `buildWeightedCurve()` shape; client-side recompute strategy in 4.11 |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audience node spatial frame | Konva (board substrate) | — | Consistent with all other group container children per Phase 2 D-04 |
| Retention curve render | Browser (Canvas 2D) | — | DPR-aware, RAF morph, no Konva overhead per O-1/D-10 |
| Heatmap grid render | Browser (DOM / CSS Grid) | — | Native a11y, text-selection, CSS variable swap for color-blind mode per O-1 |
| Filmstrip render | Browser (DOM `<img>`) | — | Native lazy-load, alt text from Gemini `visual_event` labels |
| Pass 2 per-persona timeline | API (engine) | — | Shipped Phase 3 — Audience node consumes only |
| Weighted aggregator math | API (server) | Browser (client recompute) | O-5: server canonical, client mirrors for instant slider feedback. Pure-function port. |
| Anti-virality dual-trigger evaluation | API (server, on final result) | Browser (re-eval on slider drag) | Both `isAntiViralityGated` + `isTimelinePatternTriggered` already pure functions — safe to call client-side |
| Persona weight persistence | DB (Supabase) | — | `analyses.analysis_override` JSONB + new `creator_persona_weights` table |
| Filmstrip keyframe URLs | CDN (Supabase Storage signed URLs) | — | Phase 3 shipped — Audience swaps placeholder → `<img>` on `filmstrip_segment_ready` SSE event |
| Streaming choreography orchestration | Browser (custom hook) | — | Subscribes to `useAnalysisStream`, drives RAF + CSS transitions |

---

## Engine Data Contract (Phase 3-shipped, locked)

**All shapes verified by reading current Phase 3 source.**

### `HeatmapPayload` (consumed in `result.heatmap`)

From `src/lib/engine/types.ts` lines 27–50 [VERIFIED: file read 2026-05-27]:

```ts
interface HeatmapPayload {
  segments: Array<{
    idx: number;
    t_start: number;
    t_end: number;
    label?: string;                          // omni-supplied visual_event short label
    is_hook_zone: boolean;
    keyframe_uri: string | null;             // signed URL; null until filmstrip ready
  }>;
  personas: Array<{
    id: string;                              // matches existing persona.id
    attentions: number[];                    // length === segments.length
    swipe_predicted_at: number | null;       // t value
    segment_reasons: Record<number, string>; // sparse, inflection points only
  }>;
  weighted_curve: number[];                  // weighted aggregate attention per segment
  weights: { fyp: number; niche: number; loyalist: number; cross_niche: number };
  weights_source: 'default' | 'niche_override' | 'creator_override' | 'analysis_override';
}
```

Adjacent on `PredictionResult` (types.ts lines 328–331):
```ts
weighted_completion_pct?: number | null;
weighted_top_dropoff_t?: number | null;
weighted_hook_score?: number | null;
heatmap?: HeatmapPayload | null;             // null when Pass 2 < 7/10 (D-06)
```

### `Pass2PersonaResult` (server-internal — used in fixture builders)

From `src/lib/engine/wave3/weighted-aggregator.ts` lines 26–47 [VERIFIED]:
```ts
interface Pass2PersonaResult {
  persona_id: string;
  archetype: "high_engager" | "saver" | "lurker" | "sharer" | "viewer" | "niche_deep" | "loyalist" | "cross_niche_curiosity";
  slot_type: "fyp" | "niche" | "loyalist" | "cross_niche";
  segment_reactions: Array<{ t_start: number; t_end: number; attention: number; reason?: string; swipe_predicted: boolean }>;
  pass2_latency_ms: number;
  pass2_cost_cents: number;
}
```

### Streaming partial shape (consumed during Pass 2)

From `src/hooks/queries/use-analysis-stream.ts` lines 42–52 [VERIFIED]:
```ts
interface PerPersonaPartial {
  id: string;
  status: "pending" | "streaming" | "complete";
  verdict?: string;
  reasoning?: string;
  pass2_status?: "pending" | "streaming" | "complete";
  attentions?: number[];                    // D-15 — fills as Pass 2 streams
  swipe_predicted_at?: number;
}
```

Returned via `stream.partial.personas[]` from `useAnalysisStream()`. Hook already dispatches:
- `pass2_persona_start` → marks persona `pass2_status: 'streaming'`, seeds row (lines 163–177)
- `pass2_persona_end` → writes final `attentions[]` + `swipe_predicted_at`, marks `complete` (lines 178–201)

### SSE events (Phase 3-shipped)

From `src/lib/engine/events.ts` lines 12–15 [VERIFIED]:
```ts
| { type: "pass2_persona_start"; persona_id: string; archetype: string }
| { type: "pass2_persona_end"; persona_id: string; archetype: string; latency_ms: number; cost_cents: number; ok: boolean; attentions?: number[]; swipe_predicted_at?: number | null }
| { type: "filmstrip_segment_ready"; segment_idx: number; keyframe_uri: string }
```

**`filmstrip_segment_ready` is not currently routed into `useAnalysisStream`'s dispatch table** (only `pass2_*` events are). The keyframe URI lands as part of the final `complete` event via `result.heatmap.segments[].keyframe_uri`. **Phase 4 must extend `dispatch()` in `use-analysis-stream.ts` to handle `filmstrip_segment_ready` and merge `keyframe_uri` into a live local map** (see Sub-component 4.3). This is a tiny additive change, not a hook signature break.

### Anti-virality dual-trigger (Phase 3-shipped)

From `src/lib/engine/anti-virality.ts` lines 91–108 [VERIFIED]:
```ts
isAntiViralityGatedFull(confidence, heatmap): {
  gated: boolean;
  reason: "confidence" | "timeline_pattern" | "both" | null;
  dropoff_segment_indices: number[];
}
```
- Pure function — safe to call client-side during slider drag (O-5/D-20).
- `topDropoffSegmentIndices(heatmap, n=3)` returns the worst-drop segment indices used by fix-chips.

### Client-side weight resolver (Phase 3-shipped)

`src/lib/engine/persona-weights.ts` exports `resolveWeights(config, context)`, `normalizeWeights(w)`, `DEFAULT_PERSONA_WEIGHT_CONFIG`. Pure module — no server-only imports. **Use as-is from client.**

### Client-side curve recompute (needs porting)

`src/lib/engine/wave3/weighted-aggregator.ts` is server-side but imports only `createLogger` (`@/lib/logger`) and pure types — verified at file head. **Recommendation:** extract `buildWeightedCurve()` + `normalizeOverSurvivors()` + `getPersonaWeight()` into a small `src/lib/engine/wave3/weighted-aggregator-client.ts` that re-exports the pure functions without the logger import — OR — gate the logger import behind a "use server" boundary check.

**However**, plan 4.11 doesn't actually need `pass2Results: Pass2PersonaResult[]` (which is server-internal). It only needs `heatmap.personas[].attentions[]` (already in `HeatmapPayload`) plus current weights. A simpler client-side helper signature:

```ts
// New: src/lib/engine/persona-weights-client.ts (Phase 4)
recomputeWeightedCurve(
  personas: HeatmapPayload['personas'],
  segments: HeatmapPayload['segments'],
  slotTypeByPersonaId: Record<string, PersonaSlotType>,  // need to surface from server
  weights: PersonaWeights,
): { weighted_curve: number[]; weighted_completion_pct: number; weighted_top_dropoff_t: number; weighted_hook_score: number }
```

**Open question 1 (below):** `slot_type` (FYP/niche/loyalist/cross_niche) is NOT currently surfaced in `HeatmapPayload.personas[]`. The schema has `personas[i].id` only. For client-side recompute, we need the slot_type mapping. Two options:
- (A) Extend `HeatmapPayload.personas[]` with `slot_type: 'fyp' | 'niche' | 'loyalist' | 'cross_niche'` (additive — backwards-compatible). **Recommended.**
- (B) Maintain a separate `slot_type_by_persona_id` field on `PredictionResult`. Worse — extra denormalized state.

Planner must reconcile: is option A a Phase 4 schema change or Phase 3 amendment? Recommendation: **ship as part of Phase 4 plan 4.11** since it's additive and Phase 3 is already merged.

---

## Architecture: Konva + DOM Overlay

### Existing Phase 2 pattern (reused verbatim)

The Audience node extends the Phase 2 `NodeOverlay.tsx` pattern (verified at `src/components/board/NodeOverlay.tsx` lines 17–58). World→screen projection is one-liner math: `screenX = bounds.x * camera.scale + camera.x`. The overlay div is `pointer-events-auto absolute`, GlassPanel-wrapped, with `tabIndex` + `aria-label` + `onClick`. Phase 2 plan 2.16 fixed the drag-sync bug — `BoardCanvas.tsx` writes live `stage.x()/y()` into the board store on every `onDragMove` (lines 33–45), so the DOM overlay never drifts during pan/zoom.

### Composition pattern for Phase 4

```
Board.tsx
  └─ BoardCanvas (Konva Stage)
       └─ GroupFrame (Audience) — renders the frame border + bg in Konva
  └─ <div className="pointer-events-none absolute inset-0">
       └─ GroupFrameOverlay (Audience) — title bar + chevron in DOM, expand state
            └─ {children} === <AudienceNode />          ← Phase 4 plugs in here
                 └─ <NodeOverlay spec={audienceSpec} camera={camera} ...>
                      └─ HeadlineChips
                      └─ Filmstrip
                      └─ <canvas ref={curveRef} />     ← RetentionCurve + DropoffMarkers (single canvas)
                      └─ AntiViralityOverlay (annotation chips)
                      └─ HeatmapDrawer (collapsed by default)
            (Portals at document.body level for popover + inspector + drawer)
            └─ TapPopover (Radix Popover in portal)
            └─ PersonaInspector (Radix Dialog/Sheet in portal)
            └─ WeightOverrideDrawer (Radix Sheet in portal)
```

**Decision: Reuse `NodeOverlay.tsx` directly, but feed it a synthetic `NodeSpec`** — the Audience node fills the entire Audience group frame body. Audience `bounds` = Audience group frame `bounds` minus title bar height (`TITLE_BAR_HEIGHT = 36`). World coordinates from `board-constants.ts` line 28: `audience: bounds: { x: 336, y: 0, width: 560, height: 576 }`.

**Why not Konva for inner content?** Per O-1 + verified by reading Phase 2's `Node.tsx`: Konva inside the node body has no value for Phase 4 surfaces — DOM gives us native text selection, native a11y (especially heatmap grid + axis labels), CSS-variable theming (color-blind toggle), and easy popover positioning via portals. Konva would force re-implementing all of these.

### Canvas tap handling

Per UI-SPEC §RetentionCurve "Canvas tap handling" — `pointermove`/`pointerdown` on the `<canvas>` element itself. Compute screen→data coordinate using the canvas bounding rect + the stored x-axis transform (segment widths). On hit, position a Radix Popover anchored at the pointer coordinate via a hidden `<div>` anchor element with absolute positioning — Radix handles flip/avoid-edge logic automatically (verified at `src/components/ui/popover.tsx` lines 22–37, uses `PopoverPrimitive.Portal` with `align`/`sideOffset`).

### Z-index hierarchy (additive to Phase 2)

| Layer | z | Source |
|-------|---|--------|
| Board Konva Stage | 0 | BoardCanvas |
| DOM overlay (group frames + nodes) | 0 (absolute) | Board.tsx pointer-events-none parent |
| Camera overlay (preset chips) | 100 | CameraOverlay |
| Orientation hint | 150 | OrientationHint |
| Command bar | 200 | CommandBar |
| **TapPopover** | **300 (portal)** | Phase 4 new — above command bar but below modals |
| **PersonaInspector / WeightOverrideDrawer** | **400 (portal)** | Phase 4 — matches UI-SPEC `--z-modal` |
| Toast | 500 | Existing |

---

## Sub-component Strategy

### 4.1 — AudienceNode shell

- Single file `src/components/board/audience/AudienceNode.tsx`. Client component (`'use client'`).
- Wraps `<NodeOverlay>` with synthetic `NodeSpec` derived from the Audience group frame layout.
- Subscribes to `useAnalysisStream()` for `partial`, `result`, `phase`, `stages`.
- Subscribes to `useBoardStore(s => s.boardState)` for idle/streaming/complete/anti-virality derivation.
- Renders skeleton state when `boardState === 'idle' | 'edit-input'` or when `phase === 'idle'`.
- Plugs into existing `GroupFrameOverlay` via the `children` prop slot — `Board.tsx` line 301 currently renders `<EngineGroup />` for the engine frame; add a parallel branch for `audience` → `<AudienceNode />`.
- ARIA: `<section aria-label="Audience analysis" aria-live="polite" aria-busy={isStreaming}>` per UI-SPEC.

**Dependencies on existing code:**
- `src/components/board/NodeOverlay.tsx` (reuse)
- `src/hooks/queries/use-analysis-stream.ts` (reuse — extend dispatch table for `filmstrip_segment_ready`)
- `src/stores/board-store.ts` (reuse — no new state)
- `src/hooks/usePrefersReducedMotion.ts` (reuse)
- `src/lib/perf-tier.ts` (reuse — `usePerfStore`)

### 4.2 — HeadlineChips

- 5 chips + 1 weights badge in a flex row, gap `--spacing-4` (16px).
- Each chip is `<dl role="term/definition">` per UI-SPEC §HeadlineChips ARIA.
- Skeleton state: `<Skeleton>` blocks (existing component at `src/components/ui/skeleton.tsx`).
- Data source policy (D-02 / UI-SPEC table): `weighted_*` when present, fall back to `persona_behavioral_aggregate.*`. Helper `pickHeadlineMetric(result, weightedKey, fallbackKey)` lives in `audience-types.ts`.
- vs Niche badge: positive `--color-success`, negative `--color-error` (NOT `--color-warning` — warning is reserved for anti-virality).
- Weights badge text: `"Weighted: ${fyp*100}/${niche*100}/${loyalist*100}/${cross_niche*100}"`. Tappable — opens `WeightOverrideDrawer`.

### 4.3 — Filmstrip

- Horizontal flex row of segment cells. Cell width = `(t_end - t_start) / total_duration * containerWidth`, min 48px.
- Default state per segment: coral/20 tinted band + `segment.label` text (12px, secondary).
- Loaded state: `<img src={keyframe_uri} alt={label}>` with 150ms opacity cross-fade.
- **Live keyframe handling:** Phase 4 must extend `useAnalysisStream`'s dispatch (lines 153–225) to capture `filmstrip_segment_ready` events into a local `keyframesByIdx: Record<number, string>` returned from the hook as a new 10th key, OR — preferred — use a small additional hook `useFilmstripKeyframes()` that subscribes to the SSE stream via the same EventSource pattern. **Recommendation:** add 10th key `filmstrips: Record<number, string>` to `useAnalysisStream` return — additive, no breaking change for Phase 1/2 consumers.
- Anti-virality annotation strip (20px) below filmstrip — conditional render based on `isAntiViralityGatedFull(result.confidence, result.heatmap).reason === 'timeline_pattern' | 'both'`.
- Horizontal scroll on overflow (touch + wheel), no scrollbar.
- ARIA: `<figure aria-label="Video keyframe filmstrip">` per cell `aria-label="Segment N: {label}, {t_start}s to {t_end}s"`.

### 4.4 — RetentionCurve (Canvas + RAF)

- DPR-aware setup per UI-SPEC §RetentionCurve — `canvas.width = w*dpr; canvas.height = h*dpr; ctx.scale(dpr, dpr); canvas.style.{width,height}` in CSS pixels. **Pattern verified in `src/components/hive-demo/hive-demo-canvas.tsx` lines 52–62** — copy this DPR pattern directly.
- Catmull-Rom α=0.5 hand-rolled: convert N data points into a Bezier path on a Canvas 2D context. Reference impl: 4 control points → `ctx.bezierCurveTo`, applied piecewise. ≤25 LOC. No d3-shape dep needed [VERIFIED: npm view d3-shape version → 3.2.0, last published 2022 — would add 248KB unpacked to bundle, no tree-shaking benefit for one curve type].
- Render order per RAF tick:
  1. Clear canvas.
  2. Hook zone warm band (0–3s x range, `rgba(255,127,80,0.08)`).
  3. Anti-virality orange band overlay (if `reason === 'timeline_pattern' | 'both'`) — `dropoff_segment_indices` from `isAntiViralityGatedFull()` → x-range fill in `--color-warning` over the band.
  4. Y gridlines (4 horizontal, `rgba(255,255,255,0.04)`).
  5. Y-axis labels (0/25/50/75/100, 10px monospace).
  6. Gradient fill under curve (`createLinearGradient` top→bottom).
  7. Curve stroke (2px coral).
  8. Dropoff markers (canvas `arc` for the 8px dot, then `arc` for the 2px ring).
- Morph animation: shared RAF loop. Stash `baselineCurve[]`, `targetCurve[]`, `progress: 0→1`, `current[i] = lerp(baseline[i], target[i], progress)`. Easing = `easeOutCubic`. Single RAF loop drives morph + marker fade-in + (during weight drag) re-renders on new `weights`.
- Cancel RAF on unmount. Re-init on `containerWidth` resize via `ResizeObserver`.
- ARIA: `role="img" aria-label="Audience retention curve. Weighted average: {N}% watch time"`.

### 4.5 — DropoffMarkers (rendered inside RetentionCurve canvas)

- NOT a separate React component — pure canvas draw functions in `DropoffMarkers.ts`. Called from RetentionCurve's RAF.
- Cluster pass: O(N²) for ≤10 markers — negligible cost. Walk sorted-by-x positions; if next marker within 6px (≥2) or 12px (≥3) of cluster centroid, merge into cluster. Returns `Marker[] | Cluster[]` for the renderer.
- Hit-test: pure function `findMarkerAtPoint(markers, x, y, hitRadius=22)` → `Marker | Cluster | null`. Called from canvas `pointerdown` handler.
- Fade-in: each marker's `opacity = clamp(easeOutCubic(t * 1.2), 0, 1)` where `t` is morph progress (so the early markers reach opacity=1 before morph completes — staggered natural feel).
- Reduced-motion: instant opacity=1 on `complete`.

### 4.6 — HeatmapDrawer + PersonaRow

- CSS Grid 10 rows × N columns. `grid-template-columns: repeat(N, minmax(12px, 1fr))` weighted by segment duration via inline `grid-template-columns` string built from segments.
- Row height 32px mobile / 36px desktop.
- Cell `background-color: rgba(255,127,80, ${clamp(attention, 0.05, 0.80)})`.
- Skeleton rows pre-render at `wave_0_complete` (segments known) in fixed archetype order per D-05. Order resolution: read `persona_registry.ts` for the canonical slot order, OR — simpler — accept the fixed order `['fyp','fyp','fyp','fyp','fyp','fyp','niche','niche','loyalist','cross_niche']` as a constant in `audience-constants.ts`. Match incoming `pass2_persona_start.archetype` against this slot order.
- L→R cell fill wave per row: when persona's `attentions` start streaming (`pass2_status === 'streaming'` with `attentions` populated) OR full (`pass2_status === 'complete'`), apply `transition: background-color 180ms linear; transition-delay: ${idx * 18}ms` per cell. **Note:** per O-2 the fade-fill happens cell-by-cell as values arrive — but in practice `attentions[]` arrives all at once on `pass2_persona_end` (Phase 3 packed the full array into the end event). The L→R wave is therefore an animation primitive driven by CSS transition + per-cell stagger, not by per-value streaming. **Honest finding:** per-cell streaming is not currently supported by the backend — values land atomically per persona. Plan should treat O-2 as "row reveals with L→R wave once `attentions[]` arrives" — visually identical, simpler implementation.
- Swipe markers: 1px white vertical tick at column matching `swipe_predicted_at` segment index.
- Hook zone column highlight: `background: rgba(255,127,80,0.04)` on `[is_hook_zone=true]` columns via `:nth-child` selectors or column data attributes.
- Color-blind mode: CSS class swap (`.heatmap-pattern-cb`) toggles a `background-image: repeating-linear-gradient(45deg, transparent 0 2px, rgba(255,255,255,0.15) 2px 4px)` overlay with `mask-image` opacity proportional to attention.
- Drawer mechanics: desktop = inline expansion (CSS Grid `grid-template-rows: 0fr → 1fr` transition); mobile = Radix Sheet bottom-sheet. Use existing `src/components/ui/sheet.tsx`. Detection via `useIsMobile()` hook (existing).
- ARIA: `role="grid" aria-rowcount aria-colcount`, rows `role="row"`, cells `role="gridcell" aria-label="{pct}% attention at segment N, {t_start}s to {t_end}s{reason if present}"`.
- Keyboard: arrow keys navigate grid, Enter opens popover, Shift+Enter opens inspector.

### 4.7 — Streaming choreography (hook)

`use-audience-choreography.ts` — pure orchestration over `useAnalysisStream()`:

- Inputs: `stream.partial.personas`, `stream.stages`, `stream.result`, `stream.phase`, `reducedMotion`, `perfTier`.
- Outputs: per-row choreography state `Record<personaId, RowState>` where `RowState = 'skeleton' | 'streaming' | 'filling' | 'complete'`, curve state `'idle' | 'baseline' | 'morphing' | 'final'`, anti-virality state.
- Timing rules (per CONTEXT.md + UI-SPEC):
  - `wave_0_complete` (derived from `stages.find(s => s.stage === 'wave_0_segmentation' && s.type === 'stage_end')`): emit skeleton rows in fixed archetype order.
  - `pass2_persona_start` event in stages → row → `'streaming'` (label becomes readable, opacity 0.4→1).
  - `pass2_persona_end` event → row → `'filling'` (L→R wave for 180ms) → `'complete'`. Swipe marker on curve syncs to last cell fill (set a 162ms timer after row enters `'filling'`).
  - `phase === 'complete' && result.persona_behavioral_aggregate` → curve → `'baseline'`, run 300ms morph from empty/0 to baseline.
  - `result.heatmap !== null` → curve → `'morphing'` from baseline to `result.heatmap.weighted_curve`, 800ms. Markers fade in during this window.
- Per O-3: curve does NOT update per persona — only on `result.heatmap` arrival.
- Per-tier degradation: low = skip morph (jump to weighted final), skip L→R wave (jump cells to full saturation); medium = halve wave to 90ms; reduced-motion = jump-cuts + 150ms opacity-only transitions.
- aria-live announcements via `src/lib/a11y.ts` `announce()` helper.

### 4.8 — Tap interactions (TapPopover + PersonaInspector)

- `TapPopover.tsx`: wraps Radix Popover (`src/components/ui/popover.tsx`). Renders in portal. Content variant chosen by `kind: 'cell' | 'marker' | 'cluster' | 'curve-point' | 'fix-chip'`. GlassPanel-styled.
- Curve-point variant: tap at canvas (x, y) → find nearest data point index → popover shows weighted attention at t + list of 3 contributing personas (sorted by their attention at t) + filmstrip frame highlight (border flash on the filmstrip cell for 600ms via React state).
- `PersonaInspector.tsx`: Radix Sheet (`src/components/ui/sheet.tsx`) — desktop right-side panel, mobile bottom sheet. Detection via `useIsMobile()`.
- Content: archetype tag, persona name, audience-share weight label, Pass 1 verdict + confidence, swipe context, segment_reasons timeline list, attention sparkline (mini canvas, 48px tall), "Jump to segment →" link triggers camera pan via `useBoardStore.setActivePreset('audience')`.
- **Plan 4.9 collapses into 4.8** per UI-SPEC §PersonaInspector "Plan 4.9 fate" + D-14. Inline expand deprecated — inspector absorbs the role. No separate file.
- Focus-trap inside Sheet (Radix handles automatically). Return focus to trigger element on close.

### 4.10 — Anti-virality visual treatment

- `AntiViralityOverlay.tsx`: conditional render based on `isAntiViralityGatedFull(result.confidence, result.heatmap)`.
- `reason === 'confidence' | 'both'` + no timeline pattern → border treatment on AudienceNode outer (`--color-warning` 1px) + header warning dot. No per-segment chips.
- `reason === 'timeline_pattern' | 'both'` → fix-chips below filmstrip in `dropoff_segment_indices`. Curve orange band rendered inside RetentionCurve canvas (passed in via prop). NO heatmap cell tinting (D-15).
- Fix chip text: counterfactual-anchored — joins `result.counterfactuals` (or equivalent — researcher must verify exact field on `PredictionResult`) to `dropoff_segment_indices` by timestamp proximity. **Open question 2:** exact server field carrying the 1-line fix summaries — `counterfactuals` is the historical name; verify Phase 5 doesn't rename or reshape.
- Tap chip → TapPopover (kind='fix-chip') with full fix text + "See all fixes in Verdict →" link → `setActivePreset('verdict')`.
- Anti-virality transition: animates in 400ms / out 200ms during slider drag (D-20).

### 4.11 — Weight override (WeightOverrideDrawer + client recompute hook)

- `WeightOverrideDrawer.tsx`: Radix Sheet — desktop right panel 320px, mobile bottom sheet max-height 70dvh.
- Preset chips: 4 presets + Custom. Tap preset → slider values update.
- Sliders: existing `src/components/ui/badge.tsx` not relevant — use existing Radix Slider primitive (verify install). UI-SPEC notes existing shadcn `Slider` is installed.
- Auto-renormalize: proportional. When slider A changes by Δ, distribute -Δ across remaining 3 sliders proportional to their current values. Implementation:
  ```ts
  function rebalance(w: PersonaWeights, changedKey: keyof PersonaWeights, newValue: number): PersonaWeights {
    const oldValue = w[changedKey];
    const delta = newValue - oldValue;
    const others = (Object.keys(w) as Array<keyof PersonaWeights>).filter(k => k !== changedKey);
    const otherSum = others.reduce((s, k) => s + w[k], 0);
    if (otherSum === 0) return { ...w, [changedKey]: newValue };
    const next = { ...w, [changedKey]: newValue };
    for (const k of others) next[k] = Math.max(0, w[k] - delta * (w[k] / otherSum));
    return normalizeWeights(next);  // belt-and-suspenders normalize after
  }
  ```
- `use-client-weights.ts`: 16ms RAF debounce. On weight change, recompute `weighted_curve` + headline metrics + anti-virality trigger. Output drives RetentionCurve + HeadlineChips + AntiViralityOverlay re-renders.
- Persistence (D-21, D-22):
  - "Apply Audience Mix" → POST `/api/analyze/[id]/override` (new endpoint, plan must define) writing to `analysis_results.analysis_override` JSONB column (column does NOT yet exist — see Open Question 3).
  - "Save as my default" checkbox → on Apply, additionally writes/upserts to new `creator_persona_weights` table.
  - "Reset to defaults" → restores to engine default 65/20/10/5 + inline toast with [Undo] (4s timer per UI-SPEC §Destructive Actions).
  - Drawer close without Apply with dirty values → inline confirmation toast.

**DB migrations needed (Phase 4 ships):**
```sql
-- supabase/migrations/<ts>_audience_overrides.sql
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS analysis_override JSONB;
CREATE TABLE IF NOT EXISTS creator_persona_weights (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fyp NUMERIC(5,4) NOT NULL DEFAULT 0.65,
  niche NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  loyalist NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  cross_niche NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE creator_persona_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY cpw_select_own ON creator_persona_weights FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY cpw_upsert_own ON creator_persona_weights FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 4.12 — Mobile portrait optimization

- Same world coordinates as desktop (D-04). Only render adaptations.
- HeatmapDrawer: bottom-sheet variant via Radix Sheet (already in 4.6).
- PersonaInspector: bottom-sheet variant (already in 4.8).
- WeightOverrideDrawer: bottom-sheet variant (already in 4.11).
- Pinch-zoom on heatmap: native CSS `touch-action: pinch-zoom` on the grid container. Konva pan must not capture multi-touch within the grid bounds — use `e.stopPropagation()` on `touchstart` inside the heatmap to prevent Konva drag.
- Tap-row-expand: row label tap opens PersonaInspector (same as desktop). NO inline expansion (D-14).
- Compact curve: same canvas, smaller container — DPR-aware code re-fits automatically.
- Filmstrip horizontal scroll: native overflow-x with scroll snap on segment boundaries.

---

## Streaming Choreography (event flow, animation budget)

### Event timeline (typical Pass 2 stream)

```
t=0       SSE event: stage_start { stage: 'wave_0_segmentation' }
t=2000    SSE event: stage_end { stage: 'wave_0_segmentation' }  ← segments known
                                                                  Choreography: emit skeleton rows
                                                                  (fixed archetype order, 10 rows)
t=2100    SSE event: pass2_persona_start { persona_id: 'fyp_1', archetype: 'high_engager' }
                                                                  Row[fyp_1] label opacity 0.4 → 1 (150ms)
t=2200    SSE event: pass2_persona_start { persona_id: 'fyp_2', ... }
                                                                  (similar)
t=...     (10 personas start in parallel)
t=6500    SSE event: pass2_persona_end { persona_id: 'fyp_1', attentions: [...], swipe_predicted_at: 4.2 }
                                                                  Row[fyp_1] L→R wave (180ms total)
                                                                  At t=6500+162ms: marker drops on curve baseline
t=...     (10 personas end at varying times, 4-8s after start)
t=11500   SSE event: complete { result: {..., heatmap, weighted_curve, ...} }
                                                                  Curve baseline → weighted morph (800ms)
                                                                  All markers fade in (during 800ms window)
                                                                  Anti-virality state evaluated (dual-trigger)
t=12300   Animation complete — full Audience node visible
```

### Per-row animation budget

| Phase | Duration | Animation primitive | Notes |
|-------|----------|---------------------|-------|
| Skeleton appearance | 0ms | CSS opacity (instant on segments known) | Renders all 10 rows synchronously when wave 0 ends |
| Row label fade-in (per row) | 150ms | CSS opacity transition | Triggered by `pass2_persona_start` event |
| L→R cell wave (per row) | 180ms (18ms × 10 segs) | CSS transition-delay stagger | Halve to 90ms on medium tier. Skip on low tier. |
| Curve baseline render | 300ms | RAF lerp | On `complete` SSE event, before heatmap arrives |
| Curve morph to weighted | 800ms | RAF lerp + easeOutCubic | On `result.heatmap` non-null. Single morph. Skip on low. |
| Marker fade-in (concurrent) | 800ms | Canvas opacity per marker | Staggered easeOutCubic(t*1.2) |
| Anti-virality enter | 400ms | Canvas gradient color shift + DOM chip fade | Triggered when `isAntiViralityGatedFull().gated === true` |

**Total reveal: 3–5s post-Wave-3-complete** per CONTEXT.md success criteria. Verified achievable: 10 personas × ~5s Pass 2 latency (parallel) + 800ms morph = ~5.8s worst-case from `wave_3_personas` start to fully-animated.

### RAF strategy

- **Single shared RAF loop** lives inside RetentionCurve's `use-retention-curve-canvas.ts` hook. Drives curve morph + marker fade + (during slider drag) curve recompute.
- Heatmap row L→R wave uses **CSS transitions, not RAF** — browser compositor handles cell opacity changes off the main thread.
- Filmstrip keyframe swap uses **CSS opacity transition, not RAF**.
- Cancel RAF on unmount + on `prefers-reduced-motion` change.

---

## Performance Budget (60fps strategy, fallback path)

### High tier (iPhone 13+, modern Android, desktop)

Target: 60fps sustained during streaming + during weight slider drag.

| Surface | Frame cost (est.) | Strategy |
|---------|-------------------|----------|
| Curve canvas RAF | ~2ms per frame (clear + draw 50 points + gradient) | DPR-aware, single canvas |
| Heatmap cell transitions | ~0.5ms per row (CSS, compositor) | 10 rows × parallel = effectively free |
| Marker hit-test | <0.1ms (linear scan ≤10 markers) | Pure function |
| Slider drag recompute | ~1ms per RAF tick | Pure math, no DOM mutation in callback |

Total ≤4ms per frame — well under 16ms budget.

### Medium tier (iPhone 11–12)

- L→R wave duration halved to 90ms (UI-SPEC Motion Budget).
- Curve morph kept at 800ms but reduce data point density on curves with >40 segments (downsample to 40 control points).

### Low tier (older / thermal-throttled)

- Skip curve morph — jump-cut to weighted curve on `complete`.
- Skip L→R wave — cells appear at full saturation on `pass2_persona_end`.
- Marker fade-in becomes 150ms opacity-only.
- Anti-virality transitions instant.

### Runtime FPS fallback (already shipped Phase 2)

`startFpsSampler` in `src/lib/perf-tier.ts` lines 62–91 [VERIFIED] auto-drops tier if sustained <40fps for 3s. Audience node subscribes to `usePerfStore(s => s.tier)` — no additional FPS monitoring needed in Phase 4.

### Bundle size guardrails

- **No d3 dependency added.** Catmull-Rom hand-rolled.
- **No new animation library added.** Reuse `motion/react` (already installed v12.29.2 [VERIFIED: package.json]) only for popover/sheet entry animations if Radix's built-in animations are insufficient.
- **Slider:** reuse existing Radix Slider (verify install — UI-SPEC declares `Slider` from existing shadcn install).

---

## Mobile Portrait + Reduced Motion

### Mobile portrait

Detection: `useIsMobile()` (existing at `src/hooks/useIsMobile.ts`, 768px breakpoint).

Per D-04 + UI-SPEC §AudienceNode mobile rules:
- Heatmap drawer → bottom-sheet (Radix Sheet, slide-up).
- PersonaInspector → bottom-sheet.
- WeightOverrideDrawer → bottom-sheet (max-height 70dvh).
- TapPopover → repositions to avoid edge clipping (Radix auto-handles via collision detection).
- Filmstrip → horizontal scroll, snap to segment boundaries.
- Pinch-zoom on heatmap → native CSS `touch-action: pinch-zoom`. `e.stopPropagation()` on touchstart to prevent Konva pan from competing.

iOS Safari momentum-scroll vs. Konva pan: the heatmap drawer (bottom-sheet) renders in a Radix portal **outside** the Konva Stage — no event collision risk for the deep-read path. Inline heatmap (desktop) is in the DOM overlay above Konva, with `pointer-events: auto` on the grid, isolating it from board pan.

### Reduced-motion

`usePrefersReducedMotion()` hook (existing at `src/hooks/usePrefersReducedMotion.ts` [VERIFIED]) returns true when user prefers reduced motion OR perf tier is `low` (per `effectiveReducedMotion` pattern in `Board.tsx` line 65).

UI-SPEC §ReducedMotionFallback table is authoritative. Key impacts:
- All RAF morph animations → jump-cuts.
- L→R cell waves → instant full saturation.
- Marker fade-in → 150ms opacity.
- Heatmap drawer open → no `grid-template-rows` transition.
- Popover/sheet slide → 150ms opacity only (no translate).

aria-live announcements remain — accessibility is independent of motion preference.

---

## Anti-virality Treatment

Per D-15 / D-16 / D-17 + UI-SPEC §AntiViralityOverlay:

### Trigger evaluation (client-side, pure)

```ts
import { isAntiViralityGatedFull } from '@/lib/engine/anti-virality';
const { gated, reason, dropoff_segment_indices } = isAntiViralityGatedFull(
  currentConfidence,    // = result.confidence (during normal render)
                        // OR recomputed during weight drag (open question 4)
  currentHeatmap,       // = { ...result.heatmap, weighted_curve: clientRecomputed }
);
```

**Open question 4:** does `confidence` itself shift during weight override? The Phase 3 confidence aggregator may or may not depend on weighted aggregate. Recommended: confidence is INVARIANT across weight overrides for Phase 4 — only `weighted_curve` recomputes. Confirm with planner.

### Visual variants

| Condition | Audience treatment |
|-----------|--------------------|
| `gated === false` | Standard render — no orange, no border treatment |
| `reason === 'confidence'` (no timeline pattern) | Border on AudienceNode outer = `--color-warning` 1px. Header dot. No per-segment chips. Heatmap cells stay coral. |
| `reason === 'timeline_pattern'` | Curve gradient transitions coral→`--color-warning` over `dropoff_segment_indices` x-range. ⚠ fix-chips below filmstrip in those segments. Heatmap cells stay coral (D-15 lock). |
| `reason === 'both'` | Same as timeline_pattern + AudienceNode outer border treatment (additive). |

### Fix chip content

- Source: top 3 segments from `dropoff_segment_indices` (Phase 3 already returns these).
- Text: 1-line fix summary from `result.counterfactuals` (or whichever field carries Phase 3 fix text — open question 2). Joined by timestamp proximity.
- Chip styling per UI-SPEC: 11px, `--color-warning` border, `--color-surface-elevated` fill, 4px radius.
- Tap → TapPopover (kind='fix-chip') with full fix text + "See all fixes in Verdict →" link.

### Cross-group ripple (Phase 2 D-19, R1.9)

Anti-virality is a board-level state — when triggered, Verdict + Audience + Actions all coordinate. Phase 2 already routes this via `useBoardStore.boardState === 'anti-virality'`. Phase 4 Audience subscribes to this state for header treatment, but the per-segment orange + fix-chips are driven by `isAntiViralityGatedFull()` result (more granular than the board state).

---

## Existing Patterns to Reuse (files + symbols)

| Pattern | File | Symbol(s) |
|---------|------|-----------|
| Konva + DOM overlay node | `src/components/board/Node.tsx` + `NodeOverlay.tsx` | `Node`, `NodeOverlay` |
| GroupFrame + body slot | `src/components/board/GroupFrameOverlay.tsx` | `GroupFrameOverlay` (renders `children` in body) |
| Board state machine | `src/stores/board-store.ts` | `useBoardStore`, `BoardMachineState`, `selectIsAntiVirality` |
| SSE consumer | `src/hooks/queries/use-analysis-stream.ts` | `useAnalysisStream`, `PerPersonaPartial` |
| Camera pan to preset | `src/components/board/use-camera.ts` | `useCamera`, `goToPreset` (via `setActivePreset`) |
| Reduced-motion | `src/hooks/usePrefersReducedMotion.ts` | `usePrefersReducedMotion` |
| Mobile detection | `src/hooks/useIsMobile.ts` | `useIsMobile` (768px breakpoint) |
| Perf tier | `src/lib/perf-tier.ts` | `usePerfStore`, `nextLowerTier`, `startFpsSampler` |
| RAF + Canvas DPR | `src/components/hive-demo/hive-demo-canvas.tsx` | Lines 41–149 — verbatim DPR pattern |
| aria-live announce | `src/lib/a11y.ts` | `announce(politeness, text)` + `useRovingTabIndex` |
| GlassPanel container | `src/components/primitives/GlassPanel.tsx` | `GlassPanel` (12px radius, blur(5px), Raycast gradient) |
| Radix Popover | `src/components/ui/popover.tsx` | `Popover`, `PopoverContent` (portal + collision detection) |
| Radix Sheet (bottom/side) | `src/components/ui/sheet.tsx` | `Sheet`, `SheetContent`, `SheetClose` |
| Existing Slider (shadcn) | declared in UI-SPEC Registry Safety | Existing shadcn `Slider` |
| Skeleton (streaming) | `src/components/ui/skeleton.tsx` | `Skeleton` |
| Phase 3 weighted aggregator | `src/lib/engine/wave3/weighted-aggregator.ts` | `buildWeightedCurve`, `assembleHeatmapPayload`, `SUCCESS_THRESHOLD = 7` |
| Phase 3 anti-virality | `src/lib/engine/anti-virality.ts` | `isAntiViralityGatedFull`, `topDropoffSegmentIndices`, `isTimelinePatternTriggered` |
| Phase 3 persona-weights | `src/lib/engine/persona-weights.ts` | `resolveWeights`, `normalizeWeights`, `DEFAULT_PERSONA_WEIGHT_CONFIG`, `PersonaWeights` type |
| HeatmapPayload type | `src/lib/engine/types.ts` lines 27–50 | `HeatmapPayload` |
| Filmstrip storage | `src/lib/engine/filmstrip/storage.ts` | Server-only — Phase 4 consumes signed URLs via SSE only |
| Stage events | `src/lib/engine/events.ts` | `StageEvent`, `pass2_persona_start`, `pass2_persona_end`, `filmstrip_segment_ready` |

---

## Open Questions for Planner (RESOLVED)

1. **`HeatmapPayload.personas[].slot_type` field missing for client-side recompute.** Need to add `slot_type: 'fyp' | 'niche' | 'loyalist' | 'cross_niche'` to `HeatmapPayload.personas[]` schema (additive, backwards-compatible). Phase 4 schema amendment — server-side `assembleHeatmapPayload()` already has this info on `Pass2PersonaResult.slot_type`, just needs to be carried through. **Recommendation:** ship as part of Plan 4.11 prep — extend `assembleHeatmapPayload()` + `HeatmapPayload` type + add a server test. — **RESOLVED: Plan 04-02 Task 1.**

2. **Exact field name carrying 1-line fix summaries on `PredictionResult`.** UI-SPEC and CONTEXT both reference "counterfactuals" generically. Verify the Phase 3 / Stage 11 counterfactual mapper output field — is it `result.counterfactuals[].fix_summary`, `result.suggestions[]`, or new? Planner should resolve before Plan 4.10 starts. — **RESOLVED: Plan 04-10 Task 1 (graceful null fallback + executor verifies field name at execution via grep `src/lib/engine/types.ts`).**

3. **`analyses.analysis_override` JSONB column does not yet exist.** Per CONTEXT.md `<canonical_refs>` line 217 + D-22, "DB: existing `analyses.analysis_override` JSON column (Phase 3 D-20)" — but a grep of `supabase/migrations/*.sql` finds zero references. Either the column lives in an unreviewed migration or it was deferred. **Phase 4 must ship the migration** (recommended SQL in §4.11 above). Confirm Phase 3 didn't already ship and verify. — **RESOLVED: Plan 04-01 Task 3 (ships migration `20260527000000_audience_overrides.sql`) + Plan 04-11 (BLOCKING `supabase db push --linked`).**

4. **`confidence` invariance under client weight override.** During slider drag, does the anti-virality dual-trigger re-evaluate `confidence` too, or only `weighted_curve` (which drives `isTimelinePatternTriggered`)? Recommendation: confidence is invariant — only the timeline-pattern trigger re-evaluates. Document this in plan 4.11 + write a test. — **RESOLVED: Plan 04-09 Task 1 (invariance test in `use-client-weights.test.ts`).**

5. **`filmstrip_segment_ready` SSE event not currently dispatched in `useAnalysisStream`.** Dispatch table at `src/hooks/queries/use-analysis-stream.ts` lines 153–225 handles `pass2_persona_start` + `pass2_persona_end` but not `filmstrip_segment_ready`. Phase 4 must either (a) extend `dispatch()` and add a `filmstrips: Record<number, string>` to the return shape (10th key), or (b) ship a sibling hook `useFilmstripKeyframes()` that opens a second EventSource. **(a) is preferred** — additive, single source of truth, no extra connection. — **RESOLVED: Plan 04-03 (option (a) — extend dispatch + add `filmstrips` to return shape).**

6. **Persona row reveal order resolution.** D-05 locks fixed archetype hierarchy (FYP×6 → niche×2 → loyalist×1 → cross_niche×1) but the `pass2_persona_start` event carries `archetype`, not `slot_type`. The 6 FYP personas have 5 distinct archetypes (high_engager, saver, lurker, sharer, viewer). Plan must define the deterministic ordering inside the FYP slot (e.g., alphabetical by persona_id, or by archetype order high_engager → saver → lurker → sharer → viewer → high_engager-2). Recommendation: pre-populate skeleton slots from `persona_registry.ts` canonical order, then match incoming `persona_id` to slot. — **RESOLVED: Plan 04-02 (`PERSONA_SLOT_ORDER` constant) + Plan 04-04 (`ARCHETYPE_TO_SLOT` map drives skeleton hydration).**

7. **Cluster-collapse thresholds tuning (D-12).** Starting values 12px/3 + 6px/2 are reasonable but need empirical validation. **Defer to fixture playback in plan 4.5** — no research needed before execution. — **RESOLVED: Plan 04-06 Task 1 (deferred in-place; thresholds tunable via constants + fixture-driven empirical playback).**

8. **Hand-rolled Catmull-Rom acceptance criteria.** ≤25 LOC is the bias. If implementation exceeds 40 LOC or fails edge cases (1-point curve, 2-point curve, NaN-safe), fall back to d3-shape import — acceptable bundle hit for correctness. — **RESOLVED: Plan 04-06 Task 2 acceptance criteria (LOC ceiling + edge-case tests + d3-shape fallback path documented).**

9. **`/api/analyze/[id]/override` route does not exist.** Plan 4.11 must spec the new API route (POST { weights }, writes to `analysis_results.analysis_override` JSONB). Auth: cookie-based via Supabase (existing pattern). RLS: only owner can update. — **RESOLVED: Plan 04-09 Task 3 (`src/app/api/analyze/[id]/override/route.ts` with Zod schema + Supabase cookie auth + RLS owner check).**

10. **Custom drawer "Custom…" preset detection.** When current weights match no preset exactly, show "Custom…" highlighted. Tolerance for "matches preset" — exact equality after rounding to integer percents? Recommendation: 0.5% epsilon on each weight. — **RESOLVED: Plan 04-02 (`WEIGHT_PRESET_EPSILON = 0.005`) + Plan 04-09 (`weightsEqual()` consumer).**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `react` | All | ✓ | 19.2.3 | — |
| `react-konva` | Audience node frame | ✓ | 19.2.4 | — |
| `konva` | Audience node frame | ✓ | 10.3.0 | — |
| `next` | All | ✓ | 16.1.5 | — |
| `radix-ui` | Popover / Sheet / Dialog | ✓ | 1.4.3 | — |
| `@phosphor-icons/react` | Icons | ✓ | 2.1.10 | — |
| `zustand` | Store | ✓ | 5.0.10 | — |
| `motion` | Sheet/popover animations (optional) | ✓ | 12.29.2 | Reuse Radix built-in animations |
| `tailwindcss` | Styling | ✓ | 4.x | — |
| `vitest` | Tests | ✓ | 4.0.18 | — |
| `vitest-axe` | a11y tests | ✓ | 0.1.0 | — |
| `@pmndrs/detect-gpu` | Perf tier detection | ✓ | (Phase 2 shipped) | — |
| `d3-shape` | Catmull-Rom (optional) | ✗ | — | Hand-roll (recommendation) |
| `supabase` (CLI) | Migration apply | ✓ | 2.74.5 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** `d3-shape` — fallback is hand-rolled Catmull-Rom (preferred path).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + vitest-axe 0.1.0 |
| Config file | `vitest.config.ts` (verified at repo root) |
| Quick run command | `npm test -- src/components/board/audience/__tests__/<file>.test.tsx -t "<name>"` |
| Full suite command | `npm test` (alias: `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| R1.2 | AudienceNode renders all 5 chips against fixture | unit | `npm test -- HeadlineChips.test.tsx` | ❌ Wave 0 |
| R1.2 | Filmstrip swaps placeholder → img on `filmstrip_segment_ready` | unit | `npm test -- Filmstrip.test.tsx` | ❌ Wave 0 |
| R1.2 | RetentionCurve renders weighted_curve from fixture, DPR-aware | unit | `npm test -- RetentionCurve.test.tsx` | ❌ Wave 0 |
| R1.2 | DropoffMarkers cluster collapse at 12px / 6px thresholds | unit (pure fn) | `npm test -- DropoffMarkers.test.ts` | ❌ Wave 0 |
| R1.2 | HeatmapDrawer renders 10 × N grid, attention-proportional fills | unit | `npm test -- HeatmapDrawer.test.tsx` | ❌ Wave 0 |
| R1.2 | Choreography skeleton order = fixed archetype hierarchy | unit (hook) | `npm test -- use-audience-choreography.test.ts` | ❌ Wave 0 |
| R1.2 | TapPopover positions at tap coordinate, escape-dismisses | integration | `npm test -- TapPopover.test.tsx` | ❌ Wave 0 |
| R1.2 | PersonaInspector opens on row-label tap (bottom-sheet mobile) | integration | `npm test -- PersonaInspector.test.tsx` | ❌ Wave 0 |
| R1.2 | Anti-virality dual-trigger drives correct visual variant | unit | `npm test -- AntiViralityOverlay.test.tsx` | ❌ Wave 0 |
| R1.2 | Mobile portrait: heatmap drawer opens bottom-sheet | integration | `npm test -- HeatmapDrawer.mobile.test.tsx` | ❌ Wave 0 |
| R1.2 | Reduced-motion: jump-cut to weighted curve, no morph | integration | `npm test -- RetentionCurve.reduced-motion.test.tsx` | ❌ Wave 0 |
| R2.2 | Pass 2 streaming partials drive row state transitions | unit (hook) | `npm test -- use-audience-choreography.streaming.test.ts` | ❌ Wave 0 |
| R2.3 | Client weight recompute matches server `buildWeightedCurve` | unit (pure fn) | `npm test -- use-client-weights.test.ts` | ❌ Wave 0 |
| R2.3 | Slider drag rebalance maintains sum=1.0 ±epsilon | unit (pure fn) | `npm test -- weight-rebalance.test.ts` | ❌ Wave 0 |
| R1.2 (a11y) | Heatmap grid passes axe-core with role=grid + aria-rowcount | a11y | `npm test -- HeatmapDrawer.a11y.test.tsx` | ❌ Wave 0 |
| R1.2 (a11y) | TapPopover focus-traps and returns focus on close | a11y | `npm test -- TapPopover.a11y.test.tsx` | ❌ Wave 0 |
| R1.2 (perf) | Curve morph completes ≤900ms on high tier (mocked RAF) | perf | `npm test -- RetentionCurve.perf.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/components/board/audience/__tests__/<changed>.test.tsx -t "<scenario>"` (single file, <5s)
- **Per wave merge:** `npm test -- src/components/board/audience` (all audience tests, ~30s)
- **Phase gate:** `npm test` (full suite, ~2-3 min) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/board/audience/__tests__/HeadlineChips.test.tsx`
- [ ] `src/components/board/audience/__tests__/Filmstrip.test.tsx`
- [ ] `src/components/board/audience/__tests__/RetentionCurve.test.tsx`
- [ ] `src/components/board/audience/__tests__/DropoffMarkers.test.ts`
- [ ] `src/components/board/audience/__tests__/HeatmapDrawer.test.tsx`
- [ ] `src/components/board/audience/__tests__/PersonaRow.test.tsx`
- [ ] `src/components/board/audience/__tests__/use-audience-choreography.test.ts`
- [ ] `src/components/board/audience/__tests__/TapPopover.test.tsx`
- [ ] `src/components/board/audience/__tests__/PersonaInspector.test.tsx`
- [ ] `src/components/board/audience/__tests__/WeightOverrideDrawer.test.tsx`
- [ ] `src/components/board/audience/__tests__/AntiViralityOverlay.test.tsx`
- [ ] `src/components/board/audience/__tests__/use-client-weights.test.ts`
- [ ] `src/components/board/audience/__tests__/fixtures/heatmap-fixture.ts` — canonical `HeatmapPayload` for tests
- [ ] `src/components/board/audience/__tests__/fixtures/streaming-fixture.ts` — sequence of `StageEvent` to feed `useAnalysisStream` mock
- [ ] `src/lib/engine/wave3/__tests__/weighted-aggregator-client.test.ts` — confirms client recompute matches server `buildWeightedCurve` byte-for-byte

### Smoke/E2E (defer to Phase 8)

- Playwright board-level integration: full Pass 2 stream → row reveal → curve morph → anti-virality. Recommend stubbing the engine SSE in CI fixtures.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing Supabase cookie auth (no Phase 4 change) |
| V3 Session Management | no | Phase 4 surfaces only — no session changes |
| V4 Access Control | yes | RLS on new `creator_persona_weights` table (owner-scoped); `analysis_results.analysis_override` write gated by existing analyses RLS |
| V5 Input Validation | yes | Weight override JSON: server validates 0 ≤ each ≤ 1, sum ∈ [0.99, 1.01]. Use Zod schema in `/api/analyze/[id]/override`. |
| V6 Cryptography | no | No new crypto |
| V7 Error Handling | yes | Client recompute failures → "Could not recalculate — using last saved weights" (UI-SPEC copy) |

### Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Weight override XSS in JSONB | Tampering | Server Zod schema; never reflect user-supplied weight strings in HTML; render numeric only |
| `analysis_id` IDOR in override endpoint | Information disclosure / Elevation | RLS policy on `analysis_results` (existing) — `auth.uid() = user_id` on UPDATE |
| Reset/Undo race | Tampering | Inline undo toast is local state only — no server write until "Apply" |
| Counterfactual fix-text injection | XSS | Counterfactual text already sanitized server-side in Phase 3 / Stage 11; render as plain text (no `dangerouslySetInnerHTML`) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `motion/react` is already imported elsewhere and can be reused for sheet/popover animation augmentation if Radix built-ins are insufficient | Existing Patterns | None — fallback to Radix native |
| A2 | `slot_type` can be safely added to `HeatmapPayload.personas[]` without breaking existing Phase 3 consumers (Verdict node etc.) | Engine Data Contract | Medium — verify no consumer relies on key shape; likely none since Phase 4 is first consumer |
| A3 | Confidence is invariant under client-side weight override | Anti-virality Treatment | Medium — if Phase 3 confidence partially derives from weighted aggregate, slider drag must re-evaluate confidence too. Confirm with planner. |
| A4 | `analysis_results.analysis_override` JSONB column does not yet exist and Phase 4 ships the migration | Open Questions / 4.11 | High — if column exists in an unmerged Phase 3 migration, duplicate migration will fail. Planner must grep + confirm. |
| A5 | Hand-rolled Catmull-Rom α=0.5 fits in ≤25 LOC including edge cases (1-pt, 2-pt, NaN-safe) | 4.4 RetentionCurve | Low — fall back to d3-shape if it exceeds 40 LOC |
| A6 | Per-cell streaming fill (O-2 verbatim) is not actually supported by current backend; `attentions[]` arrives atomically per persona in the `pass2_persona_end` event | 4.6 HeatmapDrawer | Low — visually identical with CSS transition stagger; intent of O-2 preserved |
| A7 | Phase 5 will own the full top-3 fix list in Verdict; Phase 4 only surfaces inline chips on affected segments | 4.10 AntiViralityOverlay | Low — confirmed in CONTEXT D-16; cross-group ripple |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stacked result card with embedded canvas viz | Konva node-based board with DOM-overlay viz | 2026-05-25 (board model refactor) | Phase 4 builds entirely on Phase 2 substrate |
| Single Pass-1 aggregator output (verdict-only) | Pass-2 per-persona timeline + weighted aggregator + heatmap schema | Phase 3 (shipped) | All audience data shapes locked, no engine work in Phase 4 |
| d3-shape for curve interpolation | Hand-rolled Catmull-Rom in canvas 2D | Phase 4 (this research) | Bundle size win (~248KB d3-shape avoided) + simpler maintenance |

**Deprecated/outdated:**
- Phase 1's `ResultCard` skeleton at `/analyze/[id]` — deprecated by Phase 2 board model.
- Inline persona row expand pattern (plan 4.9 original spec) — collapsed into PersonaInspector per D-14 + UI-SPEC.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/engine/types.ts` lines 20–65, 328–331 [VERIFIED 2026-05-27] — `HeatmapPayload`, `PersonaStreamingPartial`, weighted_* fields on `PredictionResult`.
- `src/lib/engine/wave3/weighted-aggregator.ts` lines 1–222 [VERIFIED] — server `buildWeightedCurve`, `assembleHeatmapPayload`, `Pass2PersonaResult`.
- `src/lib/engine/anti-virality.ts` lines 32–108 [VERIFIED] — `isAntiViralityGatedFull`, `isTimelinePatternTriggered`, `topDropoffSegmentIndices`.
- `src/lib/engine/persona-weights.ts` lines 1–76 [VERIFIED] — `resolveWeights`, `normalizeWeights`, default weights.
- `src/lib/engine/events.ts` lines 1–54 [VERIFIED] — `pass2_persona_start`, `pass2_persona_end`, `filmstrip_segment_ready`.
- `src/hooks/queries/use-analysis-stream.ts` lines 42–225 [VERIFIED] — dispatch table, partial shape, phase machine.
- `src/components/board/NodeOverlay.tsx` lines 17–58 [VERIFIED] — Phase 2 overlay pattern.
- `src/components/board/Node.tsx` [VERIFIED] — Konva frame-only pattern.
- `src/components/board/GroupFrameOverlay.tsx` lines 46–119 [VERIFIED] — group frame body slot.
- `src/components/board/Board.tsx` [VERIFIED] — board composition, group children injection.
- `src/components/board/BoardCanvas.tsx` lines 17–76 [VERIFIED] — Konva Stage + handleDragMove sync.
- `src/stores/board-store.ts` [VERIFIED] — board machine state, anti-virality state.
- `src/lib/perf-tier.ts` lines 1–91 [VERIFIED] — `usePerfStore`, `startFpsSampler`, tier degradation.
- `src/components/hive-demo/hive-demo-canvas.tsx` lines 41–149 [VERIFIED] — DPR-aware RAF canvas pattern.
- `src/components/primitives/GlassPanel.tsx` [VERIFIED] — Raycast glass surface.
- `src/components/ui/popover.tsx`, `sheet.tsx` [VERIFIED] — Radix wrappers with portals.
- `src/hooks/usePrefersReducedMotion.ts` [VERIFIED] — reduced-motion hook.
- `src/hooks/useIsMobile.ts` [VERIFIED] — 768px breakpoint.
- `src/lib/a11y.ts` [VERIFIED] — `useRovingTabIndex`, `announce()` helper.
- `package.json` [VERIFIED] — versions: react 19.2.3, react-konva 19.2.4, konva 10.3.0, next 16.1.5, motion 12.29.2, radix-ui 1.4.3, zustand 5.0.10, tailwind 4.x, vitest 4.0.18, vitest-axe 0.1.0.
- `supabase/migrations/*.sql` [VERIFIED] — confirmed `creator_persona_weights` does NOT yet exist; `analysis_override` JSONB column on `analysis_results` does NOT yet exist either (despite CONTEXT.md reference to "existing").
- `.planning/phases/04-live-audience-node-the-killer-feature/04-CONTEXT.md` [VERIFIED] — all D-01…D-22, O-1…O-6.
- `.planning/phases/04-live-audience-node-the-killer-feature/04-UI-SPEC.md` [VERIFIED] — full component contracts, motion budget, ARIA contracts.
- `.planning/REQUIREMENTS.md` §R1.2, R2.2, R2.3, NF1, NF2 [VERIFIED].
- `.planning/ROADMAP.md` §Phase 4 [VERIFIED].
- `CLAUDE.md` (project root) [VERIFIED] — Raycast design tokens, Tailwind v4 caveats, backdrop-filter inline-style rule.

### Secondary (MEDIUM confidence)

- npm registry: `d3-shape` 3.2.0 published 2022, 248KB unpacked — verified via `npm view d3-shape version` + `npm view d3-shape dist` [CITED: npm registry 2026-05-27].
- WebSearch: d3-shape curveCatmullRom canvas rendering pattern [CITED: d3js.org/d3-shape/curve, 2026].

### Tertiary (LOW confidence)

- None — all critical claims grounded in shipped source code.

---

## Metadata

**Confidence breakdown:**
- Engine data contract: HIGH — all shapes verified from current Phase 3 source.
- Architecture (Konva + DOM overlay): HIGH — Phase 2 patterns shipped and verified.
- Sub-component strategies: HIGH for 4.1–4.10 — UI-SPEC is authoritative; MEDIUM for 4.11 (DB column existence ambiguity — see A4).
- Streaming choreography: HIGH for primitives, MEDIUM for fix-chip text source field (Open Question 2).
- Performance budget: HIGH — Phase 2 perf tier infra shipped and verified.
- Anti-virality: HIGH — Phase 3 pure functions verified.
- Mobile portrait + reduced-motion: HIGH — patterns shipped.

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (30 days — stable surfaces; engine schemas locked).

---

## RESEARCH COMPLETE

Phase 4 Audience node — domain mapped, all 12 sub-components strategized, engine data shapes verified from shipped source, 10 planner open questions surfaced, 3 DB migrations specified, 7 assumptions flagged for confirmation.
