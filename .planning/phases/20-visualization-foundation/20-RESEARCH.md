# Phase 20: Visualization Foundation - Research (FINAL)

**Researched:** 2026-02-02 (Final revision after user decision)
**Domain:** Spline 3D / React Integration / Glass Orb Effects
**Confidence:** HIGH

## Summary

After multiple failed attempts with custom GLSL shaders and R3F materials, and researching available high-quality solutions, **Spline 3D** was selected as the approach for creating the glass orb visualization.

**Why Spline:**
1. Visual design tool — design exactly what you want, no shader guessing
2. Pre-built glass materials — handles transmission, IOR, refraction properly
3. Community templates — [Glass Orb with animated blur](https://community.spline.design/file/82165fc2-53fa-49aa-8f4c-ed90880f1a66) already exists
4. Direct React export — `@splinetool/react-spline` for Next.js integration
5. Events/interactions — hover, click, scroll triggers supported in React export

**Primary recommendation:** Design the orb in Spline using their liquid glass materials, add animations/states (idle, processing, etc.), export to React with `@splinetool/react-spline`.

## What Failed Previously

### Attempt 1: Canvas 2D
- Flat 2D rendering, no 3D depth
- Abandoned for Three.js

### Attempt 2: R3F with Custom GLSL + Dual Meshes
- Flat appearance (no true glass)
- Inner sphere artifacts (z-fighting)
- Colors wrong (magenta dominated)
- No internal flow
- Morphing too harsh

### Attempt 3: MeshTransmissionMaterial + CSM (Research phase, not implemented)
- Complex setup with CSM extending transmission materials
- Uncertain compatibility
- Still requires visual tuning
- Mobile fallback complexity

**Key insight:** Building production-quality glass effects from scratch is hard. Professional tools like Spline have solved this problem with visual design + export.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @splinetool/react-spline | ^2.3+ | Spline scene renderer | Official React integration |
| three | ^0.182.0 | 3D rendering (already installed) | R3F dependency |
| @react-three/fiber | ^9.5.0 | React renderer (already installed) | Canvas wrapper |

### Supporting (for potential R3F fallback)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-three/drei | ^10.7.7 | MeshTransmissionMaterial | If Spline fallback needed |

**Installation:**
```bash
pnpm add @splinetool/react-spline
```

## Architecture Patterns

### Pattern 1: Spline Scene Export

**What:** Design in Spline app, export to React component
**When to use:** Always for this project (primary approach)

```typescript
// Source: https://docs.spline.design/exporting-your-scene/web/exporting-as-code
'use client'

import Spline from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'
import { useRef } from 'react'

interface GlassOrbProps {
  onLoad?: () => void
}

export function GlassOrb({ onLoad }: GlassOrbProps) {
  const splineRef = useRef<Application>()

  function handleLoad(spline: Application) {
    splineRef.current = spline
    onLoad?.()
  }

  return (
    <Spline
      scene="https://prod.spline.design/YOUR_SCENE_ID/scene.splinecode"
      onLoad={handleLoad}
    />
  )
}
```

### Pattern 2: Spline Events Integration

**What:** Connect Spline events to React state
**When to use:** For interactive states (hover, processing, etc.)

```typescript
import Spline from '@splinetool/react-spline'
import type { SplineEvent } from '@splinetool/runtime'

export function GlassOrb() {
  function handleMouseDown(e: SplineEvent) {
    if (e.target.name === 'orb') {
      // Trigger processing state
    }
  }

  function handleMouseHover(e: SplineEvent) {
    // Show tooltip or highlight
  }

  return (
    <Spline
      scene="YOUR_SCENE_URL"
      onMouseDown={handleMouseDown}
      onMouseHover={handleMouseHover}
    />
  )
}
```

### Pattern 3: Self-Hosted Spline Files

**What:** Download .splinecode file and serve locally
**When to use:** Avoid CORS issues, faster loading, offline support

```typescript
// Download from Spline code export panel (download icon)
// Place in /public/spline/orb.splinecode

<Spline scene="/spline/orb.splinecode" />
```

### Pattern 4: Next.js SSR Placeholder

**What:** Use @splinetool/react-spline/next for SSR
**When to use:** Always in Next.js for better UX

```typescript
import Spline from '@splinetool/react-spline/next'

// Automatically renders blurred placeholder during SSR
// Hydrates to full 3D scene on client
```

### Project Structure

```
src/components/visualization/
├── VisualizationCanvas.tsx     # Canvas wrapper (DONE - can be simplified)
├── VisualizationContext.tsx    # Context provider (DONE)
├── GlassOrb/
│   ├── index.tsx               # Spline orb component
│   └── SplineOrb.tsx           # Spline scene loader
├── hooks/
│   ├── usePrefersReducedMotion.ts  # (DONE)
│   └── useIsMobile.ts              # (DONE)
└── index.ts                    # Barrel exports

public/spline/
└── orb.splinecode              # Self-hosted Spline file (optional)
```

## Spline Design Guide

### Creating the Glass Orb in Spline

**Resources:**
- [Glass Orb Community Template](https://community.spline.design/file/82165fc2-53fa-49aa-8f4c-ed90880f1a66) — Start here, customize
- [Liquid Glass Tutorial](https://spline.design/tutorials/gnhUypBNMc0-creating-liquid-glass-with-spline-in-3d)
- [Creating Interactive Spheres](https://spline.design/tutorials/P2bv2mn7bCk-creating-interactive-reactive-spheres-in-3d)

**Material Settings for Glass:**
```
Lighting Mode: Physical
Roughness: 0.05-0.1 (low for glass clarity)
Metalness: 0 (glass is not metallic)
Color: White or slight pink tint
Glass Layer: Enable for refraction
Transmission: High (0.9+)
```

**Animation States to Create:**
1. **Idle** — Subtle breathing pulse (2.5s cycle), slow blob morphing
2. **Hover** — 30% glow boost, slight scale up (1.02x)
3. **Processing** — Faster internal motion, color shift
4. **Complete** — Flash/pulse feedback

**Exporting:**
1. Click Export button
2. Select "Code" → "React"
3. Copy URL or download .splinecode file
4. Optionally add events in Spline before export

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glass material | Custom GLSL shaders | Spline glass material | Visual tuning, proven results |
| Blob morphing | Vertex displacement math | Spline shape blend | Visual animation curves |
| Internal glow | Nested meshes/emissive | Spline blur layer | No z-fighting |
| State animations | useFrame timers | Spline states/events | Designer-friendly |

**Key insight:** Spline eliminates the shader debugging cycle. What you see in the editor is what renders in React.

## Common Pitfalls

### Pitfall 1: Using CDN URL Without Fallback
**What goes wrong:** Scene fails to load, blank space
**How to avoid:** Self-host .splinecode file, add loading state
**Warning signs:** Random loading failures, CORS errors

### Pitfall 2: Large Scene File Size
**What goes wrong:** Slow initial load, bad LCP
**How to avoid:** Optimize in Spline (reduce geometry, bake textures), use SSR placeholder
**Warning signs:** Bundle size > 1MB, slow TTI

### Pitfall 3: Missing Reduced Motion Support
**What goes wrong:** Accessibility violation, motion sickness
**How to avoid:** Create static state in Spline, trigger via `prefers-reduced-motion`
**Warning signs:** Continuous animation with no way to stop

### Pitfall 4: Trying to Mix Spline + R3F Scenes
**What goes wrong:** Two WebGL contexts, performance issues
**How to avoid:** Use Spline OR R3F, not both for the same visualization
**Warning signs:** Multiple canvas elements, doubled GPU usage

## Performance Strategy

### Desktop
- Full Spline scene with all animations
- Self-hosted .splinecode for fast loading

### Mobile
- Same Spline scene (Spline optimizes for mobile)
- If issues: Create separate mobile-optimized scene
- Consider `prefers-reduced-motion` → static scene

### Loading Optimization
```typescript
import dynamic from 'next/dynamic'

// Lazy load Spline component
const GlassOrb = dynamic(
  () => import('./GlassOrb').then(mod => mod.GlassOrb),
  {
    ssr: false,
    loading: () => <div className="orb-placeholder" />
  }
)
```

## Integration with Existing Infrastructure

The existing R3F infrastructure (VisualizationCanvas, VisualizationContext) can be:

**Option A: Replace with Spline**
- Remove R3F Canvas wrapper
- Use Spline directly
- Simpler, fewer dependencies

**Option B: Keep R3F for Future**
- Keep VisualizationCanvas as container
- Render Spline inside (separate canvas)
- Allows future R3F components (particles)

**Recommendation:** Option A for Phase 20, revisit for Phase 21 particles.

## Open Questions

1. **Spline file size**
   - What we know: Typical scenes are 200KB-2MB
   - What's unclear: Exact size of the glass orb scene
   - Recommendation: Optimize in Spline, lazy load, measure LCP

2. **Animation state control from React**
   - What we know: Events work, can call `spline.setVariable()`
   - What's unclear: Best pattern for state-driven animations
   - Recommendation: Create states in Spline, trigger via React events

3. **Mobile WebGL limits**
   - What we know: Spline generally works on mobile
   - What's unclear: Specific performance on low-end devices
   - Recommendation: Test on real devices, have fallback ready

## Sources

### Primary (HIGH confidence)
- [Spline React Documentation](https://docs.spline.design/exporting-your-scene/web/exporting-as-code) - Official export guide
- [@splinetool/react-spline GitHub](https://github.com/splinetool/react-spline) - API reference
- [Glass Orb Community File](https://community.spline.design/file/82165fc2-53fa-49aa-8f4c-ed90880f1a66) - Starting template

### Secondary (MEDIUM confidence)
- [Liquid Glass Tutorial](https://spline.design/tutorials/gnhUypBNMc0-creating-liquid-glass-with-spline-in-3d) - Glass material techniques
- [Creating Interactive Spheres](https://spline.design/tutorials/P2bv2mn7bCk-creating-interactive-reactive-spheres-in-3d) - Events and states
- [3D Reflective Glass Tutorial](https://splinetime3d.substack.com/p/3d-reflective-glass-spline-tutorial) - Material settings

### Alternative Solutions (if Spline doesn't work out)
- [ElevenLabs UI Orb](https://ui.elevenlabs.io/docs/components/orb) - Production Three.js orb
- [react-ai-orb](https://github.com/Steve0929/react-ai-orb) - Simple CSS/Canvas orb
- [ReactBits Orb](https://www.reactbits.dev/backgrounds/orb) - OGL shader orb

## Metadata

**Confidence breakdown:**
- Spline integration: HIGH - Official React support, well-documented
- Glass material quality: HIGH - Visual tool, WYSIWYG
- Mobile performance: MEDIUM - Generally good, needs testing
- Animation state control: MEDIUM - Documented but complex patterns

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days)
**Supersedes:** All previous 20-RESEARCH.md versions
