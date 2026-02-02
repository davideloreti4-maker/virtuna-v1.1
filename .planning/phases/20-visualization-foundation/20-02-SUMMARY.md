---
phase: 20
plan: 02
subsystem: visualization
tags: [spline, 3d, react, component]
dependency-graph:
  requires: [20-01]
  provides: [SplineOrb component, Spline 3D integration]
  affects: [20-03, 21-*]
tech-stack:
  added: ["@splinetool/react-spline@4.1.0"]
  patterns: ["Spline scene loader", "loading placeholder", "error fallback"]
file-tracking:
  created:
    - src/components/visualization/SplineOrb.tsx
  modified:
    - package.json
    - package-lock.json
    - src/components/visualization/index.ts
decisions:
  - id: spline-event-naming
    choice: Use onSplineMouseDown for Spline-specific events
    context: Spline component uses SplineEvent type, not standard React mouse events
metrics:
  duration: 4min
  completed: 2026-02-02
---

# Phase 20 Plan 02: Spline Integration Setup Summary

**One-liner:** Installed @splinetool/react-spline and created SplineOrb component with loading state, error handling, and Spline event integration.

## What Was Built

### 1. Spline React Package Installation
- Installed `@splinetool/react-spline@4.1.0` via npm
- Adds 8 packages total (includes @splinetool/runtime dependency)
- Zero vulnerabilities, build passes

### 2. SplineOrb Component (`src/components/visualization/SplineOrb.tsx`)
- **111 lines** of TypeScript
- Loading state with animated gradient placeholder matching orb aesthetic
- Error fallback showing static gradient circle
- Proper TypeScript types using `SplineEvent` from package
- Integration with `VisualizationContext` for reduced motion support
- Click/tap interaction support via `onSplineMouseDown`
- CSS transition for smooth scene reveal (opacity 0.3s)

### 3. Barrel Export Update
- Added `SplineOrb` to `src/components/visualization/index.ts`

## Key Implementation Details

### SplineOrb Props Interface
```typescript
interface SplineOrbProps {
  sceneUrl: string      // Spline scene URL (.splinecode)
  onLoad?: () => void   // Called when scene finishes loading
  onTap?: () => void    // Called when orb is clicked
  className?: string    // Container styling
}
```

### Loading Placeholder
Animated gradient matching orb color palette:
```css
background: radial-gradient(
  circle,
  rgba(255,107,53,0.3) 0%,
  rgba(230,74,25,0.1) 70%,
  transparent 100%
)
```

### Spline Event Handling
Uses `onSplineMouseDown` with `SplineEvent` type (not standard React mouse event):
```typescript
const handleSplineMouseDown = useCallback((e: SplineEvent) => {
  if (e.target.name === 'orb' || e.target.name === 'Orb') {
    onTap?.()
  }
}, [onTap])
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Spline event handler type**
- **Found during:** Task 2 build verification
- **Issue:** Plan used `onMouseDown` with custom type, but Spline uses `onSplineMouseDown` with `SplineEvent`
- **Fix:** Changed to `onSplineMouseDown` and imported `SplineEvent` type
- **Files modified:** `src/components/visualization/SplineOrb.tsx`
- **Commit:** d2fe493

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 724bc8c | chore | Install @splinetool/react-spline |
| d2fe493 | feat | Create SplineOrb component |

## Verification Results

- [x] `npm ls @splinetool/react-spline` shows v4.1.0 installed
- [x] `npm run build` passes without errors
- [x] SplineOrb.tsx exists (111 lines, exceeds 30 minimum)
- [x] Import pattern `import.*@splinetool/react-spline` verified
- [x] No @ts-ignore or any workarounds needed

## Ready for Next Phase

SplineOrb component is ready to receive a Spline scene URL. Next steps:
1. User creates orb design in Spline editor
2. Export scene and provide URL to SplineOrb
3. Integrate with visualization page

## Files Changed

```
src/components/visualization/
  SplineOrb.tsx (created)     - 111 lines
  index.ts (modified)         - Added SplineOrb export

package.json (modified)       - Added @splinetool/react-spline
package-lock.json (modified)  - Lock file updated
```
