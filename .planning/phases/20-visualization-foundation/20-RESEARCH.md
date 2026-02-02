# Phase 20: Visualization Foundation - Research (REVISED)

**Researched:** 2026-02-02 (Re-research after failed attempts)
**Domain:** Three.js / React Three Fiber / Glass Materials / Volumetric Effects
**Confidence:** MEDIUM-HIGH

## Summary

This re-research addresses the **failed attempts** at creating the glass orb effect matching the [Dribbble reference](https://dribbble.com/shots/24801507-Relax-Ai-Motion-Visual). The previous approach using dual meshes (inner core + outer shell) with basic fresnel shaders created a flat, solid-colored blob with visual artifacts instead of the desired translucent glass orb with glowing interior.

**Key insight from failures:** The reference is NOT achievable with simple fresnel rim glow on opaque meshes. It requires:
1. True light transmission through glass (MeshTransmissionMaterial or MeshPhysicalMaterial with transmission)
2. Volumetric/emissive internal glow (not a second mesh — causes artifacts)
3. Proper normal recalculation after vertex displacement
4. Environment lighting for realistic glass reflections

**Primary recommendation:** Use a **single-mesh approach** with MeshTransmissionMaterial for the glass shell combined with FakeGlowMaterial for the inner glow as a separate "aura" mesh (not nested inside). For mobile, fall back to a lightweight shader-based approach without real transmission.

## What Failed and Why

### Attempt 1: Canvas 2D
- **Problem:** Flat 2D rendering, no real 3D depth
- **Root cause:** Canvas 2D cannot render volumetric light effects or true 3D

### Attempt 2: R3F with Dual Meshes + Custom GLSL
**Architecture tried:**
- Inner opaque sphere (orange glowing core)
- Outer transparent sphere (fresnel rim glow)
- Custom vertex displacement with noise

**Problems identified:**
| Problem | Root Cause | Solution |
|---------|-----------|----------|
| Flat appearance | No light transmission, just alpha transparency | MeshTransmissionMaterial with IOR/transmission |
| Inner sphere artifacts | Two meshes with overlapping render order | Single mesh OR proper depth sorting |
| Colors wrong (magenta dominated) | Fresnel formula weighted rim over core | Balanced gradient with proper falloff |
| No internal flow | Static inner mesh, no animation | Animated noise texture or particle system |
| Morphing too harsh | No normal recalculation after displacement | Use CSM with tangent-based normals |
| No true glass effect | Missing refraction, IOR, thickness | MeshTransmissionMaterial or PhysicalMaterial |

## Standard Stack (Updated)

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | ^0.182.0 | 3D rendering engine | Already installed, stable |
| @react-three/fiber | ^9.5.0 | React renderer for Three.js | Already installed |
| @react-three/drei | ^10.7.7 | MeshTransmissionMaterial, controls | Already installed |
| three-custom-shader-material | ^6.x | Extend materials with vertex displacement | **NEW** - essential for blob morphing on transmission materials |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-three/postprocessing | ^3.x | Selective bloom for glow | Optional - if FakeGlowMaterial not sufficient |
| simplex-noise | ^4.x | Organic noise generation | For vertex displacement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MeshTransmissionMaterial | MeshPhysicalMaterial + transmission | Less control, no chromatic aberration |
| FakeGlowMaterial | Bloom post-processing | FakeGlowMaterial is more performant |
| CSM for displacement | onBeforeCompile | CSM is cleaner, more maintainable |

**Installation (new packages only):**
```bash
pnpm add three-custom-shader-material
```

## Architecture Patterns (Revised)

### Pattern 1: Single Glass Mesh with External Glow Aura

**What:** One transmission mesh for glass + one larger "aura" mesh behind it for inner glow illusion
**Why:** Avoids dual-mesh artifacts. The glow mesh sits BEHIND the glass, not inside.

```
Scene structure:
├── Glow Aura Mesh (FakeGlowMaterial, scale: 0.85, behind glass)
├── Glass Orb Mesh (MeshTransmissionMaterial + CSM vertex displacement)
└── Environment (HDRI for realistic reflections)
```

**Key difference from failed attempt:** The glow is NOT a nested inner sphere. It's a background element that shows THROUGH the glass transmission.

### Pattern 2: Proper Vertex Displacement with Normal Recalculation

**What:** Use tangent-based normal calculation after vertex displacement
**Why:** Prevents "flat shading" look on displaced geometry

```glsl
// Vertex shader with proper normal recalculation
attribute vec4 tangent;

void main() {
  // Calculate bitangent from normal and tangent
  vec3 biTangent = cross(normal, tangent.xyz);
  float shift = 0.01;

  // Sample neighbor positions
  vec3 posA = position + tangent.xyz * shift;
  vec3 posB = position + biTangent * shift;

  // Apply displacement to all three positions
  float disp = getDisplacement(position);
  float dispA = getDisplacement(posA);
  float dispB = getDisplacement(posB);

  csm_Position = position + normal * disp;
  posA += normal * dispA;
  posB += normal * dispB;

  // Calculate new normal from displaced neighbors
  vec3 toA = normalize(posA - csm_Position);
  vec3 toB = normalize(posB - csm_Position);
  csm_Normal = normalize(cross(toA, toB));
}
```

**Source:** [Codrops Displaced Sphere Tutorial](https://tympanus.net/codrops/2024/07/09/creating-an-animated-displaced-sphere-with-a-custom-three-js-material/)

### Pattern 3: Environment-Dependent Glass

**What:** Glass materials REQUIRE environment maps for realism
**Why:** Without environment, transmission materials look dull/wrong

```typescript
// Canvas setup with environment
import { Environment } from '@react-three/drei'

<Canvas>
  <Environment preset="studio" /> {/* Or custom HDRI */}
  <GlassOrb />
</Canvas>
```

### Pattern 4: Mobile Fallback Material

**What:** Detect mobile and use simpler material without transmission
**Why:** MeshTransmissionMaterial causes extra render pass, expensive on mobile

```typescript
const { isMobile } = useVisualization()

// Desktop: Full transmission
// Mobile: Basic physical material with emissive
const Material = isMobile
  ? MobileFallbackMaterial
  : TransmissionGlassMaterial
```

### Project Structure (Revised)

```
src/components/visualization/
├── VisualizationCanvas.tsx     # Canvas wrapper (DONE)
├── VisualizationContext.tsx    # Context provider (DONE)
├── GlassOrb/
│   ├── index.tsx               # Main component, switches materials
│   ├── TransmissionOrb.tsx     # Desktop: MeshTransmissionMaterial + CSM
│   ├── MobileOrb.tsx           # Mobile: Simplified shader
│   ├── GlowAura.tsx            # FakeGlowMaterial background glow
│   └── shaders/
│       ├── displacement.glsl.ts # Shared vertex displacement
│       └── noise.glsl.ts        # Perlin/Simplex noise functions
└── hooks/
    ├── usePrefersReducedMotion.ts  # (DONE)
    └── useIsMobile.ts              # (DONE)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glass transmission | Alpha blending + fresnel | MeshTransmissionMaterial | Handles IOR, refraction, thickness properly |
| Inner glow effect | Nested inner sphere | FakeGlowMaterial as background | Avoids z-fighting and artifacts |
| Normal recalculation | Manual normal calculation | CSM with tangent attributes | Well-tested, handles edge cases |
| Noise functions | Inline GLSL noise | simplex-noise library | Fast, typed, consistent |
| Post-processing glow | Custom bloom shader | @react-three/postprocessing | Battle-tested, performant |
| Mobile detection | navigator.userAgent parsing | useIsMobile hook (exists) | SSR-safe, React-friendly |

**Key insight:** The failed attempt hand-rolled too much. MeshTransmissionMaterial and FakeGlowMaterial exist precisely because glass effects are hard to get right.

## Common Pitfalls (Lessons from Failure)

### Pitfall 1: Dual Nested Meshes for Core + Shell
**What goes wrong:** Orange patches, z-fighting, wrong depth perception
**Why it happens:** Two transparent/semi-transparent meshes at similar depths confuse depth buffer
**How to avoid:** Single glass mesh + EXTERNAL glow aura (behind, not inside)
**Warning signs:** Flickering, color bleeding, patches of wrong color showing through

### Pitfall 2: Fresnel-Only Glass Effect
**What goes wrong:** Looks like colored plastic, not glass
**Why it happens:** Fresnel only affects rim brightness, not light transmission
**How to avoid:** Use MeshTransmissionMaterial with proper IOR (1.5), thickness, transmission
**Warning signs:** No refraction, no "looking through" effect

### Pitfall 3: Missing Environment Lighting
**What goes wrong:** Transmission materials appear completely black or weird colors
**Why it happens:** Glass reflects/refracts environment — no environment = nothing to show
**How to avoid:** Always add `<Environment preset="..." />` or HDRI
**Warning signs:** Black glass, no reflections, dull appearance

### Pitfall 4: Vertex Displacement Without Normal Update
**What goes wrong:** Lighting looks wrong, flat shaded appearance despite smooth geometry
**Why it happens:** Normals still point as if sphere were undisplaced
**How to avoid:** Use CSM with tangent-based normal recalculation (see Pattern 2)
**Warning signs:** Faceted look, lighting doesn't follow surface curvature

### Pitfall 5: MeshTransmissionMaterial on Mobile
**What goes wrong:** 15fps, device heating, battery drain
**Why it happens:** Transmission requires extra scene render pass per frame
**How to avoid:** Device detection → use simplified fallback material
**Warning signs:** GPU 100%, thermal throttling, frame drops

### Pitfall 6: Additive Blending for Glass
**What goes wrong:** Colors add up to white/magenta, unrealistic glow
**Why it happens:** Additive blending is for glow effects, not glass
**How to avoid:** Normal alpha blending for glass, additive only for external glow
**Warning signs:** Bright magenta/white edges, colors don't mix naturally

## Code Examples

### MeshTransmissionMaterial Configuration for Glass Orb

```typescript
// Source: https://drei.docs.pmnd.rs/shaders/mesh-transmission-material
import { MeshTransmissionMaterial } from '@react-three/drei'

<mesh>
  <icosahedronGeometry args={[1.5, 64]} />
  <MeshTransmissionMaterial
    // Core transmission properties
    transmission={0.98}           // Near-full transparency
    thickness={0.5}               // Refraction depth
    roughness={0.05}              // Slight surface roughness for realism
    ior={1.5}                     // Index of refraction (glass = 1.5)

    // Visual effects
    chromaticAberration={0.02}    // Subtle color fringing
    anisotropicBlur={0.1}         // Blur for soft internal look

    // Color tinting
    color="#FFE4E1"               // Subtle pink tint

    // Performance (CRITICAL for mobile)
    resolution={256}              // Lower = faster (try 64-128 on mobile)
    samples={4}                   // Lower = faster

    // Backside rendering for full glass effect
    backside={true}
    backsideThickness={0.3}
  />
</mesh>
```

### FakeGlowMaterial for Inner Glow Aura

```typescript
// Source: https://github.com/ektogamat/fake-glow-material-r3f
// Create a TypeScript version based on the gist

interface FakeGlowMaterialProps {
  falloff?: number        // 0.0-1.0, default 0.1
  glowInternalRadius?: number  // default 6.0
  glowColor?: string      // hex color
  glowSharpness?: number  // 0.0-1.0
  opacity?: number        // 0.0-1.0
}

// Usage: Place BEHIND the glass orb
<mesh scale={0.85} position={[0, 0, -0.1]}>
  <sphereGeometry args={[1.5, 32, 32]} />
  <FakeGlowMaterial
    falloff={0.3}
    glowInternalRadius={4.0}
    glowColor="#FF6B35"   // Orange core glow
    glowSharpness={0.2}
    opacity={0.9}
  />
</mesh>
```

### Vertex Displacement with CSM

```typescript
// Source: https://github.com/FarazzShaikh/THREE-CustomShaderMaterial
import CustomShaderMaterial from 'three-custom-shader-material'
import { MeshTransmissionMaterial } from '@react-three/drei'

const vertexShader = /* glsl */`
  uniform float uTime;
  uniform float uNoiseScale;
  uniform float uNoiseStrength;

  attribute vec4 tangent;

  // Include simplex noise function here

  float getDisplacement(vec3 pos) {
    vec3 noisePos = pos * uNoiseScale + vec3(uTime * 0.2);

    // Multi-octave for organic feel
    float noise1 = snoise(noisePos) * 0.6;
    float noise2 = snoise(noisePos * 2.0 + vec3(uTime * 0.3)) * 0.25;
    float noise3 = snoise(noisePos * 4.0 + vec3(uTime * 0.4)) * 0.15;

    return noise1 + noise2 + noise3;
  }

  void main() {
    // Tangent-based normal recalculation
    vec3 biTangent = cross(normal, tangent.xyz);
    float shift = 0.01;

    vec3 posA = position + tangent.xyz * shift;
    vec3 posB = position + biTangent * shift;

    float disp = getDisplacement(position) * uNoiseStrength;
    float dispA = getDisplacement(posA) * uNoiseStrength;
    float dispB = getDisplacement(posB) * uNoiseStrength;

    csm_Position = position + normal * disp;
    posA += normal * dispA;
    posB += normal * dispB;

    vec3 toA = normalize(posA - csm_Position);
    vec3 toB = normalize(posB - csm_Position);
    csm_Normal = normalize(cross(toA, toB));
  }
`

// Usage with CSM extending MeshTransmissionMaterial
<mesh>
  <icosahedronGeometry args={[1.5, 128]} />
  <CustomShaderMaterial
    baseMaterial={MeshTransmissionMaterial}
    vertexShader={vertexShader}
    uniforms={{
      uTime: { value: 0 },
      uNoiseScale: { value: 0.8 },
      uNoiseStrength: { value: 0.12 },
    }}
    // Pass through MeshTransmissionMaterial props
    transmission={0.98}
    thickness={0.5}
    // ... etc
  />
</mesh>
```

### Geometry Preparation for Tangents

```typescript
// CRITICAL: Geometry must have tangents for normal recalculation
import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils'

function useOrbGeometry(radius: number, detail: number) {
  return useMemo(() => {
    // Create base geometry
    let geometry = new THREE.IcosahedronGeometry(radius, detail)

    // Merge vertices (required for tangent computation)
    geometry = mergeVertices(geometry)

    // Compute tangents (required for normal recalculation)
    geometry.computeTangents()

    return geometry
  }, [radius, detail])
}
```

### Mobile Fallback Material

```typescript
// Simplified material for mobile - no transmission render pass
const MobileOrbMaterial = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={mobileVertexShader}
      fragmentShader={mobileFragmentShader}
      uniforms={{
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color('#FF6B35') },
        uColorRim: { value: new THREE.Color('#FFB6C1') },
      }}
      transparent
    />
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dual meshes (core + shell) | Single mesh + external aura | 2024-2025 | Eliminates z-fighting artifacts |
| Fresnel-only glass | MeshTransmissionMaterial | drei 9+ (2024) | True refraction and IOR |
| Manual normal calc | CSM with tangent attributes | three-custom-shader-material 5+ | Reliable, clean code |
| Post-processing bloom | FakeGlowMaterial | 2024 | Better mobile performance |
| Static inner glow | Animated noise or particles | Ongoing | More dynamic, matching reference |

**Deprecated/outdated:**
- **Lamina layers:** Archived June 2025, do not use for new projects
- **Dual nested meshes:** Creates artifacts, use single mesh + external elements

## Performance Strategy

### Desktop (60fps target)
- Full MeshTransmissionMaterial
- resolution: 256, samples: 4
- CSM vertex displacement
- Optional bloom post-processing

### Mobile (60fps target, thermal limit)
- **Fallback material** without transmission
- resolution: 64 if transmission used
- samples: 2
- Reduced geometry detail (32 vs 64)
- Consider disabling morphing animation

### Adaptive Degradation
```typescript
import { PerformanceMonitor } from '@react-three/drei'

<PerformanceMonitor
  onDecline={() => {
    // Reduce quality
    setResolution(prev => Math.max(32, prev * 0.8))
    setMorphingEnabled(false)
  }}
  onIncline={() => {
    // Restore quality
    setResolution(256)
    setMorphingEnabled(true)
  }}
/>
```

## Open Questions

1. **CSM + MeshTransmissionMaterial Compatibility**
   - What we know: CSM supports extending MeshPhysicalMaterial
   - What's unclear: Direct extension of MeshTransmissionMaterial may have issues
   - Recommendation: Test early. Fallback: extend MeshPhysicalMaterial with transmission props

2. **Internal Flow/Wisps (deferred)**
   - What we know: Reference shows internal swirling motion
   - What's unclear: Whether this is essential for MVP or can be added later
   - Recommendation: Defer to Phase 21 with particle system. Focus on glass shell first.

3. **Exact Color Matching**
   - What we know: Reference has orange core, pink/salmon rim, NOT magenta
   - What's unclear: Exact hex values, may need visual iteration
   - Recommendation: Start with #FF6B35 (orange), #FFB6C1 (light pink), iterate

## Sources

### Primary (HIGH confidence)
- [MeshTransmissionMaterial Docs](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material) - Official API
- [THREE-CustomShaderMaterial GitHub](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) - CSM usage
- [Codrops Displaced Sphere](https://tympanus.net/codrops/2024/07/09/creating-an-animated-displaced-sphere-with-a-custom-three-js-material/) - Normal recalculation technique

### Secondary (MEDIUM confidence)
- [FakeGlowMaterial R3F](https://github.com/ektogamat/fake-glow-material-r3f) - Glow without post-processing
- [Codrops Vortex in Glass Sphere](https://tympanus.net/codrops/2025/03/10/rendering-a-procedural-vortex-inside-a-glass-sphere-with-three-js-and-tsl/) - TSL approach reference
- [Codrops Performance Guide](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/) - Adaptive quality

### Tertiary (LOW confidence)
- WebSearch results for mobile optimization patterns
- Spline community examples for glass sphere techniques

## Metadata

**Confidence breakdown:**
- Glass material approach: HIGH - Official drei docs, well-documented
- Normal recalculation: HIGH - Codrops tutorial with working code
- Mobile fallback strategy: MEDIUM - General patterns, needs testing
- CSM + Transmission combo: MEDIUM - Should work, needs validation
- Internal flow effect: LOW - Complex, deferred to future phase

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days)
**Supersedes:** Previous 20-RESEARCH.md (2026-02-02)
