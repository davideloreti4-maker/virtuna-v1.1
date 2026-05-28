# Phase 4: Live Audience Node — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 22 new/modified files (16 source + 4 test fixtures + 1 engine helper + 1 DB migration)
**Analogs found:** 22 / 22

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/components/board/audience/AudienceNode.tsx` | component (shell) | event-driven | `src/components/board/GroupFrameOverlay.tsx` | exact |
| `src/components/board/audience/HeadlineChips.tsx` | component (display) | request-response | `src/components/board/GroupFrameOverlay.tsx` (chip row) | role-match |
| `src/components/board/audience/Filmstrip.tsx` | component (display) | event-driven | `src/components/board/GroupFrameOverlay.tsx` + `use-analysis-stream.ts` dispatch | role-match |
| `src/components/board/audience/RetentionCurve.tsx` | component (canvas) | event-driven + streaming | `src/components/hive-demo/hive-demo-canvas.tsx` | exact |
| `src/components/board/audience/DropoffMarkers.ts` | utility (pure-fn) | transform | `src/lib/engine/anti-virality.ts` (pure-fn pattern) | role-match |
| `src/components/board/audience/HeatmapDrawer.tsx` | component (display) | event-driven | `src/components/board/GroupFrameOverlay.tsx` + `src/components/ui/sheet.tsx` | role-match |
| `src/components/board/audience/PersonaRow.tsx` | component (display) | streaming | `src/components/board/GroupFrameOverlay.tsx` (Skeleton/streaming row) | role-match |
| `src/components/board/audience/TapPopover.tsx` | component (interactive) | request-response | `src/components/ui/popover.tsx` | exact |
| `src/components/board/audience/PersonaInspector.tsx` | component (panel) | request-response | `src/components/ui/sheet.tsx` | exact |
| `src/components/board/audience/WeightOverrideDrawer.tsx` | component (form) | CRUD | `src/components/ui/sheet.tsx` | exact |
| `src/components/board/audience/AntiViralityOverlay.tsx` | component (conditional) | event-driven | `src/lib/engine/anti-virality.ts` (trigger source) | partial |
| `src/components/board/audience/use-audience-choreography.ts` | hook | event-driven | `src/hooks/queries/use-analysis-stream.ts` | exact |
| `src/components/board/audience/use-client-weights.ts` | hook | transform | `src/lib/engine/persona-weights.ts` + `weighted-aggregator.ts` | exact |
| `src/components/board/audience/use-retention-curve-canvas.ts` | hook | streaming | `src/components/hive-demo/hive-demo-canvas.tsx` | exact |
| `src/components/board/audience/audience-constants.ts` | config | — | `src/lib/engine/wave3/weighted-aggregator.ts` (`DEFAULT_WEIGHTS`) | role-match |
| `src/components/board/audience/audience-types.ts` | config (types) | — | `src/lib/engine/types.ts` (`HeatmapPayload`) | exact |
| `src/components/board/audience/__tests__/` (all test files) | test | — | `src/lib/__tests__/perf-tier.test.ts` + `src/lib/engine/__tests__/pipeline.test.ts` | exact |
| `src/components/board/audience/__tests__/fixtures/` | fixture | — | `src/lib/engine/__tests__/pipeline.test.ts` (mock patterns) | role-match |
| `src/lib/engine/wave3/weighted-aggregator-client.ts` | utility (pure-fn) | transform | `src/lib/engine/wave3/weighted-aggregator.ts` | exact |
| `src/hooks/queries/use-analysis-stream.ts` (extend dispatch) | hook (modify) | event-driven | self (add `filmstrip_segment_ready` + `filmstrips` return key) | exact |
| `src/lib/engine/types.ts` (extend `HeatmapPayload.personas[]`) | type (modify) | — | self | exact |
| `supabase/migrations/<ts>_audience_overrides.sql` | migration | CRUD | `supabase/migrations/20260526000000_outcomes_and_filmstrips.sql` | exact |

---

## Pattern Assignments

---

### `AudienceNode.tsx` (component shell, event-driven)

**Analog:** `src/components/board/GroupFrameOverlay.tsx`

**Imports pattern** (lines 1–11):
```typescript
'use client';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Camera, GroupFrameLayout } from './board-types';
import { TITLE_BAR_HEIGHT } from './board-constants';
import type { FrameVisualState } from './GroupFrame';
```

**World → screen projection pattern** (lines 51–54):
```typescript
const screenX = layout.bounds.x * camera.scale + camera.x;
const screenY = layout.bounds.y * camera.scale + camera.y;
const screenW = layout.bounds.width * camera.scale;
const screenH = layout.bounds.height * camera.scale;
```

**DOM overlay placement** (lines 66–73):
```typescript
<div
  role="region"
  aria-label={ARIA_LABEL[layout.id] ?? layout.label}
  tabIndex={tabIndex}
  onFocus={onFocus}
  className="pointer-events-auto absolute focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
  style={{ left: screenX, top: screenY, width: screenW, height: screenH }}
>
```

**NodeOverlay integration** — `src/components/board/NodeOverlay.tsx` (entire file, 59 lines):
```typescript
// World→screen is identical to GroupFrameOverlay but uses spec.bounds (NodeSpec)
const screenX = spec.bounds.x * camera.scale + camera.x;
// ...
<GlassPanel className="flex h-full w-full flex-col overflow-hidden rounded-[8px]">
  {children}
</GlassPanel>
```
AudienceNode feeds a synthetic `NodeSpec` derived from the Audience group frame bounds minus `TITLE_BAR_HEIGHT = 36` (from `board-constants.ts`).

**Board store subscription pattern** (lines 160–192 of `src/stores/board-store.ts`):
```typescript
export type BoardMachineState = 'idle' | 'edit-input' | 'streaming' | 'complete' | 'anti-virality';
// Selectors pattern:
const boardState = useBoardStore(s => s.boardState);
// Transition: complete → anti-virality via triggerAntiVirality()
boardState: s.boardState === 'complete' ? 'anti-virality' : s.boardState,
```

**ARIA pattern for AudienceNode** (UI-SPEC §AudienceNode):
```tsx
<section
  aria-label="Audience analysis"
  aria-live="polite"
  aria-busy={isStreaming}
>
```

---

### `HeadlineChips.tsx` (component display, request-response)

**Analog:** `src/components/board/GroupFrameOverlay.tsx` (Badge + Skeleton chip row pattern)

**Imports to copy:**
```typescript
'use client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
```

**Skeleton shimmer pattern** (GroupFrameOverlay lines 108–110):
```tsx
{showShimmer && (
  <Skeleton className="absolute inset-2 opacity-40" />
)}
```
For HeadlineChips, render 5 `<Skeleton>` blocks at chip dimensions during idle/streaming state.

**Data source fallback helper** — new pure function in `audience-types.ts`:
```typescript
// Pattern mirrors weighted-aggregator.ts DEFAULT_WEIGHTS guard
function pickHeadlineMetric<T>(weighted: T | null | undefined, fallback: T): T {
  return weighted ?? fallback;
}
```

**GlassPanel chip background** (UI-SPEC §HeadlineChips):
```tsx
<div
  className="rounded-[8px] border border-white/[0.06] px-2 py-1"
  style={{ background: 'rgba(255,255,255,0.05)' }}
>
```

**`<dl>` ARIA chip** (UI-SPEC):
```tsx
<div role="term">{label}</div>
<div role="definition">{value}</div>
```

---

### `Filmstrip.tsx` (component display, event-driven)

**Analog primary:** `src/hooks/queries/use-analysis-stream.ts` dispatch table (lines 162–201 — `filmstrip_segment_ready` extension point)
**Analog secondary:** `src/components/board/GroupFrameOverlay.tsx` (body slot pattern)

**Filmstrip keyframe swap pattern** — extend `useAnalysisStream` dispatch (add after line 201 in `use-analysis-stream.ts`):
```typescript
// New 10th key: filmstrips: Record<number, string>
} else if (ev.type === "filmstrip_segment_ready") {
  setFilmstrips((prev) => ({
    ...prev,
    [ev.segment_idx]: ev.keyframe_uri,
  }));
}
```
Return shape addition:
```typescript
filmstrips: filmstrips,  // Record<number, string>
```

**Segment cell proportional width:**
```typescript
const cellWidthPct = (seg.t_end - seg.t_start) / totalDuration * 100;
// style={{ width: `${cellWidthPct}%`, minWidth: '48px' }}
```

**Placeholder-to-image swap animation** (150ms opacity cross-fade per UI-SPEC):
```tsx
<img
  src={keyframe_uri}
  alt={seg.label ?? `Segment ${seg.idx}`}
  style={{ transition: 'opacity 150ms linear' }}
  className={cn(keyframe_uri ? 'opacity-100' : 'opacity-0')}
/>
{/* coral placeholder band behind — always rendered, fades out as img fades in */}
```

**ARIA pattern:**
```tsx
<figure aria-label="Video keyframe filmstrip">
  <div
    aria-label={`Segment ${seg.idx}: ${seg.label ?? ''}, ${seg.t_start}s to ${seg.t_end}s`}
  />
</figure>
```

---

### `RetentionCurve.tsx` + `use-retention-curve-canvas.ts` (component + hook, streaming canvas)

**Analog:** `src/components/hive-demo/hive-demo-canvas.tsx` — verbatim DPR + RAF pattern

**DPR-aware setup** (hive-demo-canvas.tsx lines 52–62):
```typescript
// COPY VERBATIM — from hive-demo-canvas.tsx draw() function
const dpr = window.devicePixelRatio || 1;
const rect = canvas.getBoundingClientRect();
const w = rect.width;
const h = rect.height;

if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
ctx.clearRect(0, 0, w, h);
```
For RetentionCurve, replace the conditional check with a one-time setup via `ResizeObserver` in `use-retention-curve-canvas.ts`, but the `setTransform(dpr, 0, 0, dpr, 0, 0)` call is identical.

**RAF loop + cancel on unmount** (hive-demo-canvas.tsx lines 40–148):
```typescript
const animRef = useRef<number>(0);
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  function draw(timestamp: number) {
    // ...render...
    animRef.current = requestAnimationFrame(draw);
  }

  animRef.current = requestAnimationFrame(draw);
  return () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };
}, []);
```

**Morph lerp pattern** (derived from hive-demo tiered alpha pattern, extended for curve):
```typescript
// In use-retention-curve-canvas.ts — morph state refs
const baselineCurve = useRef<number[]>([]);
const targetCurve = useRef<number[]>([]);
const morphProgress = useRef<number>(1); // 1 = finished
const morphDuration = useRef<number>(800);
const morphStartTime = useRef<number>(0);

// In RAF draw():
const elapsed = timestamp - morphStartTime.current;
const raw = Math.min(elapsed / morphDuration.current, 1);
const t = easeOutCubic(raw); // function easeOutCubic(t) { return 1 - Math.pow(1-t, 3); }
const current = baselineCurve.current.map((b, i) =>
  b + (targetCurve.current[i]! - b) * t
);
```

**Canvas render order** (UI-SPEC §RetentionCurve + D-08):
```typescript
// 1. Clear
ctx.clearRect(0, 0, w, h);
// 2. Hook zone warm band (0–3s x range)
ctx.fillStyle = 'rgba(255,127,80,0.08)';
ctx.fillRect(hookZoneX0, 0, hookZoneX1 - hookZoneX0, h);
// 3. Anti-virality orange band (if triggered, over dropoff_segment_indices x-range)
// 4. Y gridlines
ctx.strokeStyle = 'rgba(255,255,255,0.04)';
// 5. Y-axis labels (10px monospace)
ctx.font = '10px monospace';
ctx.fillStyle = 'rgba(255,255,255,0.3)';
// 6. Gradient fill
const grad = ctx.createLinearGradient(0, 0, 0, h);
grad.addColorStop(0, 'rgba(255,127,80,0.15)');
grad.addColorStop(1, 'rgba(255,127,80,0)');
// 7. Curve stroke
ctx.strokeStyle = '#FF7F50';
ctx.lineWidth = 2;
// 8. Dropoff markers (call DropoffMarkers draw functions)
```

**ARIA:**
```tsx
<canvas
  ref={curveRef}
  role="img"
  aria-label={`Audience retention curve. Weighted average: ${weightedCompletionPct}% watch time`}
/>
```

---

### `DropoffMarkers.ts` (pure-function utility, transform)

**Analog:** `src/lib/engine/anti-virality.ts` (pure-function module structure — no React, no imports except types)

**Module structure to copy** (anti-virality.ts lines 32–108):
```typescript
// Pure functions only — no React, no hooks, no side effects
import type { HeatmapPayload } from './types';

export const ANTI_VIRALITY_THRESHOLD = 0.4;
export function isAntiViralityGated(confidence: number): boolean { ... }
export function isTimelinePatternTriggered(heatmap: HeatmapPayload | null): boolean { ... }
export function topDropoffSegmentIndices(heatmap: HeatmapPayload, n = 3): number[] { ... }
export function isAntiViralityGatedFull(...): { gated, reason, dropoff_segment_indices } { ... }
```

**DropoffMarkers.ts pattern to implement:**
```typescript
// src/components/board/audience/DropoffMarkers.ts
import type { HeatmapPayload } from '@/lib/engine/types';
import type { AudienceMarker, MarkerCluster } from './audience-types';

// Pure geometry — called from RetentionCurve's RAF loop
export function computeMarkerPositions(
  personas: HeatmapPayload['personas'],
  segments: HeatmapPayload['segments'],
  canvasWidth: number,
  canvasHeight: number,
  totalDuration: number,
): AudienceMarker[] { ... }

export function clusterMarkers(
  markers: AudienceMarker[],
  // D-12: ≥3 within 12px OR ≥2 within 6px
  thresholdLarge = 12,
  thresholdSmall = 6,
): Array<AudienceMarker | MarkerCluster> { ... }

export function findMarkerAtPoint(
  markers: Array<AudienceMarker | MarkerCluster>,
  x: number,
  y: number,
  hitRadius = 22,
): AudienceMarker | MarkerCluster | null { ... }

export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  markers: Array<AudienceMarker | MarkerCluster>,
  morphProgress: number, // 0–1; opacity = easeOutCubic(progress * 1.2) clamped to 1
  reducedMotion: boolean,
): void { ... }
```

**Archetype ring colors** (UI-SPEC §DropoffMarkers):
```typescript
const RING_COLOR: Record<string, string> = {
  fyp:        '#FF7F50',                  // coral-500
  niche:      'oklch(0.87 0.10 40)',      // coral-300
  loyalist:   'oklch(0.97 0.03 40)',      // coral-100
  cross_niche:'rgba(255,255,255,0.30)',
};
```

---

### `HeatmapDrawer.tsx` + `PersonaRow.tsx` (component display, streaming)

**Analog:** `src/components/ui/sheet.tsx` (Radix Sheet for mobile bottom-sheet variant) + `src/components/board/GroupFrameOverlay.tsx` (Skeleton streaming row)

**Desktop inline expand pattern** (CSS Grid drawer):
```tsx
// Drawer open/close via grid-template-rows transition (250ms ease-out-cubic)
<div
  className="grid overflow-hidden transition-[grid-template-rows] duration-[250ms] ease-[var(--ease-out-cubic)]"
  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
>
  <div className="min-h-0">{/* grid content */}</div>
</div>
```

**Mobile bottom-sheet** — use existing `Sheet` from `src/components/ui/sheet.tsx`:
```tsx
import { Sheet, SheetContent } from '@/components/ui/sheet';
// side="bottom" for mobile heatmap, side="right" for PersonaInspector + WeightOverrideDrawer
<Sheet open={isMobile && isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="bottom" className="max-h-[70dvh]">
    {/* heatmap grid */}
  </SheetContent>
</Sheet>
```

**`useIsMobile()` detection** (RESEARCH §Mobile portrait):
```typescript
import { useIsMobile } from '@/hooks/useIsMobile'; // 768px breakpoint
const isMobile = useIsMobile();
```

**Skeleton row pattern** (GroupFrameOverlay lines 108–110):
```tsx
import { Skeleton } from '@/components/ui/skeleton';
// PersonaRow skeleton state:
{isSkeletonState && (
  <Skeleton className="h-full w-full animate-pulse" />
)}
```

**CSS Grid heatmap + L→R wave** (UI-SPEC §HeatmapDrawer):
```tsx
// Grid: 10 rows × N cols, column widths proportional to segment duration
<div
  role="grid"
  aria-label="Persona attention heatmap"
  aria-rowcount={10}
  aria-colcount={segments.length}
  style={{
    display: 'grid',
    gridTemplateColumns: segmentColTemplate, // built from segments durations
  }}
>
  {/* PersonaRow per persona, fixed archetype order D-05 */}
</div>

// Cell fill — CSS transition-delay stagger for L→R wave (D-06):
// transition: 'background-color 180ms linear'
// transitionDelay: `${cellIdx * 18}ms`  // total 180ms for 10 cells
// background: `rgba(255,127,80, ${clamp(attention, 0.05, 0.80)})`
```

**Fixed archetype slot order** (D-05 + audience-constants.ts):
```typescript
export const PERSONA_SLOT_ORDER: Array<'fyp' | 'niche' | 'loyalist' | 'cross_niche'> = [
  'fyp','fyp','fyp','fyp','fyp','fyp',   // 6 FYP
  'niche','niche',                         // 2 niche
  'loyalist',                              // 1 loyalist
  'cross_niche',                           // 1 cross-niche
];
```

**Color-blind mode** (UI-SPEC §HeatmapDrawer):
```css
/* CSS class toggle — diagonal stripe overlay proportional to attention */
.heatmap-pattern-cb .heatmap-cell {
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0 2px,
    rgba(255,255,255,0.15) 2px 4px
  );
}
```

---

### `TapPopover.tsx` (component interactive, request-response)

**Analog:** `src/components/ui/popover.tsx` (entire file, 89 lines)

**Full popover pattern to copy** (popover.tsx lines 1–89):
```typescript
import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

// Renders in portal automatically via PopoverPrimitive.Portal
function PopoverContent({ className, align = "center", sideOffset = 4, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 ...", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
// Also export: PopoverAnchor for anchor-based positioning at canvas tap point
```

**Canvas tap coordinate → popover anchor pattern** (RESEARCH §Canvas tap handling):
```tsx
// Hidden anchor div — position it at tap screen coordinates before opening popover
const [anchorPos, setAnchorPos] = useState<{ x: number; y: number } | null>(null);

// On canvas pointerdown:
const rect = canvasRef.current.getBoundingClientRect();
setAnchorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
setPopoverOpen(true);

// Anchor element:
<div
  ref={anchorRef}
  style={{ position: 'absolute', left: anchorPos.x, top: anchorPos.y, width: 0, height: 0 }}
/>
<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
  <PopoverAnchor virtualRef={anchorRef} />
  <PopoverContent>
    {/* variant content based on kind prop */}
  </PopoverContent>
</Popover>
```

**GlassPanel background on popover content** (GlassPanel.tsx + CLAUDE.md):
```tsx
// Override shadcn popover bg with GlassPanel treatment
// Must use inline style for backdropFilter (Lightning CSS strips it)
<PopoverContent
  className="rounded-[12px] border border-white/[0.06] p-5"
  style={{
    background: 'linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    boxShadow: 'rgba(255,255,255,0.15) 0px 1px 1px 0px inset',
    zIndex: 300,  // above command bar (200), below modal (400)
  }}
>
```

**Dismiss on scroll >40px** (UI-SPEC §TapPopover):
```typescript
useEffect(() => {
  const onScroll = () => { if (Math.abs(scrollDelta) > 40) setPopoverOpen(false); };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, [popoverOpen]);
```

**ARIA:**
```tsx
<div role="tooltip" aria-live="polite">
```

---

### `PersonaInspector.tsx` (component panel, request-response)

**Analog:** `src/components/ui/sheet.tsx` (entire file, 143 lines)

**Sheet usage pattern** (sheet.tsx lines 47–86):
```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';

// Desktop: side="right" 360px wide; Mobile: side="bottom" 85dvh
const side = isMobile ? 'bottom' : 'right';
<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent
    side={side}
    className={cn(
      'bg-[#18191a] border-white/[0.06]',      // --color-surface override
      side === 'right' && 'max-w-[360px]',
      side === 'bottom' && 'max-h-[85dvh]',
    )}
    // Override default close button aria-label to match UI-SPEC
    // showCloseButton={true} — renders XIcon with sr-only "Close"
    // Add explicit aria-label on the SheetClose <button> via className override
  >
    <SheetHeader>
      <SheetTitle>{personaName}</SheetTitle>
    </SheetHeader>
    {/* inspector content */}
  </SheetContent>
</Sheet>
```

**Focus management** — Radix Dialog handles focus-trap automatically; return focus to trigger via Radix `onCloseAutoFocus`:
```tsx
<SheetContent
  onCloseAutoFocus={(e) => {
    e.preventDefault();
    triggerRef.current?.focus();
  }}
>
```

**Z-index:** `--z-modal` = 400 (UI-SPEC §Z-index hierarchy). Override default Radix z-50 via className.

**ARIA:**
```tsx
// SheetPrimitive.Content already has role="dialog" aria-modal="true"
// SheetPrimitive.Title provides aria-labelledby
<SheetContent aria-label={`${personaName} detailed analysis`}>
```

**Attention sparkline** — mini canvas inside inspector, 48px tall. Same DPR + RAF pattern as `use-retention-curve-canvas.ts` but simplified: no morph, 1px coral stroke, no gradient fill, no markers.

---

### `WeightOverrideDrawer.tsx` (component form, CRUD)

**Analog:** `src/components/ui/sheet.tsx` + `src/lib/engine/persona-weights.ts`

**Sheet pattern:** same as PersonaInspector above. `side="right"` (320px, desktop), `side="bottom"` (70dvh, mobile).

**`normalizeWeights` reuse** (persona-weights.ts lines 63–75):
```typescript
// Import directly — pure module, no server-only imports verified
import { normalizeWeights, DEFAULT_PERSONA_WEIGHT_CONFIG } from '@/lib/engine/persona-weights';

// Auto-renormalize on slider change (D-18 proportional algorithm from RESEARCH §4.11):
function rebalance(w: PersonaWeights, changedKey: keyof PersonaWeights, newValue: number): PersonaWeights {
  const oldValue = w[changedKey];
  const delta = newValue - oldValue;
  const others = (Object.keys(w) as Array<keyof PersonaWeights>).filter(k => k !== changedKey);
  const otherSum = others.reduce((s, k) => s + w[k], 0);
  if (otherSum === 0) return { ...w, [changedKey]: newValue };
  const next = { ...w, [changedKey]: newValue };
  for (const k of others) next[k] = Math.max(0, w[k] - delta * (w[k] / otherSum));
  return normalizeWeights(next); // belt-and-suspenders
}
```

**Preset constants** (audience-constants.ts — matches CONTEXT.md D-18 values):
```typescript
export const WEIGHT_PRESETS = {
  default:     { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
  established: { fyp: 0.40, niche: 0.20, loyalist: 0.30, cross_niche: 0.10 },
  niche_heavy: { fyp: 0.30, niche: 0.55, loyalist: 0.10, cross_niche: 0.05 },
  new_creator: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
} as const;
```

**Slider ARIA** (UI-SPEC §WeightOverrideDrawer):
```tsx
<Slider
  aria-label={`${archetype} weight`}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(weight * 100)}
/>
```

**ARIA:** `role="dialog" aria-modal="true" aria-label="Audience weight override"` — handled by SheetPrimitive; sum display uses `aria-live="polite"`.

---

### `AntiViralityOverlay.tsx` (component conditional, event-driven)

**Analog:** `src/lib/engine/anti-virality.ts` (trigger source, pure-fn import)

**Trigger evaluation** (anti-virality.ts lines 91–108):
```typescript
import {
  isAntiViralityGatedFull,
  topDropoffSegmentIndices,
  isTimelinePatternTriggered,
} from '@/lib/engine/anti-virality';

// Call client-side — all three are pure functions, no server-only imports
const { gated, reason, dropoff_segment_indices } = isAntiViralityGatedFull(
  result.confidence,
  currentHeatmap,  // may be recomputed heatmap during slider drag
);
```

**Visual variant mapping** (RESEARCH §Anti-virality §Visual variants):
```typescript
// reason === 'confidence' only → border + header dot (no per-segment chips)
// reason === 'timeline_pattern' | 'both' → orange band on curve (via prop to RetentionCurve)
//                                         + fix-chips below filmstrip
// Heatmap cells: ALWAYS coral, never tinted (D-15 hard lock)
```

**Fix chip anatomy** (UI-SPEC §AntiViralityOverlay):
```tsx
// 11px text, --color-warning border, --color-surface-elevated fill, 4px radius
<button
  className="rounded-[4px] border px-2 py-0.5 text-[11px]"
  style={{
    borderColor: 'var(--color-warning)',
    background: 'var(--color-surface-elevated)',
  }}
  onClick={() => openTapPopover({ kind: 'fix-chip', segmentIdx, fixText })}
>
  seg {segmentIdx}: {fixText}
</button>
```

**Animation** (400ms enter / 200ms exit per UI-SPEC):
```typescript
// CSS class on AudienceNode outer border:
// enter: transition-colors duration-400ms ease-[var(--ease-out-cubic)]
// exit: duration-200ms ease-in-out
```

---

### `use-audience-choreography.ts` (hook, event-driven)

**Analog:** `src/hooks/queries/use-analysis-stream.ts` (dispatch table + staged state transitions)

**Pattern to mirror — staged state machine** (use-analysis-stream.ts lines 153–225):
```typescript
// Pattern: useCallback dispatch with setPartial setState updater functions
const dispatch = useCallback((eventType: string, data: unknown) => {
  if (eventType === 'stage') {
    const ev = data as StageEvent;
    if (ev.type === 'pass2_persona_start') {
      setPartial((prev) => {
        // Immutable update, findIndex pattern
        const idx = prev.personas.findIndex((p) => p.id === ev.persona_id);
        if (idx === -1) return { personas: [...prev.personas, { id: ev.persona_id, pass2_status: 'streaming' }] };
        const next = [...prev.personas];
        next[idx] = { ...next[idx]!, pass2_status: 'streaming' };
        return { personas: next };
      });
    } else if (ev.type === 'pass2_persona_end') {
      setPartial((prev) => {
        // full attentions[] + swipe_predicted_at arrives atomically per A6
        // ...
      });
    }
  }
}, []);
```

**Choreography hook outputs:**
```typescript
// Consume useAnalysisStream + derive row + curve state
export interface ChoreographyState {
  rowStates: Record<string, 'skeleton' | 'streaming' | 'filling' | 'complete'>;
  curveState: 'idle' | 'baseline' | 'morphing' | 'final';
  isAntiViralityActive: boolean;
}
```

**`wave_0_complete` detection** (RESEARCH §4.7):
```typescript
const wave0Done = stages.find(
  s => s.type === 'stage_end' && s.stage === 'wave_0_segmentation'
);
// When wave0Done is truthy: emit skeleton rows in fixed PERSONA_SLOT_ORDER
```

**`aria-live` announce pattern** (from `src/lib/a11y.ts` usage in Phase 2):
```typescript
import { announce } from '@/lib/a11y';
// On streaming start: announce('polite', 'Reading your audience…')
// On complete: announce('polite', 'Audience analysis ready')
// On anti-virality: announce('assertive', 'Critical drop detected at segments X–Y')
```

---

### `use-client-weights.ts` (hook, transform)

**Analog:** `src/lib/engine/wave3/weighted-aggregator.ts` lines 49–80 (math to mirror) + `src/lib/engine/persona-weights.ts` (import directly)

**`normalizeOverSurvivors` pattern to extract into `weighted-aggregator-client.ts`** (weighted-aggregator.ts lines 58–70):
```typescript
function normalizeOverSurvivors(
  survivors: Array<{ slot_type: string }>,
  weights: PersonaWeights,
): PersonaWeights {
  const presentTypes = new Set(survivors.map((s) => s.slot_type));
  const filtered: PersonaWeights = {
    fyp:       presentTypes.has('fyp')       ? weights.fyp       : 0,
    niche:     presentTypes.has('niche')     ? weights.niche     : 0,
    loyalist:  presentTypes.has('loyalist')  ? weights.loyalist  : 0,
    cross_niche: presentTypes.has('cross_niche') ? weights.cross_niche : 0,
  };
  return normalizeWeights(filtered);
}
```

**`getPersonaWeight` niche_deep mapping** (weighted-aggregator.ts lines 76–80):
```typescript
function getPersonaWeight(slotType: string, w: PersonaWeights): number {
  const key = slotType === 'niche_deep' ? 'niche' : slotType;
  return w[key as keyof PersonaWeights] ?? 0;
}
```

**Client-side recompute hook interface** (RESEARCH §4.11):
```typescript
// use-client-weights.ts
import { normalizeWeights } from '@/lib/engine/persona-weights';
import { isAntiViralityGatedFull } from '@/lib/engine/anti-virality';

// 16ms RAF debounce: use useRef<number> + requestAnimationFrame pattern
// identical to hive-demo-canvas.tsx animRef.current = requestAnimationFrame(draw)
export function useClientWeights(
  heatmap: HeatmapPayload | null,
  initialWeights: PersonaWeights,
): {
  weights: PersonaWeights;
  setWeights: (w: PersonaWeights) => void;
  recomputedCurve: number[];
  recomputedMetrics: { completion_pct: number; top_dropoff_t: number; hook_score: number };
  antiViralityState: ReturnType<typeof isAntiViralityGatedFull>;
  isDirty: boolean;
}
```

---

### `weighted-aggregator-client.ts` (engine utility, transform) — NEW FILE

**Analog:** `src/lib/engine/wave3/weighted-aggregator.ts` lines 1–80 (pure math extraction)

**What to extract** — remove `createLogger` import, extract these three pure functions:
- `normalizeOverSurvivors()` (lines 58–70)
- `getPersonaWeight()` (lines 76–80)
- Add new `recomputeWeightedCurve()` with client-safe signature (RESEARCH §Client-side curve recompute)

**Location:** `src/lib/engine/wave3/weighted-aggregator-client.ts`
No `"use server"`, no `createLogger` import. Pure math only.

---

### `audience-constants.ts` (config)

**Analog:** `src/lib/engine/wave3/weighted-aggregator.ts` (constant export style, lines 12–20)

**Pattern to copy:**
```typescript
/** D-06 (Pass 2): ≥7/10 Pass 2 successes for non-null heatmap. */
export const SUCCESS_THRESHOLD = 7;

/** R2.3 default mix per D-13. */
export const DEFAULT_WEIGHTS: PersonaWeights = {
  fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05,
};
```

**Phase 4 constants to define:**
```typescript
export const CELL_FILL_WAVE_MS = 180;    // D-06 total per row
export const CELL_FILL_STAGGER_MS = 18;  // 18ms × 10 cells
export const CURVE_MORPH_MS = 800;       // D-07
export const CURVE_BASELINE_MS = 300;    // D-07
export const MARKER_CLUSTER_PX_LARGE = 12; // D-12: ≥3 markers
export const MARKER_CLUSTER_PX_SMALL = 6;  // D-12: ≥2 markers
export const MARKER_HIT_RADIUS = 22;
export const MARKER_DOT_RADIUS = 4;      // 8px diameter
export const FILMSTRIP_KEYFRAME_FADE_MS = 150;
export const MEDIUM_TIER_WAVE_FACTOR = 0.5; // halve to 90ms on medium tier
export const AUDIENCE_FRAME_TITLE_BAR_H = 36; // TITLE_BAR_HEIGHT from board-constants
export const WEIGHT_PRESET_EPSILON = 0.005; // D-18 "matches preset" tolerance
export const PERSONA_SLOT_ORDER = ['fyp','fyp','fyp','fyp','fyp','fyp','niche','niche','loyalist','cross_niche'] as const;
export const WEIGHT_PRESETS = { ... }; // D-18 values
```

---

### `audience-types.ts` (local TypeScript interfaces)

**Analog:** `src/lib/engine/types.ts` lines 27–64 (`HeatmapPayload`, `PersonaStreamingPartial`)

**Types to define** (import from engine, extend locally):
```typescript
import type { HeatmapPayload, PersonaStreamingPartial } from '@/lib/engine/types';
import type { PersonaWeights } from '@/lib/engine/persona-weights';

export type PersonaSlotType = 'fyp' | 'niche' | 'loyalist' | 'cross_niche';
export type RowState = 'skeleton' | 'streaming' | 'filling' | 'complete';
export type CurveState = 'idle' | 'baseline' | 'morphing' | 'final';
export type TapKind = 'cell' | 'marker' | 'cluster' | 'curve-point' | 'fix-chip';

export interface AudienceMarker {
  personaId: string;
  slotType: PersonaSlotType;
  archetype: string;
  x: number;  // canvas pixels
  y: number;
  opacity: number; // 0–1, animated
}

export interface MarkerCluster {
  x: number;
  y: number;
  count: number;
  markers: AudienceMarker[];
}
```

---

### Test files — `src/components/board/audience/__tests__/` (Vitest)

**Analog:** `src/lib/__tests__/perf-tier.test.ts` (pure-function tests) + `src/lib/engine/__tests__/pipeline.test.ts` (mock-heavy integration tests)

**File header pattern** (perf-tier.test.ts lines 1–2):
```typescript
/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

**Mock pattern for external deps** (pipeline.test.ts lines 18–50):
```typescript
// Mock BEFORE imports
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(),
  })),
}));
```

**Fixture builder pattern for `HeatmapPayload`** (derive from types.ts shape):
```typescript
// src/components/board/audience/__tests__/fixtures/heatmap-fixture.ts
import type { HeatmapPayload } from '@/lib/engine/types';

export function buildHeatmapFixture(overrides?: Partial<HeatmapPayload>): HeatmapPayload {
  return {
    segments: [
      { idx: 0, t_start: 0, t_end: 3, label: 'hook', is_hook_zone: true, keyframe_uri: null },
      { idx: 1, t_start: 3, t_end: 7, label: 'buildup', is_hook_zone: false, keyframe_uri: null },
      // ... 10 segments
    ],
    personas: Array.from({ length: 10 }, (_, i) => ({
      id: `persona_${i}`,
      attentions: Array.from({ length: 10 }, () => Math.random()),
      swipe_predicted_at: null,
      segment_reasons: {},
    })),
    weighted_curve: Array.from({ length: 10 }, (_, i) => 1 - i * 0.07),
    weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
    weights_source: 'default',
    ...overrides,
  };
}
```

**streaming-fixture.ts** — sequence of `StageEvent` to mock `useAnalysisStream` dispatch:
```typescript
// Model after the event timeline in RESEARCH §Streaming Choreography
import type { StageEvent } from '@/lib/engine/events';

export const STREAMING_FIXTURE: StageEvent[] = [
  { type: 'stage_start', stage: 'wave_0_segmentation', ... },
  { type: 'stage_end',   stage: 'wave_0_segmentation', ... },
  { type: 'pass2_persona_start', persona_id: 'fyp_1', archetype: 'high_engager' },
  // ...
  { type: 'pass2_persona_end', persona_id: 'fyp_1', attentions: [...], swipe_predicted_at: 4.2, ok: true, ... },
];
```

**Test command per file** (RESEARCH §Test Framework):
```bash
npm test -- src/components/board/audience/__tests__/<file>.test.tsx -t "<name>"
```

---

### `use-analysis-stream.ts` (extend — `filmstrip_segment_ready` dispatch)

**Analog:** self — additive extension of lines 153–225

**Where to add** — inside the `dispatch` `useCallback`, after line 200 (after the `pass2_persona_end` branch), inside the `eventType === 'stage'` block:

```typescript
// Add AFTER the pass2_persona_end block (line 200):
} else if (ev.type === 'filmstrip_segment_ready') {
  setFilmstrips((prev) => ({
    ...prev,
    [(ev as { segment_idx: number; keyframe_uri: string }).segment_idx]:
      (ev as { segment_idx: number; keyframe_uri: string }).keyframe_uri,
  }));
}
```

**New state to add** (mirrors existing `partial` state pattern, lines 121–122):
```typescript
const [filmstrips, setFilmstrips] = useState<Record<number, string>>({});
```

**Return object** — add as 10th key (lines 399):
```typescript
return { start, result, stages, partial, panelReady, phase, error, reconnect, analysisId, filmstrips };
```

**Interface extension** (lines 88–100):
```typescript
export interface AnalysisStreamReturn {
  // ... existing 9 keys ...
  filmstrips: Record<number, string>; // segment_idx → signed keyframe URL
}
```

---

### `src/lib/engine/types.ts` (extend `HeatmapPayload.personas[]`)

**Analog:** self — additive field (Open Question 1 resolution)

**Where to add** — `HeatmapPayload.personas[]` entry (lines 32–40), add `slot_type`:
```typescript
personas: Array<{
  id: string;
  slot_type: 'fyp' | 'niche' | 'loyalist' | 'cross_niche'; // NEW — Phase 4 additive
  attentions: number[];
  swipe_predicted_at: number | null;
  segment_reasons: Record<number, string>;
}>;
```
Also extend `assembleHeatmapPayload()` in `weighted-aggregator.ts` to carry `slot_type` through from `Pass2PersonaResult.slot_type`.

---

### `supabase/migrations/<ts>_audience_overrides.sql` (migration)

**Analog:** `supabase/migrations/20260526000000_outcomes_and_filmstrips.sql` (naming + structure)

**Naming convention:** `YYYYMMDDHHMMSS_<descriptive_name>.sql` — e.g. `20260527000000_audience_overrides.sql`

**Header pattern** (outcomes_and_filmstrips.sql lines 1–14):
```sql
-- =========================================================================
-- Phase 4 — Live Audience Node
-- analysis_override JSONB column + creator_persona_weights table
-- Created: 2026-05-27
-- Migration is forward-compatible: analysis_override defaults null.
-- =========================================================================
```

**Full migration SQL** (from RESEARCH §4.11):
```sql
-- Add analysis_override column (Phase 3 D-20 schema, shipped in Phase 4)
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS analysis_override JSONB;

-- New creator default weights table (D-22)
CREATE TABLE IF NOT EXISTS creator_persona_weights (
  user_id    UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fyp        NUMERIC(5,4) NOT NULL DEFAULT 0.65,
  niche      NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  loyalist   NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  cross_niche NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  updated_at TIMESTAMPTZ  DEFAULT now()
);
ALTER TABLE creator_persona_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY cpw_select_own ON creator_persona_weights
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY cpw_upsert_own ON creator_persona_weights
  FOR ALL    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**RLS pattern** (outcomes_and_filmstrips.sql lines 43–50):
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <name> ON <table> FOR SELECT TO authenticated USING (auth.uid() = user_id);
```

---

## Shared Patterns

### GlassPanel surface — all popover + panel + drawer backgrounds

**Source:** `src/components/primitives/GlassPanel.tsx` (entire file, 58 lines)
**Apply to:** `TapPopover.tsx`, `PersonaInspector.tsx`, `WeightOverrideDrawer.tsx`, `AudienceNode.tsx`

```tsx
// Direct import and use:
import { GlassPanel } from '@/components/primitives/GlassPanel';
<GlassPanel className="p-5">{children}</GlassPanel>

// For canvas popover override (need inline style for backdropFilter):
style={{
  background: 'linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)',
  backdropFilter: 'blur(5px)',
  WebkitBackdropFilter: 'blur(5px)',
  boxShadow: 'rgba(255,255,255,0.15) 0px 1px 1px 0px inset',
}}
```
Note: **never use Tailwind `backdrop-filter` classes** — Lightning CSS strips them. Always inline style (CLAUDE.md §Known Technical Issues).

---

### World → screen projection — all board-positioned DOM overlays

**Source:** `src/components/board/NodeOverlay.tsx` lines 18–21 and `src/components/board/GroupFrameOverlay.tsx` lines 51–54
**Apply to:** `AudienceNode.tsx`

```typescript
const screenX = bounds.x * camera.scale + camera.x;
const screenY = bounds.y * camera.scale + camera.y;
const screenW = bounds.width * camera.scale;
const screenH = bounds.height * camera.scale;
// style={{ left: screenX, top: screenY, width: screenW, height: screenH }}
```

---

### RAF + cancel on unmount — all canvas components

**Source:** `src/components/hive-demo/hive-demo-canvas.tsx` lines 40–148
**Apply to:** `use-retention-curve-canvas.ts`, attention sparkline in `PersonaInspector.tsx`

```typescript
const animRef = useRef<number>(0);
// In useEffect:
animRef.current = requestAnimationFrame(draw);
return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
```

---

### DPR-aware canvas setup — all `<canvas>` elements

**Source:** `src/components/hive-demo/hive-demo-canvas.tsx` lines 52–62
**Apply to:** `RetentionCurve.tsx`, attention sparkline in `PersonaInspector.tsx`

```typescript
const dpr = window.devicePixelRatio || 1;
const rect = canvas.getBoundingClientRect();
if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
}
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
ctx.clearRect(0, 0, rect.width, rect.height);
```

---

### `useIsMobile` + `usePrefersReducedMotion` — all animated components

**Source:**
- `src/hooks/useIsMobile.ts` (768px breakpoint) — verified
- `src/hooks/usePrefersReducedMotion.ts` — verified; also check `effectiveReducedMotion` pattern in `Board.tsx` line 65 which ORs perf tier `low` with the media query
**Apply to:** every Phase 4 component that has animations

```typescript
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { usePerfStore } from '@/lib/perf-tier';

const isMobile = useIsMobile();
const prefersReduced = usePrefersReducedMotion();
const tier = usePerfStore(s => s.tier);
const reducedMotion = prefersReduced || tier === 'low'; // effectiveReducedMotion
```

---

### Tailwind v4 oklch caveat — all color usage in components

**Source:** `CLAUDE.md` §Known Technical Issues
**Apply to:** ALL Phase 4 files with color values

```typescript
// WRONG — oklch fails for dark colors (L < 0.15) in Tailwind v4
// className="bg-[oklch(0.08_0_0)]"

// CORRECT — use exact hex in @theme, or inline style
// --color-surface: #18191a  (NOT oklch)
// --color-surface-elevated: #222326
// Coral is fine as hex in canvas ctx: '#FF7F50'
// Warning orange is oklch(0.75 0.15 85) — L > 0.15, safe for Tailwind
```

---

### Anti-virality dual-trigger import — all components that show warning state

**Source:** `src/lib/engine/anti-virality.ts` lines 91–108
**Apply to:** `AntiViralityOverlay.tsx`, `use-client-weights.ts`, `use-audience-choreography.ts`

```typescript
import {
  isAntiViralityGatedFull,
  topDropoffSegmentIndices,
  isTimelinePatternTriggered,
  ANTI_VIRALITY_THRESHOLD,
} from '@/lib/engine/anti-virality';
// All pure functions — safe to call from client components during RAF
```

---

### `aria-live` announce — streaming state changes

**Source:** `src/lib/a11y.ts` (`announce` helper — verified in Phase 2)
**Apply to:** `AudienceNode.tsx`, `use-audience-choreography.ts`

```typescript
import { announce } from '@/lib/a11y';
// 'polite' for non-urgent state changes; 'assertive' for anti-virality detection
announce('polite', 'Reading your audience…');
announce('polite', 'Audience analysis ready');
announce('assertive', `Critical drop detected at segments ${segList}`);
```

---

## No Analog Found

All Phase 4 files have analogs in the codebase. No files require falling back to RESEARCH.md patterns only.

| Closest Gap | File | Reason |
|------------|------|--------|
| No exact canvas-curve analog | `RetentionCurve.tsx` (Catmull-Rom bezier) | `hive-demo-canvas.tsx` covers DPR + RAF but uses arcs/lines, not bezier curves. Hand-roll per RESEARCH §4.4 (≤25 LOC). |
| No heatmap CSS-Grid analog | `HeatmapDrawer.tsx` | `competitors/charts/posting-heatmap.tsx` exists but different domain — do NOT reuse. Build fresh. |

---

## Metadata

**Analog search scope:** `src/components/board/`, `src/hooks/`, `src/lib/engine/`, `src/components/ui/`, `src/components/primitives/`, `src/components/hive-demo/`, `supabase/migrations/`
**Files read:** 18 source files + 2 migration files
**Pattern extraction date:** 2026-05-27
