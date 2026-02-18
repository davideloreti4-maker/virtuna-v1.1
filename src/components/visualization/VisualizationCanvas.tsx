'use client'

import { Suspense, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrbitControlsImpl = any
import { VisualizationProvider } from './VisualizationContext'

interface VisualizationCanvasProps {
  children?: React.ReactNode
  className?: string
  /** Force reduced motion for testing */
  forceReducedMotion?: boolean
  /** Show reset button when view is transformed */
  showResetButton?: boolean
}

/**
 * VisualizationCanvas - R3F Canvas wrapper for the visualization
 *
 * Features:
 * - High-performance WebGL context
 * - OrbitControls with pan/zoom (rotation disabled for 2D feel)
 * - Reset button to return to default view
 * - VisualizationProvider for settings context
 * - Transparent background for integration with dark theme
 */
export function VisualizationCanvas({
  children,
  className,
  forceReducedMotion = false,
  showResetButton = true,
}: VisualizationCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const handleReset = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset()
    }
  }, [])

  return (
    <VisualizationProvider forceReducedMotion={forceReducedMotion}>
      <div className={className} style={{ position: 'relative' }}>
        <Canvas
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          dpr={[1, 2]} // Retina support capped at 2x for performance
        >
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />

          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={false} // 2D-style controls
            minDistance={2}
            maxDistance={10}
            zoomSpeed={0.5}
            panSpeed={0.5}
          />

          {/* Ambient light for basic illumination */}
          <ambientLight intensity={0.5} />

          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>

        {/* Reset button */}
        {showResetButton && (
          <button
            onClick={handleReset}
            className="absolute bottom-4 right-4 px-3 py-1.5 text-xs font-medium
                       bg-surface-elevated/80 backdrop-blur-sm rounded-md
                       text-text-secondary hover:text-text-primary
                       border border-border-subtle hover:border-border-default
                       transition-colors"
            aria-label="Reset view"
          >
            Reset View
          </button>
        )}
      </div>
    </VisualizationProvider>
  )
}
