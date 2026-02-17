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

    // Handle tap time setting (needs to be done in useFrame for correct clock)
    if (tapTimeRef.current === -1) {
      tapTimeRef.current = elapsed
    }

    // Update both materials
    const materials = [
      { ref: outerMaterialRef, timeOffset: 0 },
      { ref: innerMaterialRef, timeOffset: 0.5 }, // Phase offset for inner
    ]

    for (const { ref, timeOffset } of materials) {
      const material = ref.current
      if (!material) continue

      const uniforms = material.uniforms as {
        uTime: { value: number }
        uBreathingScale: { value: number }
        uGlowIntensity: { value: number }
      }

      // Skip animation updates if reduced motion
      if (reducedMotion) {
        uniforms.uBreathingScale.value = 1.0
        uniforms.uGlowIntensity.value = 1.0
        uniforms.uTime.value = 0 // Freeze morphing
        continue
      }

      // Update time for morphing animation (with phase offset)
      uniforms.uTime.value = (elapsed + timeOffset) * animationSpeed

      // Breathing animation: sinusoidal scale pulse
      const breathingPhase = (elapsed / BREATHING_CYCLE) * Math.PI * 2
      let breathingScale = 1.0 + Math.sin(breathingPhase) * BREATHING_AMPLITUDE

      // Secondary oscillation for non-metronomic feel (1.7x period)
      const secondaryPhase = (elapsed / (BREATHING_CYCLE * 1.7)) * Math.PI * 2
      breathingScale += Math.sin(secondaryPhase) * (BREATHING_AMPLITUDE * 0.3)

      // Tap pulse animation (using ref for correct R3F timing)
      if (tapTimeRef.current !== null && tapTimeRef.current >= 0) {
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

      uniforms.uBreathingScale.value = breathingScale

      // Glow intensity: boosted on hover (outer only)
      if (ref === outerMaterialRef) {
        const targetGlow = isHovered ? HOVER_GLOW_BOOST : 1.0
        const currentGlow = uniforms.uGlowIntensity.value
        uniforms.uGlowIntensity.value += (targetGlow - currentGlow) * 0.1
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
        // Signal to set tap time in next useFrame (uses R3F clock, not DOM event)
        tapTimeRef.current = -1
      }

      onTap?.()
    },
    [reducedMotion, onTap]
  )

  // Suppress unused variable warning - state is for future phases
  void state

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
        <icosahedronGeometry args={[radius, Math.max(16, Math.floor(geometryDetail / 2))]} />
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
