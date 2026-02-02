# Phase 20: Visualization Foundation - Research

**Researched:** 2026-02-02
**Domain:** Three.js / React Three Fiber / WebGL Shaders / Organic Blob Animation
**Confidence:** MEDIUM-HIGH

## Summary

This phase establishes the visual foundation using Three.js and React Three Fiber (R3F) to create an organic, morphing orb effect matching the [Dribbble reference](https://dribbble.com/shots/24801507-Relax-Ai-Motion-Visual). The reference shows a glass-like sphere with:
- Organic blob morphing (jelly/liquid deformation)
- Multi-layer translucent glass effect
- Gradient colors (orange core to coral to pink to magenta/purple rim)
- Fresnel rim lighting (strong pink/purple edge glow)
- Internal swirling flow patterns
- Non-metronomic organic motion (~3-5s cycle)

The standard approach combines: **R3F for React integration**, **vertex displacement shaders with simplex noise** for blob morphing, **MeshTransmissionMaterial** or custom shaders for glass/refraction, **Fresnel shaders** for rim lighting, and **layered materials (Lamina or custom)** for color gradients. Camera controls from Drei replace react-zoom-pan-pinch for better R3F integration.

**Primary recommendation:** Use `@react-three/fiber` v9+ with `@react-three/drei` for MeshTransmissionMaterial and camera controls, custom vertex shaders with `simplex-noise` for blob morphing, and Fresnel-based rim lighting for the gradient glow effect.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | ^0.170+ | 3D rendering engine | Industry standard, 2.7M weekly downloads |
| @react-three/fiber | ^9.5+ | React renderer for Three.js | Official React bindings, pairs with React 19 |
| @react-three/drei | ^10.7+ | R3F helper components | MeshTransmissionMaterial, controls, utilities |
| simplex-noise | ^4.x | Organic noise generation | Fast, typed, no dependencies, 70M calls/sec |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/three | ^0.170+ | TypeScript definitions | Development type safety |
| three-custom-shader-material | ^5.x | Extend built-in materials with custom shaders | If MeshPhysicalMaterial needs vertex modification |
| alea | ^1.x | Seedable PRNG | Reproducible noise patterns |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MeshTransmissionMaterial | Custom raymarching shader | More control but significantly more complex |
| simplex-noise | Three.js SimplexNoise addon | simplex-noise is faster and better typed |
| Lamina layers | Custom multi-pass shaders | Lamina is archived (June 2025), custom is more future-proof |
| OrbitControls | MapControls | MapControls for 2D pan, OrbitControls for 3D rotation |

**Installation:**
```bash
pnpm add three @react-three/fiber @react-three/drei simplex-noise
pnpm add -D @types/three
```

**Next.js Configuration (next.config.js):**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three'],
}
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── visualization/
│       ├── GlassOrb.tsx           # Main orb component with shaders
│       ├── OrbMaterial.tsx        # Custom shader material
│       ├── VisualizationCanvas.tsx # R3F Canvas wrapper (client component)
│       └── shaders/
│           ├── orbVertex.glsl     # Vertex displacement shader
│           └── orbFragment.glsl   # Fragment shader with gradient
├── hooks/
│   ├── usePrefersReducedMotion.ts # Accessibility hook
│   └── useOrbAnimation.ts         # Animation state management
└── lib/
    └── noise.ts                   # Noise utilities with createNoise3D
```

### Pattern 1: Client Component Canvas Wrapper

**What:** R3F Canvas must be a client component in Next.js App Router
**When to use:** Always for R3F in Next.js
**Example:**
```typescript
// Source: https://r3f.docs.pmnd.rs/getting-started/installation
'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { GlassOrb } from './GlassOrb'

export function VisualizationCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      }}
    >
      <Suspense fallback={null}>
        <GlassOrb />
      </Suspense>
    </Canvas>
  )
}
```

### Pattern 2: useFrame for Animation with Delta Time

**What:** Frame-rate independent animations using delta time
**When to use:** All continuous animations
**Example:**
```typescript
// Source: https://r3f.docs.pmnd.rs/tutorials/basic-animations
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

export function AnimatedOrb() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }, delta) => {
    if (materialRef.current) {
      // Use elapsed time for smooth animation
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 64]} />
      <shaderMaterial ref={materialRef} />
    </mesh>
  )
}
```

### Pattern 3: Vertex Displacement with Noise

**What:** Displace sphere vertices using 3D noise for organic morphing
**When to use:** Creating blob/jelly deformation effects
**Example:**
```glsl
// Source: https://www.clicktorelease.com/blog/vertex-displacement-noise-3d-webgl-glsl-three-js/
// Vertex shader

uniform float uTime;
uniform float uNoiseScale;
uniform float uNoiseStrength;

varying vec3 vNormal;
varying float vDisplacement;

// Include 3D noise function (cnoise or snoise)

void main() {
  vNormal = normalize(normalMatrix * normal);

  // Sample 3D noise at vertex position + time offset
  vec3 noisePos = position * uNoiseScale + vec3(uTime * 0.3);
  float noise = cnoise(noisePos);

  // Additional low-frequency noise for larger shapes
  float largeNoise = cnoise(position * 0.5 + vec3(uTime * 0.1)) * 0.5;

  // Combine noise values
  vDisplacement = noise * 0.5 + largeNoise;

  // Displace along normal direction
  vec3 newPosition = position + normal * vDisplacement * uNoiseStrength;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
```

### Pattern 4: Fresnel Rim Lighting

**What:** Glow intensity based on viewing angle (brighter at edges)
**When to use:** Creating edge glow / rim light effects
**Example:**
```glsl
// Source: https://threejsroadmap.com/blog/rim-lighting-shader
// Fragment shader

uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uRimIntensity;

varying vec3 vNormal;

void main() {
  // Calculate fresnel term
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = 1.0 - dot(viewDirection, vNormal);
  fresnel = pow(fresnel, uRimPower);

  // Apply rim color
  vec3 rimLight = uRimColor * fresnel * uRimIntensity;

  gl_FragColor = vec4(baseColor + rimLight, 1.0);
}
```

### Anti-Patterns to Avoid

- **Using setState in useFrame:** Never use React state for per-frame updates. Use refs and direct mutation for 60fps performance.
- **Creating materials/geometries inside components:** Define reusable geometries and materials outside the component or memoize them to avoid GPU overhead on every render.
- **Linear animations without delta:** Always use `delta` or `clock.getElapsedTime()` for frame-rate independent animations.
- **Forgetting 'use client' directive:** R3F components MUST be client components in Next.js App Router.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glass/transmission material | Custom raymarching shader | MeshTransmissionMaterial from drei | Handles chromatic aberration, refraction, and performance optimizations |
| Noise functions in GLSL | Inline noise implementations | Import from `simplex-noise` or use glsl-noise library | Optimized, well-tested, consistent results |
| Camera controls | Custom pan/zoom handlers | OrbitControls or CameraControls from drei | Touch support, damping, bounds built-in |
| Reduced motion detection | Manual matchMedia logic | `usePrefersReducedMotion` hook pattern | Handles SSR, updates on OS setting change |
| Frame loop management | Custom requestAnimationFrame | R3F's useFrame hook | Automatically integrates with React lifecycle |

**Key insight:** Three.js and Drei have solved most common 3D rendering problems. Custom shaders are only needed for the specific blob morphing vertex displacement and color gradient logic.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Canvas

**What goes wrong:** Next.js SSR renders different output than client, causing hydration errors
**Why it happens:** Canvas and WebGL context only exist on client
**How to avoid:** Always use `'use client'` directive, wrap in Suspense, use dynamic import with `ssr: false` if needed
**Warning signs:** Console errors about hydration, blank canvas on initial load

### Pitfall 2: Performance Death by Re-renders

**What goes wrong:** 60fps drops to 10fps, laggy animations
**Why it happens:** Using React state for animation values triggers component re-renders
**How to avoid:** Use refs exclusively for animated values, mutate directly in useFrame
**Warning signs:** React DevTools showing constant re-renders during animation

```typescript
// BAD - triggers re-render every frame
const [rotation, setRotation] = useState(0)
useFrame(() => setRotation(r => r + 0.01))

// GOOD - direct mutation via ref
const meshRef = useRef<THREE.Mesh>(null)
useFrame(() => { meshRef.current!.rotation.x += 0.01 })
```

### Pitfall 3: MeshTransmissionMaterial Performance

**What goes wrong:** Severe frame drops on mobile, GPU overheating
**Why it happens:** MeshTransmissionMaterial renders an extra pass of the entire scene
**How to avoid:** Use low `resolution` (32-128px), reduce `samples` (2-4), consider `transmissionSampler: true` for shared buffer
**Warning signs:** GPU usage spikes, thermal throttling on mobile

```typescript
// Performance-optimized transmission material
<MeshTransmissionMaterial
  resolution={64}
  samples={4}
  transmission={0.95}
  thickness={0.5}
  roughness={0.1}
/>
```

### Pitfall 4: Shader Uniform Updates

**What goes wrong:** Animations don't update, or update inconsistently
**Why it happens:** Forgetting `needsUpdate` flags or not using refs properly
**How to avoid:** Store material in ref, update uniforms directly each frame
**Warning signs:** Static appearance despite useFrame running

### Pitfall 5: Mobile WebGL Thermal Throttling

**What goes wrong:** Performance degrades over time on mobile
**Why it happens:** High GPU load causes device to thermal throttle
**How to avoid:** Use `powerPreference: 'high-performance'`, reduce shader complexity on mobile, detect device capability with `PerformanceMonitor`
**Warning signs:** Smooth initially, then gradually slows down

## Code Examples

### Complete Blob Orb Component

```typescript
// Source: Composite from multiple official docs
'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

// Vertex shader with noise displacement
const vertexShader = `
  uniform float uTime;
  uniform float uNoiseScale;
  uniform float uNoiseStrength;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  // Classic Perlin 3D Noise (include full implementation)
  // ... noise function here ...

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    // Multi-octave noise for organic feel
    float noise1 = cnoise(position * uNoiseScale + uTime * 0.2) * 0.6;
    float noise2 = cnoise(position * uNoiseScale * 2.0 + uTime * 0.3) * 0.3;
    float noise3 = cnoise(position * uNoiseScale * 4.0 + uTime * 0.4) * 0.1;

    vDisplacement = noise1 + noise2 + noise3;

    vec3 newPosition = position + normal * vDisplacement * uNoiseStrength;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

// Fragment shader with gradient and fresnel
const fragmentShader = `
  uniform vec3 uColorCore;      // Orange
  uniform vec3 uColorMid;       // Coral/Pink
  uniform vec3 uColorRim;       // Magenta/Purple
  uniform float uFresnelPower;
  uniform float uFresnelIntensity;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  void main() {
    // Fresnel calculation
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = 1.0 - max(dot(viewDirection, vNormal), 0.0);
    fresnel = pow(fresnel, uFresnelPower);

    // Gradient based on fresnel (center to rim)
    vec3 color = mix(uColorCore, uColorMid, fresnel * 0.5);
    color = mix(color, uColorRim, fresnel);

    // Add rim glow
    color += uColorRim * fresnel * uFresnelIntensity;

    // Slight variation based on displacement
    color += vec3(vDisplacement * 0.1);

    gl_FragColor = vec4(color, 0.9);
  }
`

interface GlassOrbProps {
  reducedMotion?: boolean
}

export function GlassOrb({ reducedMotion = false }: GlassOrbProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNoiseScale: { value: 1.5 },
    uNoiseStrength: { value: 0.15 },
    uColorCore: { value: new THREE.Color('#FF6B35') },    // Orange
    uColorMid: { value: new THREE.Color('#FF8E72') },     // Coral
    uColorRim: { value: new THREE.Color('#C850C0') },     // Magenta
    uFresnelPower: { value: 2.5 },
    uFresnelIntensity: { value: 0.8 },
  }), [])

  useFrame(({ clock }) => {
    if (materialRef.current && !reducedMotion) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh>
      <icosahedronGeometry args={[1.5, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
```

### usePrefersReducedMotion Hook

```typescript
// Source: https://www.joshwcomeau.com/react/prefers-reduced-motion/
import { useState, useEffect } from 'react'

const QUERY = '(prefers-reduced-motion: no-preference)'

export function usePrefersReducedMotion(): boolean {
  // Default to reduced motion for SSR safety
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(QUERY)
    setPrefersReducedMotion(!mediaQueryList.matches)

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(!event.matches)
    }

    mediaQueryList.addEventListener('change', listener)
    return () => mediaQueryList.removeEventListener('change', listener)
  }, [])

  return prefersReducedMotion
}
```

### Camera Controls Setup

```typescript
// Source: https://drei.docs.pmnd.rs/controls/introduction
'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'

export function VisualizationCanvas() {
  return (
    <Canvas>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={false}  // 2D-style for this use case
        minDistance={3}
        maxDistance={10}
        // Touch support is built-in
      />
      {/* Orb and other scene elements */}
    </Canvas>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-zoom-pan-pinch with Canvas 2D | R3F with OrbitControls/CameraControls | 2024+ | Better WebGL integration, touch support built-in |
| Lamina for layered materials | Custom shaders or MeshTransmissionMaterial | June 2025 (archived) | Need alternative for gradient layers |
| @react-three/fiber v8 | @react-three/fiber v9 | 2024 | Required for React 19, new scheduler |
| WebGL only | WebGPU support emerging | 2025 | Better mobile performance, but WebGL still primary |
| Manual transmission shaders | MeshTransmissionMaterial | 2023 | Simplified glass effects with good performance |

**Deprecated/outdated:**
- **Lamina:** Archived June 2025, needs maintenance. Use custom shaders or MeshTransmissionMaterial with shader injection instead.
- **R3F v8 with React 19:** Not compatible. Must use v9.
- **three.js build files (build/three.js):** Removed in r160, use ES modules.

## Open Questions

1. **Internal flow/vortex effect complexity**
   - What we know: Possible via TSL shaders or particle systems inside glass sphere
   - What's unclear: Performance impact on mobile, whether simpler approximation suffices
   - Recommendation: Start with simpler gradient-based "fake depth" effect, iterate if needed

2. **MeshTransmissionMaterial vs custom shader for final look**
   - What we know: MTM provides refraction easily, custom gives more control over gradient
   - What's unclear: Exact visual match to reference may require custom approach
   - Recommendation: Prototype both, compare visual quality and performance

3. **WebGPU adoption timeline**
   - What we know: Safari iOS supports WebGPU as of Sept 2025
   - What's unclear: User device adoption rate, R3F v10 stability
   - Recommendation: Target WebGL for now, WebGPU as future enhancement

## Sources

### Primary (HIGH confidence)
- [R3F Installation Docs](https://r3f.docs.pmnd.rs/getting-started/installation) - Setup, Next.js config, version compatibility
- [R3F Basic Animations](https://r3f.docs.pmnd.rs/tutorials/basic-animations) - useFrame, delta time, refs
- [R3F Scaling Performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance) - On-demand rendering, instancing, optimization
- [Drei MeshTransmissionMaterial](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material) - Glass material API
- [Drei Controls](https://drei.docs.pmnd.rs/controls/introduction) - OrbitControls, CameraControls, touch support
- [simplex-noise GitHub](https://github.com/jwagner/simplex-noise.js) - API, createNoise3D, seeding

### Secondary (MEDIUM confidence)
- [Codrops Displaced Sphere](https://tympanus.net/codrops/2024/07/09/creating-an-animated-displaced-sphere-with-a-custom-three-js-material/) - Vertex displacement, normal recalculation
- [Codrops Vortex in Glass Sphere](https://tympanus.net/codrops/2025/03/10/rendering-a-procedural-vortex-inside-a-glass-sphere-with-three-js-and-tsl/) - Internal effect techniques
- [Clicktorelease Vertex Displacement](https://www.clicktorelease.com/blog/vertex-displacement-noise-3d-webgl-glsl-three-js/) - Classic noise displacement tutorial
- [Fresnel Shader Material GitHub](https://github.com/otanodesignco/Fresnel-Shader-Material) - Rim lighting implementation
- [Josh Comeau Reduced Motion](https://www.joshwcomeau.com/react/prefers-reduced-motion/) - Accessibility hook pattern
- [Lamina GitHub](https://github.com/pmndrs/lamina) - Layer-based materials (ARCHIVED)

### Tertiary (LOW confidence)
- [Three.js Roadmap Blog](https://threejsroadmap.com/blog/rim-lighting-shader) - Rim lighting concepts
- [Maxime Heckel Shaders](https://blog.maximeheckel.com/posts/the-study-of-shaders-with-react-three-fiber/) - Shader study with R3F
- WebSearch results for mobile optimization patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation verified for all core libraries
- Architecture patterns: HIGH - Based on official R3F docs and tutorials
- Shader techniques: MEDIUM - Composite from multiple sources, needs implementation validation
- Mobile performance: MEDIUM - General patterns verified, specific device testing needed
- Internal flow effect: LOW - Complex technique, may require iteration

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - R3F ecosystem is stable but evolving)
