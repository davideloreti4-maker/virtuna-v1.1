# Phase 3: Hive 2.5D Visualization — Execution Plan

## Goal
Upgrade hive to 2.5D with depth layers, parallax, organic cloud layout, bezier connections, center video, and dynamic node count driven by Apollo tier (300/1K/10K).

## Requirements
- HIVE-1: Depth Layering System — 3 layers (foreground full, midground 70%/80%, background 40%/50%)
- HIVE-2: Mouse Parallax Effect — 3-5px/1-2px/0.5px per layer, disabled on mobile + reduced-motion
- HIVE-3: Organic Cloud Layout — Irregular clusters, denser near center, sparser at edges, deterministic
- HIVE-4: Bezier Curve Connections — Quadratic curves, opacity fades with distance, long connections invisible
- HIVE-5: Center Rectangle Video — Thumbnail during upload, video playback after analysis (muted, looping)
- HIVE-6: Dynamic Node Count — Lite=300, Pro=1000, Ultra=10000, animated transitions on tier switch
- HIVE-7: Persona Demographic Labels — Hover shows age, gender, interest

## Critical Imports
- `useSimulationStore` from `@/stores/simulation-store` — nodeCount, videoSrc, thumbnailSrc, analysisStatus
- `useSocialAccounts` from `@/hooks/use-social-accounts` — active account for persona context

## Performance Target
60fps at 10,000 nodes on Canvas 2D. Strategy: batch draw calls by (color, depth), cull sub-pixel nodes, distance-cull connections, skip background-to-background links.

## Execution Steps

### Plan 03-01: Types & Constants Foundation
**Files:** `src/components/hive/hive-types.ts` (EDIT), `src/components/hive/hive-constants.ts` (EDIT)
**Wave:** 1 (no dependencies)

**hive-types.ts — Add after InteractionState:**
```typescript
/** Visual depth layer for 2.5D parallax effect (orthogonal to semantic tiers). */
export type DepthLayer = 'foreground' | 'midground' | 'background';

/** Configuration for a single depth layer's visual treatment. */
export interface DepthLayerConfig {
  /** Node size multiplier (1.0 = full, 0.4 = small). */
  sizeMultiplier: number;
  /** Base opacity multiplier (1.0 = full, 0.5 = faded). */
  opacity: number;
  /** Parallax shift in px at maximum mouse offset. */
  parallaxFactor: number;
}

/** Normalized mouse offset for parallax calculation. */
export interface ParallaxOffset {
  x: number; // [-1, 1] from canvas center
  y: number;
}

/** Persona demographic data attached to hive nodes. */
export interface PersonaDemographic {
  ageRange: string;
  gender: string;
  interest: string;
}
```

Add `depthLayer: DepthLayer` field to `LayoutNode` interface (after `color`).

**hive-constants.ts — Add after existing constants:**
```typescript
import type { DepthLayer, DepthLayerConfig } from './hive-types';

// Depth layer visual config (HIVE-1)
export const DEPTH_LAYER_CONFIG: Record<DepthLayer, DepthLayerConfig> = {
  foreground: { sizeMultiplier: 1.0, opacity: 1.0, parallaxFactor: 5 },
  midground:  { sizeMultiplier: 0.7, opacity: 0.8, parallaxFactor: 1.5 },
  background: { sizeMultiplier: 0.4, opacity: 0.5, parallaxFactor: 0.5 },
};

// Cumulative hash thresholds: 20% foreground, 35% midground, 45% background
export const DEPTH_DISTRIBUTION = { foreground: 0.20, midground: 0.55 } as const;

// Bezier connection constants (HIVE-4)
export const BEZIER_CURVE_INTENSITY = 0.3;
export const CONNECTION_FADE_START = 0.15; // fraction of outerRadius — full opacity below
export const CONNECTION_FADE_END = 0.30;   // fully transparent above

// Persona demographic pools (HIVE-7)
export const PERSONA_AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'] as const;
export const PERSONA_GENDERS = ['Male', 'Female', 'Non-binary'] as const;
export const PERSONA_INTERESTS = [
  'Fashion', 'Gaming', 'Fitness', 'Comedy', 'Music', 'Food',
  'Travel', 'Tech', 'Beauty', 'Education', 'Sports', 'Art',
] as const;
```

**Verify:** `pnpm build` — no type errors.

---

### Plan 03-02: Mock Data Scaling
**File:** `src/components/hive/hive-mock-data.ts` (EDIT)
**Wave:** 1 (after 03-01 for constant imports)

Add `totalNodeCount?: number` to `MockHiveOptions`.

When `totalNodeCount` is provided:
- Compute `tier1Count = Math.min(15, Math.max(8, Math.round(Math.sqrt(totalNodeCount) / 3)))`
- Compute `baseTier2 = Math.floor((totalNodeCount - 1 - tier1Count) / tier1Count)`
- Distribute `remainder = (totalNodeCount - 1 - tier1Count) % tier1Count` across first N parents
- Use existing PRNG for all values

Add persona demographics to each tier-2 node:
```typescript
import { PERSONA_AGE_RANGES, PERSONA_GENDERS, PERSONA_INTERESTS } from './hive-constants';

// Inside the tier-2 loop:
meta: {
  ageRange: PERSONA_AGE_RANGES[Math.floor(rng() * PERSONA_AGE_RANGES.length)],
  gender: PERSONA_GENDERS[Math.floor(rng() * PERSONA_GENDERS.length)],
  interest: PERSONA_INTERESTS[Math.floor(rng() * PERSONA_INTERESTS.length)],
}
```

When `totalNodeCount` is undefined, existing behavior is preserved (10 tier-1, [24,42] tier-2 range).

**Verify:** `generateMockHiveData({ totalNodeCount: 300 })` produces 300 nodes, `countNodes()` confirms.

---

### Plan 03-03: Organic Cloud Layout
**File:** `src/components/hive/hive-layout.ts` (EDIT)
**Wave:** 2 (after 03-01)

1. **Import new types/constants:**
   ```typescript
   import type { DepthLayer } from './hive-types';
   import { DEPTH_DISTRIBUTION } from './hive-constants';
   ```

2. **Add depth layer assignment helper** (after existing hash functions):
   ```typescript
   function assignDepthLayer(nodeId: string): DepthLayer {
     const h = hash01(nodeId + ':depth');
     if (h < DEPTH_DISTRIBUTION.foreground) return 'foreground';
     if (h < DEPTH_DISTRIBUTION.midground) return 'midground';
     return 'background';
   }
   ```

3. **Add `depthLayer` to every LayoutNode** — center = `'foreground'`, tier-1 = `'foreground'` (always prominent landmarks), tier-2 = `assignDepthLayer(id)`.

4. **Tier-1: break symmetry** — Replace `angle = (i / count) * 2π` with:
   ```typescript
   const angle = i * GOLDEN_ANGLE + hash01s(d.data.id, 'a1') * 0.4;
   const r = TIER1_RADIUS * (0.7 + hash01s(d.data.id, 'r1') * 0.6);
   const x = r * Math.cos(angle);  // Remove Math.round for organic sub-pixel positions
   const y = r * Math.sin(angle);
   ```

5. **Tier-2: widen angular scatter** — Replace ±50° cone with ±144° spread:
   ```typescript
   // Wider angular spread — nodes scatter more freely around parent direction
   const angleSpread = (hash01s(d.data.id, 'a2') - 0.5) * Math.PI * 1.6;
   const angle = parentAngle + angleSpread;
   // Distance: keep existing sqrt + hash scatter, remove Math.round
   ```

6. **Scale outer radius** for large node counts:
   ```typescript
   const effectiveRadius = outerRadius * (0.8 + Math.log10(Math.max(nodes.length, 100)) * 0.3);
   ```
   Apply to CLUSTER_MAX_DIST computation.

**Verify:** Layout produces scattered, organic-looking positions. Same seed produces identical layout.

---

### Plan 03-04: 2.5D Renderer (Depth + Bezier + Parallax)
**File:** `src/components/hive/hive-renderer.ts` (EDIT)
**Wave:** 2 (after 03-01)

This is the most complex sub-plan. Changes:

1. **Import new constants:**
   ```typescript
   import {
     BEZIER_CURVE_INTENSITY, CONNECTION_FADE_START, CONNECTION_FADE_END,
     DEPTH_LAYER_CONFIG, HIVE_OUTER_RADIUS,
   } from './hive-constants';
   import type { DepthLayer, ParallaxOffset } from './hive-types';
   ```

2. **Update `renderHive` signature:**
   ```typescript
   export function renderHive(
     ctx: CanvasRenderingContext2D,
     layout: LayoutResult,
     canvasWidth: number,
     canvasHeight: number,
     visibility?: Record<number, TierVisibility>,
     interaction?: InteractionRenderState,
     parallaxOffset?: ParallaxOffset,
   ): void
   ```

3. **Pre-bucket nodes by depth layer** at start of `renderHive`:
   ```typescript
   const buckets: Record<DepthLayer, LayoutNode[]> = {
     background: [], midground: [], foreground: [],
   };
   for (const node of layout.nodes) {
     if (node.tier === 0) continue;
     buckets[node.depthLayer].push(node);
   }
   ```

4. **Replace `drawConnectionLines` with `drawBezierConnections`:**
   - Quadratic bezier with perpendicular control point:
     ```typescript
     const mx = (sx + tx) / 2, my = (sy + ty) / 2;
     const dx = tx - sx, dy = ty - sy;
     const dist = Math.sqrt(dx * dx + dy * dy);
     const curveDir = hashString(source.id + target.id) > 0.5 ? 1 : -1;
     const cpx = mx + (-dy / dist) * dist * BEZIER_CURVE_INTENSITY * curveDir;
     const cpy = my + (dx / dist) * dist * BEZIER_CURVE_INTENSITY * curveDir;
     ctx.quadraticCurveTo(cpx, cpy, tx, ty);
     ```
   - Distance-based opacity fade:
     ```typescript
     const worldDist = Math.sqrt((source.x - target.x) ** 2 + (source.y - target.y) ** 2);
     const normalized = worldDist / HIVE_OUTER_RADIUS;
     if (normalized > CONNECTION_FADE_END) continue;
     const distFade = normalized < CONNECTION_FADE_START ? 1
       : 1 - (normalized - CONNECTION_FADE_START) / (CONNECTION_FADE_END - CONNECTION_FADE_START);
     finalOpacity *= Math.max(0, distFade);
     ```
   - Background culling: skip if `source.depthLayer === 'background' && target.depthLayer === 'background'`
   - Apply parallax offset to endpoints based on source/target depth layers

5. **Modify `drawNodes` for depth layers:**
   - Accept `depthLayer: DepthLayer` parameter (called once per bucket)
   - Look up `DEPTH_LAYER_CONFIG[depthLayer]`
   - `drawRadius *= config.sizeMultiplier`
   - `combinedAlpha *= config.opacity`
   - Apply parallax: `x += (parallaxOffset?.x ?? 0) * config.parallaxFactor`
   - **Batch optimization:** Group nodes by fillStyle color, batch into single `beginPath()→arc()→fill()`:
     ```typescript
     const colorGroups = new Map<string, Array<{x: number, y: number, r: number}>>();
     // ... group nodes ...
     for (const [color, circles] of colorGroups) {
       ctx.beginPath();
       for (const c of circles) {
         ctx.moveTo(c.x + c.r, c.y);
         ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
       }
       ctx.fillStyle = color;
       ctx.fill();
     }
     ```
   - Skip nodes where `drawRadius * scale < 0.5` (sub-pixel optimization)

6. **Render order in `renderHive`:** background connections → background nodes → midground connections → midground nodes → foreground connections → foreground nodes → center rect → selected glow. Simplified: draw connections then nodes per depth layer, back-to-front.

7. **Update `drawCenterRect` and `drawSelectedGlow`:** Apply foreground parallax offset.

**Verify:** Visual inspection — bezier curves visible when zoomed in, distance fade working, depth layers create 2.5D effect.

---

### Plan 03-05: Hit Detection for Depth/Size
**Files:** `src/components/hive/hive-interaction.ts` (EDIT), `src/components/hive/use-hive-interaction.ts` (MINIMAL)
**Wave:** 2 (after 03-01)

**hive-interaction.ts:**
- Modify `findHoveredNode` to weight distance by inverse `sizeMultiplier`:
  ```typescript
  import { DEPTH_LAYER_CONFIG } from './hive-constants';
  // In findHoveredNode, after finding candidate:
  // Weight by depth — foreground nodes effectively have larger hit areas
  const depthConfig = DEPTH_LAYER_CONFIG[candidate.depthLayer];
  const effectiveDist = actualDist / depthConfig.sizeMultiplier;
  ```
- Foreground nodes win ties — their effective distance is divided by 1.0 (unchanged), while background nodes divide by 0.4 (effectively 2.5x further).
- Parallax is intentionally ignored in hit detection (max 5px offset << 20px search radius).

**use-hive-interaction.ts:**
- No structural changes. The quadtree + findHoveredNode contract stays the same.

**Verify:** Hover foreground node when overlapping with background node — foreground wins.

---

### Plan 03-06: HiveCanvas Integration
**Files:** `src/components/hive/HiveCanvas.tsx` (EDIT), `src/app/(app)/dashboard/dashboard-client.tsx` (EDIT)
**Wave:** 3 (after all Wave 2)

**HiveCanvas.tsx:**

1. Import simulation store:
   ```typescript
   import { useSimulationStore } from '@/stores/simulation-store';
   import { generateMockHiveData } from './hive-mock-data';
   import type { ParallaxOffset } from './hive-types';
   ```

2. Subscribe to store state:
   ```typescript
   const nodeCount = useSimulationStore((s) => s.nodeCount);
   const videoSrc = useSimulationStore((s) => s.videoSrc);
   const thumbnailSrc = useSimulationStore((s) => s.thumbnailSrc);
   const analysisStatus = useSimulationStore((s) => s.analysisStatus);
   ```

3. Dynamic data generation (replaces static `data` prop when store is active):
   ```typescript
   const generatedData = useMemo(
     () => generateMockHiveData({ totalNodeCount: nodeCount }),
     [nodeCount],
   );
   const effectiveData = data ?? generatedData;
   ```
   Replace `data` with `effectiveData` in existing `useMemo(() => computeHiveLayout(...))`.

4. Mouse parallax tracking:
   ```typescript
   const parallaxRef = useRef<ParallaxOffset>({ x: 0, y: 0 });
   const smoothParallaxRef = useRef<ParallaxOffset>({ x: 0, y: 0 });

   useEffect(() => {
     if (reducedMotion) return;
     // Skip on touch devices
     if ('ontouchstart' in window) return;

     const handleMouseMove = (e: MouseEvent) => {
       const canvas = canvasRef.current;
       if (!canvas) return;
       const rect = canvas.getBoundingClientRect();
       const cx = rect.left + rect.width / 2;
       const cy = rect.top + rect.height / 2;
       parallaxRef.current = {
         x: (e.clientX - cx) / (rect.width / 2),
         y: (e.clientY - cy) / (rect.height / 2),
       };
     };

     window.addEventListener('mousemove', handleMouseMove);
     return () => window.removeEventListener('mousemove', handleMouseMove);
   }, [reducedMotion]);
   ```

5. Smooth parallax interpolation in render function:
   ```typescript
   // Inside render():
   const sp = smoothParallaxRef.current;
   const tp = parallaxRef.current;
   sp.x += (tp.x - sp.x) * 0.08;
   sp.y += (tp.y - sp.y) * 0.08;
   // Pass to renderHive
   renderHive(ctx, layout, cssWidth, cssHeight, visibility, interaction, sp);
   ```
   This requires the render loop to run continuously when parallax is active. Add a RAF loop that runs while mouse is moving (stop after ~1s of no movement).

6. Video overlay — After `<canvas>`, before overlay:
   ```tsx
   {(videoSrc || thumbnailSrc) && centerScreenRef.current && (
     <div
       className="absolute pointer-events-none overflow-hidden"
       style={{
         left: centerScreenRef.current.x - scaledW / 2,
         top: centerScreenRef.current.y - scaledH / 2,
         width: scaledW, height: scaledH,
         borderRadius: 8,
       }}
     >
       {analysisStatus === 'complete' && videoSrc ? (
         <video src={videoSrc} autoPlay muted loop playsInline
           className="w-full h-full object-cover" />
       ) : thumbnailSrc ? (
         <img src={thumbnailSrc} alt="" className="w-full h-full object-cover" />
       ) : null}
     </div>
   )}
   ```
   Compute `centerScreenRef` each frame via `worldToScreen(0, 0, cam, w, h, fitTransform)`.
   Compute `scaledW/H` from `NODE_SIZES.center.width * fitTransform.scale * cam.zoom`.

7. Tier switch animation: When `nodeCount` changes, `effectiveData` changes, `computeHiveLayout` recomputes, `useHiveAnimation` replays the progressive build animation. This happens automatically.

**dashboard-client.tsx:**
- Remove `const hiveData = useMemo(() => generateMockHiveData(), []);` (line 160)
- Remove `generateMockHiveData` import
- Change `<HiveCanvas data={hiveData} ...>` to `<HiveCanvas data={null} ...>`

**Verify:** Switch Apollo tier → node count changes with animation. Move mouse → parallax effect visible.

---

### Plan 03-07: Persona Demographic Labels
**File:** `src/components/hive/HiveNodeOverlay.tsx` (EDIT)
**Wave:** 3 (parallel with 03-06, different file)

Import `PersonaDemographic` type:
```typescript
import type { LayoutNode, PersonaDemographic } from './hive-types';
```

After the existing `{node.meta && Object.entries(node.meta)...}` block (or replacing it), add:
```tsx
{node.meta && 'ageRange' in node.meta && (
  <div className="flex flex-wrap gap-1.5 mt-2">
    {[
      (node.meta as PersonaDemographic).ageRange,
      (node.meta as PersonaDemographic).gender,
      (node.meta as PersonaDemographic).interest,
    ].filter(Boolean).map((label) => (
      <span
        key={label}
        className="px-1.5 py-0.5 text-[10px] rounded bg-white/[0.06] text-white/60"
      >
        {label}
      </span>
    ))}
  </div>
)}
```

Remove the generic `Object.entries(node.meta).slice(0, 3)` block since persona demographics replace it.

**Verify:** Click a tier-2 node → overlay shows demographic pills (age, gender, interest).

---

## Wave Execution Order

```
Wave 1: 03-01 → 03-02 (sequential, 02 imports from 01)
Wave 2: 03-03, 03-04, 03-05 (parallel, no file conflicts)
Wave 3: 03-06, 03-07 (parallel, different files)
```

## Dependency Graph

```
03-01 (types/constants)
  ├── 03-02 (mock data) ──── 03-07 (persona labels)
  ├── 03-03 (layout) ──────┐
  ├── 03-04 (renderer) ────┼── 03-06 (HiveCanvas)
  └── 03-05 (hit detect) ──┘
```

## Performance Budget (10K nodes)

| Operation | Target | Strategy |
|-----------|--------|----------|
| Layout | <10ms | O(n) hash-based, no simulation |
| Connections | <4ms | Distance cull, background cull, batch by opacity |
| Nodes | <3ms | Batch by (color, depth), skip sub-pixel |
| Hit detection | <1ms | Quadtree O(log n) |
| Parallax/frame | <0.5ms | One multiply per node |
| **Total** | **<16ms** | **60fps** |

## Files Modified (9 total)

| File | Plan | Change Type |
|------|------|-------------|
| `src/components/hive/hive-types.ts` | 03-01 | EDIT: +DepthLayer, +PersonaDemographic, +ParallaxOffset, +depthLayer field |
| `src/components/hive/hive-constants.ts` | 03-01 | EDIT: +depth config, +bezier config, +persona pools |
| `src/components/hive/hive-mock-data.ts` | 03-02 | EDIT: +totalNodeCount scaling, +persona demographics |
| `src/components/hive/hive-layout.ts` | 03-03 | EDIT: organic scatter, depth assignment, radius scaling |
| `src/components/hive/hive-renderer.ts` | 03-04 | EDIT: bezier curves, depth rendering, parallax, batching |
| `src/components/hive/hive-interaction.ts` | 03-05 | EDIT: depth-weighted hit detection |
| `src/components/hive/use-hive-interaction.ts` | 03-05 | MINIMAL: no structural changes |
| `src/components/hive/HiveCanvas.tsx` | 03-06 | EDIT: store, parallax, video overlay, dynamic data |
| `src/components/hive/HiveNodeOverlay.tsx` | 03-07 | EDIT: persona demographic pills |
| `src/app/(app)/dashboard/dashboard-client.tsx` | 03-06 | EDIT: remove static hiveData |

## Verification

1. `pnpm build` passes with no type errors
2. Dev server → dashboard → hive shows organic cloud with visible depth variation
3. Mouse movement → foreground shifts noticeably, background barely moves
4. Connections are curved with distance fade (zoom in to see)
5. Change Apollo tier → node count animates
6. Chrome DevTools Performance → 60fps at Ultra (10K)
7. Click tier-2 node → demographic pills in overlay
8. `prefers-reduced-motion` → parallax disabled, no animation
