---
phase: 20-visualization-foundation
plan: 02
type: execute
wave: 2
depends_on: ["20-01"]
files_modified:
  - src/components/visualization/GlassOrb.tsx
  - src/components/visualization/shaders/orbVertex.glsl.ts
  - src/components/visualization/shaders/orbFragment.glsl.ts
  - src/app/(marketing)/viz-test/page.tsx
autonomous: false

must_haves:
  truths:
    - "Orb displays with dramatic organic blob morphing (25-30% vertex displacement)"
    - "Orb has gradient colors from orange core to coral to magenta rim"
    - "Fresnel rim lighting creates strong edge glow effect"
    - "Inner glow sphere creates depth/internal flow illusion"
    - "Orb has ambient breathing animation (4s cycle)"
    - "Orb responds to hover with increased glow"
    - "Orb responds to tap/click with pulse feedback"
    - "prefers-reduced-motion shows static orb (no animation)"
  artifacts:
    - path: "src/components/visualization/GlassOrb.tsx"
      provides: "Main orb component with shaders, animations, interactions"
      contains: ["shaderMaterial", "useFrame", "uBreathingScale"]
      min_lines: 150
    - path: "src/components/visualization/shaders/orbVertex.glsl.ts"
      provides: "Vertex shader with noise displacement"
      contains: "gl_Position"
      min_lines: 80
    - path: "src/components/visualization/shaders/orbFragment.glsl.ts"
      provides: "Fragment shader with gradient and fresnel"
      contains: "gl_FragColor"
      min_lines: 30
  key_links:
    - from: "src/components/visualization/GlassOrb.tsx"
      to: "shaders/orbVertex.glsl.ts"
      via: "import and vertexShader prop"
      pattern: "import.*orbVertex"
    - from: "src/components/visualization/GlassOrb.tsx"
      to: "VisualizationContext"
      via: "useVisualization hook for settings"
      pattern: "useVisualization"
---

<objective>
Create the complete glass orb component with shaders, animations, and interactions matching the Dribbble reference

Purpose: Build the full visual core in a single plan - organic morphing orb with gradient colors, fresnel rim lighting, inner depth illusion, breathing animation, and hover/tap feedback. This is the "AI brain" focal point.

Key improvements from analysis:
- Increased noise strength (0.28 vs 0.18) for dramatic morphing
- Slower breathing cycle (4s vs 2.5s) for languid feel
- Inner glow sphere for depth illusion
- Fixed tap timing bug (use ref, not event.timeStamp)
- Context-based settings (no prop drilling)

Output:
- GlassOrb component with custom ShaderMaterial
- Vertex shader with multi-octave noise displacement (28% strength)
- Fragment shader with gradient colors and fresnel rim glow
- Inner sphere for depth illusion
- Breathing animation (4s cycle with secondary oscillation)
- Hover feedback (30% glow boost)
- Tap/click pulse feedback (correct timing)
- Reduced motion support
</objective>

<execution_context>
@/Users/davideloreti/.claude/get-shit-done/workflows/execute-plan.md
@/Users/davideloreti/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-visualization-foundation/20-RESEARCH.md
@.planning/phases/20-visualization-foundation/20-01-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create shader files with enhanced noise displacement</name>
  <files>
    - src/components/visualization/shaders/orbVertex.glsl.ts
    - src/components/visualization/shaders/orbFragment.glsl.ts
  </files>
  <action>
Create directory: `src/components/visualization/shaders/`

Create vertex shader at `src/components/visualization/shaders/orbVertex.glsl.ts`:

```typescript
/**
 * Vertex shader for organic blob morphing.
 * Uses 3D Perlin noise to displace vertices along their normals.
 *
 * Key parameters tuned for Dribbble reference match:
 * - uNoiseStrength: 0.28 (dramatic 25-30% displacement)
 * - Multi-octave noise for organic complexity
 * - Slow time multipliers for languid motion
 */
export const orbVertexShader = /* glsl */ `
uniform float uTime;
uniform float uNoiseScale;
uniform float uNoiseStrength;
uniform float uBreathingScale;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vDisplacement;

//
// GLSL textureless classic 3D Perlin noise "cnoise"
// by Stefan Gustavson (stefan.gustavson@liu.se)
// https://github.com/stegu/webgl-noise
//
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec3 P) {
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;

  // Multi-octave noise for organic feel
  // SLOWER time multipliers for languid motion (per analysis)
  // Primary large-scale deformation (60% weight)
  float noise1 = cnoise(position * uNoiseScale + vec3(uTime * 0.08)) * 0.6;
  // Medium frequency detail (30% weight)
  float noise2 = cnoise(position * uNoiseScale * 2.0 + vec3(uTime * 0.12)) * 0.3;
  // High frequency subtle detail (10% weight)
  float noise3 = cnoise(position * uNoiseScale * 4.0 + vec3(uTime * 0.15)) * 0.1;

  // Combine noise octaves
  vDisplacement = (noise1 + noise2 + noise3);

  // Apply displacement along normal
  // uNoiseStrength = 0.28 for dramatic 25-30% displacement
  vec3 newPosition = position + normal * vDisplacement * uNoiseStrength;

  // Apply breathing scale (for ambient pulse animation)
  newPosition *= uBreathingScale;

  // Calculate world position for fresnel
  vec4 worldPosition = modelMatrix * vec4(newPosition, 1.0);
  vWorldPosition = worldPosition.xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`
```

Create fragment shader at `src/components/visualization/shaders/orbFragment.glsl.ts`:

```typescript
/**
 * Fragment shader with gradient colors and fresnel rim lighting.
 * Creates the glass-like appearance with orange core to magenta rim.
 */
export const orbFragmentShader = /* glsl */ `
uniform vec3 uColorCore;      // Orange center
uniform vec3 uColorMid;       // Coral/Pink middle
uniform vec3 uColorRim;       // Magenta/Purple rim
uniform float uFresnelPower;
uniform float uFresnelIntensity;
uniform float uGlowIntensity;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vDisplacement;

void main() {
  // Calculate view direction for fresnel
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // Fresnel calculation - stronger at edges (grazing angles)
  float fresnel = 1.0 - max(dot(viewDirection, vNormal), 0.0);
  fresnel = pow(fresnel, uFresnelPower);

  // Gradient based on fresnel (center to rim)
  // Orange core -> Coral middle -> Magenta rim
  vec3 color = mix(uColorCore, uColorMid, fresnel * 0.6);
  color = mix(color, uColorRim, pow(fresnel, 1.5));

  // Add rim glow (stronger at edges)
  vec3 rimGlow = uColorRim * fresnel * uFresnelIntensity * uGlowIntensity;
  color += rimGlow;

  // Subtle color variation based on displacement for organic look
  color += vec3(vDisplacement * 0.08);

  // Alpha: slightly transparent in center, more opaque at edges
  float alpha = 0.85 + fresnel * 0.15;

  gl_FragColor = vec4(color, alpha);
}
`
```
  </action>
  <verify>
1. Files exist at correct paths
2. No TypeScript syntax errors
3. `pnpm build` passes
  </verify>
  <done>
- Vertex shader implements multi-octave noise with SLOWER time (0.08/0.12/0.15)
- Vertex shader uses higher noise strength (0.28) for dramatic morphing
- Fragment shader implements gradient + fresnel rim lighting
- Shader code optimized for languid, organic motion
  </done>
</task>

<task type="auto">
  <name>Task 2: Create complete GlassOrb component with animations and interactions</name>
  <files>
    - src/components/visualization/GlassOrb.tsx
  </files>
  <action>
Create the complete orb component at `src/components/visualization/GlassOrb.tsx`:

```typescript
'use client'

import { useRef, useMemo, useState, useCallback } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { orbVertexShader } from './shaders/orbVertex.glsl'
import { orbFragmentShader } from './shaders/orbFragment.glsl'
import { useVisualization } from './VisualizationContext'

// Animation state type for external control (future phases)
export type OrbState = 'idle' | 'processing' | 'revealing'

interface GlassOrbProps {
  /** Orb radius (default: 1.5) */
  radius?: number
  /** Animation speed multiplier (default: 1.0) */
  animationSpeed?: number
  /** Current animation state */
  state?: OrbState
  /** Callback when orb is clicked/tapped */
  onTap?: () => void
}

// Animation constants (tuned per analysis)
const BREATHING_CYCLE = 4.0 // seconds (slower for languid feel)
const BREATHING_AMPLITUDE = 0.04 // 4% scale variation
const HOVER_GLOW_BOOST = 1.3 // 30% increase
const TAP_PULSE_DURATION = 0.3 // seconds
const TAP_PULSE_SCALE = 1.08 // 8% scale pulse
const INNER_SPHERE_SCALE = 0.75 // Inner sphere is 75% of outer

/**
 * GlassOrb - Organic morphing orb matching Dribbble reference
 *
 * Visual features:
 * - Dramatic blob morphing (28% noise displacement)
 * - Orange -> coral -> magenta gradient
 * - Fresnel rim lighting for edge glow
 * - Inner sphere for depth illusion
 *
 * Animation features:
 * - Breathing: 4s sinusoidal cycle with secondary oscillation
 * - Hover: 30% glow boost with smooth transition
 * - Tap: Quick scale pulse with ease-out
 * - Reduced motion: Static display
 *
 * Performance:
 * - All animation via refs and useFrame (no React state in loop)
 * - Geometry detail from context (32 mobile, 64 desktop)
 * - Uses context for reduced motion (no prop drilling)
 */
export function GlassOrb({
  radius = 1.5,
  animationSpeed = 1.0,
  state = 'idle',
  onTap,
}: GlassOrbProps) {
  const { reducedMotion, geometryDetail } = useVisualization()

  const outerMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const innerMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  // Interaction state (React state OK - updates infrequently)
  const [isHovered, setIsHovered] = useState(false)

  // Tap timing: store R3F clock time, not DOM event time (fixes bug)
  const tapTimeRef = useRef<number | null>(null)

  // Shared uniform factory
  const createUniforms = useCallback(
    (isInner: boolean) => ({
      uTime: { value: 0 },
      uNoiseScale: { value: isInner ? 1.8 : 1.2 }, // Inner has tighter noise
      uNoiseStrength: { value: isInner ? 0.15 : 0.28 }, // Inner is subtler
      uBreathingScale: { value: 1.0 },
      // Colors: inner is slightly different for depth
      uColorCore: { value: new THREE.Color(isInner ? '#FF5722' : '#FF6B35') },
      uColorMid: { value: new THREE.Color(isInner ? '#FF7043' : '#FF8E72') },
      uColorRim: { value: new THREE.Color(isInner ? '#E040FB' : '#C850C0') },
      uFresnelPower: { value: isInner ? 3.0 : 2.5 },
      uFresnelIntensity: { value: isInner ? 0.6 : 0.9 },
      uGlowIntensity: { value: 1.0 },
    }),
    []
  )

  // Memoize uniforms
  const outerUniforms = useMemo(() => createUniforms(false), [createUniforms])
  const innerUniforms = useMemo(() => createUniforms(true), [createUniforms])

  // Animation loop
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime()

    // Update both materials
    const materials = [
      { ref: outerMaterialRef, timeOffset: 0 },
      { ref: innerMaterialRef, timeOffset: 0.5 }, // Phase offset for inner
    ]

    for (const { ref, timeOffset } of materials) {
      if (!ref.current) continue

      // Skip animation updates if reduced motion
      if (reducedMotion) {
        ref.current.uniforms.uBreathingScale.value = 1.0
        ref.current.uniforms.uGlowIntensity.value = 1.0
        ref.current.uniforms.uTime.value = 0 // Freeze morphing
        continue
      }

      // Update time for morphing animation (with phase offset)
      ref.current.uniforms.uTime.value = (elapsed + timeOffset) * animationSpeed

      // Breathing animation: sinusoidal scale pulse
      const breathingPhase = (elapsed / BREATHING_CYCLE) * Math.PI * 2
      let breathingScale = 1.0 + Math.sin(breathingPhase) * BREATHING_AMPLITUDE

      // Secondary oscillation for non-metronomic feel (1.7x period)
      const secondaryPhase = (elapsed / (BREATHING_CYCLE * 1.7)) * Math.PI * 2
      breathingScale += Math.sin(secondaryPhase) * (BREATHING_AMPLITUDE * 0.3)

      // Tap pulse animation (using ref for correct R3F timing)
      if (tapTimeRef.current !== null) {
        const tapElapsed = elapsed - tapTimeRef.current
        if (tapElapsed < TAP_PULSE_DURATION) {
          const tapProgress = tapElapsed / TAP_PULSE_DURATION
          const tapEase = 1 - Math.pow(1 - tapProgress, 3) // ease-out cubic
          const tapScale = 1 + (TAP_PULSE_SCALE - 1) * (1 - tapEase)
          breathingScale *= tapScale
        } else {
          tapTimeRef.current = null
        }
      }

      ref.current.uniforms.uBreathingScale.value = breathingScale

      // Glow intensity: boosted on hover (outer only)
      if (ref === outerMaterialRef) {
        const targetGlow = isHovered ? HOVER_GLOW_BOOST : 1.0
        const currentGlow = ref.current.uniforms.uGlowIntensity.value
        ref.current.uniforms.uGlowIntensity.value += (targetGlow - currentGlow) * 0.1
      }
    }
  })

  // Interaction handlers
  const handlePointerEnter = useCallback(() => {
    if (!reducedMotion) {
      setIsHovered(true)
      document.body.style.cursor = 'pointer'
    }
  }, [reducedMotion])

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false)
    document.body.style.cursor = 'auto'
  }, [])

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()

      if (!reducedMotion) {
        // Store R3F clock time for correct animation timing (bug fix)
        // We'll set this in the next frame via a flag
        tapTimeRef.current = -1 // Signal to set in useFrame
      }

      onTap?.()
    },
    [reducedMotion, onTap]
  )

  // Set tap time from within useFrame to use correct clock
  useFrame(({ clock }) => {
    if (tapTimeRef.current === -1) {
      tapTimeRef.current = clock.getElapsedTime()
    }
  })

  return (
    <group>
      {/* Outer morphing sphere */}
      <mesh
        ref={meshRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <icosahedronGeometry args={[radius, geometryDetail]} />
        <shaderMaterial
          ref={outerMaterialRef}
          vertexShader={orbVertexShader}
          fragmentShader={orbFragmentShader}
          uniforms={outerUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner sphere for depth illusion */}
      <mesh scale={INNER_SPHERE_SCALE}>
        <icosahedronGeometry args={[radius, Math.max(16, geometryDetail / 2)]} />
        <shaderMaterial
          ref={innerMaterialRef}
          vertexShader={orbVertexShader}
          fragmentShader={orbFragmentShader}
          uniforms={innerUniforms}
          transparent
          side={THREE.BackSide} // Render inside surface
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
```

Key implementation decisions:
- **Geometry detail from context**: Uses `geometryDetail` (32 mobile, 64 desktop)
- **Reduced motion from context**: No prop drilling, cleaner API
- **Tap timing fixed**: Uses ref set within useFrame, not DOM event.timeStamp
- **Dual spheres**: Outer (DoubleSide) + Inner (BackSide at 75% scale) for depth
- **Phase offset**: Inner sphere animates 0.5s out of phase with outer
- **Slower timing**: 4s breathing, slower noise time multipliers (0.08/0.12/0.15)
- **Higher displacement**: 28% noise strength for dramatic morphing
  </action>
  <verify>
1. File exists and TypeScript compiles
2. Import paths are correct
3. `pnpm build` passes
  </verify>
  <done>
- GlassOrb uses context for reducedMotion and geometryDetail
- Dual sphere setup (outer + inner) for depth illusion
- Dramatic morphing with 28% noise displacement
- 4s breathing cycle with secondary oscillation
- Tap timing bug fixed (uses ref + useFrame)
- Hover glow boost with smooth transition
  </done>
</task>

<task type="auto">
  <name>Task 3: Update test page with full interaction testing</name>
  <files>
    - src/app/(marketing)/viz-test/page.tsx
  </files>
  <action>
Update the test page to display GlassOrb and allow full testing:

```typescript
'use client'

import { useState } from 'react'
import { VisualizationCanvas } from '@/components/visualization/VisualizationCanvas'
import { GlassOrb } from '@/components/visualization/GlassOrb'

export default function VizTestPage() {
  const [forceReducedMotion, setForceReducedMotion] = useState(false)
  const [tapCount, setTapCount] = useState(0)

  return (
    <main className="min-h-screen bg-background-base">
      {/* Controls overlay */}
      <div className="absolute top-4 left-4 z-10 p-4 rounded-lg bg-surface-elevated/80 backdrop-blur-sm space-y-3 max-w-xs">
        <div className="text-text-primary text-sm font-medium">
          Glass Orb Test
        </div>

        <label className="flex items-center gap-2 text-text-secondary text-xs">
          <input
            type="checkbox"
            checked={forceReducedMotion}
            onChange={(e) => setForceReducedMotion(e.target.checked)}
            className="rounded"
          />
          Force reduced motion
        </label>

        <div className="text-text-tertiary text-xs">
          Tap count: {tapCount}
        </div>

        <div className="border-t border-border-subtle pt-2 mt-2">
          <div className="text-text-tertiary text-xs">
            <strong>Verify:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Dramatic blob morphing visible</li>
              <li>Orange center → magenta rim gradient</li>
              <li>Inner depth visible (look closely)</li>
              <li>Slow ~4s breathing pulse</li>
              <li>Hover brightens edge glow</li>
              <li>Click triggers scale pulse</li>
              <li>Reduced motion = static</li>
              <li>Pan/zoom with Reset button</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="h-screen w-full">
        <VisualizationCanvas
          className="h-full w-full"
          forceReducedMotion={forceReducedMotion}
        >
          <GlassOrb onTap={() => setTapCount((c) => c + 1)} />
        </VisualizationCanvas>
      </div>
    </main>
  )
}
```
  </action>
  <verify>
1. Run `pnpm dev`
2. Navigate to http://localhost:3000/viz-test
3. `pnpm build` passes
  </verify>
  <done>
- Test page displays GlassOrb with all visual effects
- Controls overlay for reduced motion toggle
- Tap counter to verify click events
- Verification checklist visible
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Complete glass orb visualization with:
- Dramatic organic blob morphing (28% vertex displacement)
- Gradient colors (orange → coral → magenta)
- Fresnel rim lighting (strong edge glow)
- Inner sphere for depth illusion
- Breathing animation (4s sinusoidal cycle + secondary oscillation)
- Hover feedback (30% glow boost)
- Tap/click feedback (scale pulse)
- Reduced motion support (static fallback)
- Adaptive geometry (32 mobile, 64 desktop)
  </what-built>
  <how-to-verify>
1. Navigate to http://localhost:3000/viz-test

2. **Verify dramatic blob morphing:**
   - Orb should have VISIBLE wobble/deformation
   - Movement should be slow and organic (~4s full morph cycle)
   - Deformation should be dramatic (25-30% visible squish/stretch)

3. **Verify gradient colors:**
   - Orange/warm color in center
   - Coral/pink in middle areas
   - Magenta/purple at edges (rim glow)

4. **Verify inner depth:**
   - Look closely - should see hint of inner sphere
   - Creates illusion of depth/volume inside

5. **Verify breathing animation:**
   - Orb gently pulses (scale up/down)
   - Cycle is SLOW (~4 seconds)
   - Not perfectly metronomic (slight variation)

6. **Verify hover interaction:**
   - Hover over orb
   - Edge glow should brighten noticeably (~30%)
   - Cursor changes to pointer

7. **Verify tap/click interaction:**
   - Click/tap the orb
   - Should see quick scale pulse (snappy, not laggy)
   - Tap count increments in control panel

8. **Verify reduced motion:**
   - Check "Force reduced motion" checkbox
   - ALL animation should stop immediately
   - Orb displays completely static

9. **Verify pan/zoom:**
   - Drag to pan the view
   - Scroll to zoom in/out
   - Reset View button returns to default

10. **Compare to reference:**
    - Open reference: https://dribbble.com/shots/24801507-Relax-Ai-Motion-Visual
    - Does our orb capture the same organic, languid feel?
    - Is the morphing dramatic enough?

11. **Check console for errors:**
    - No WebGL shader compilation errors
    - No React errors
    - No hydration warnings
  </how-to-verify>
  <resume-signal>Type "approved" if visual quality is acceptable, or describe specific issues (e.g., "morphing too subtle", "colors off", "motion too fast")</resume-signal>
</task>

</tasks>

<verification>
After all tasks complete:

1. **Visual verification (most important):**
   - Morphing is DRAMATIC and visible
   - Colors match reference (orange core → magenta rim)
   - Inner depth illusion visible
   - Animation is SLOW and organic
   - Hover/tap feedback works

2. **Build verification:**
   ```bash
   pnpm build
   ```
   Must pass without errors.

3. **Performance check:**
   - Open DevTools Performance tab
   - Animation maintains 60fps
   - No jank during interactions

4. **Accessibility:**
   - Reduced motion completely stops all animation
   - Cursor changes on hover
</verification>

<success_criteria>
- [x] GlassOrb renders with dramatic blob morphing (28% displacement)
- [x] Gradient colors: orange → coral → magenta
- [x] Fresnel rim lighting creates strong edge glow
- [x] Inner sphere creates depth illusion
- [x] Breathing animation: 4s cycle with secondary oscillation
- [x] Hover increases glow by 30%
- [x] Tap triggers scale pulse (correct timing via ref)
- [x] Reduced motion shows completely static orb
- [x] Geometry adapts to device (32 mobile, 64 desktop)
- [x] Human verification confirms visual matches Dribbble reference feel
- [x] Build passes (`pnpm build`)
</success_criteria>

<output>
After completion, create `.planning/phases/20-visualization-foundation/20-02-SUMMARY.md`
</output>
