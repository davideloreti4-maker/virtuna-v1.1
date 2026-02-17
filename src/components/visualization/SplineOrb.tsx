'use client'

import { Suspense, useRef, useState, useCallback } from 'react'
import Spline, { type SplineEvent } from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'
import { useVisualization } from './VisualizationContext'

interface SplineOrbProps {
  /** Spline scene URL (from Spline export or self-hosted .splinecode) */
  sceneUrl: string
  /** Callback when scene finishes loading */
  onLoad?: () => void
  /** Callback when orb is clicked/tapped */
  onTap?: () => void
  /** Additional class names for the container */
  className?: string
}

/**
 * SplineOrb - Glass orb visualization using Spline 3D
 *
 * Features:
 * - Loads Spline scene with glass orb design
 * - Shows loading placeholder while scene loads
 * - Integrates with VisualizationContext for reduced motion
 * - Supports click/tap interactions via Spline events
 */
export function SplineOrb({
  sceneUrl,
  onLoad,
  onTap,
  className,
}: SplineOrbProps) {
  const { reducedMotion } = useVisualization()
  const splineRef = useRef<Application | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = useCallback((spline: Application) => {
    splineRef.current = spline
    setIsLoading(false)
    onLoad?.()

    // If reduced motion, we could potentially pause animations here
    // This depends on how the Spline scene is set up with states
    if (reducedMotion) {
      // Future: Trigger 'static' state in Spline if available
      // spline.emitEvent('mouseDown', 'pause-trigger')
    }
  }, [onLoad, reducedMotion])

  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoading(false)
  }, [])

  const handleSplineMouseDown = useCallback((e: SplineEvent) => {
    // Spline events include target info with object name
    if (e.target.name === 'orb' || e.target.name === 'Orb') {
      onTap?.()
    }
  }, [onTap])

  // Placeholder while loading
  const LoadingPlaceholder = () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="w-32 h-32 rounded-full animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(255,107,53,0.3) 0%, rgba(230,74,25,0.1) 70%, transparent 100%)',
        }}
      />
    </div>
  )

  // Error fallback
  if (hasError) {
    return (
      <div className={className}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-32 h-32 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,107,53,0.4) 0%, rgba(230,74,25,0.2) 70%, transparent 100%)',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {isLoading && <LoadingPlaceholder />}
      <Suspense fallback={<LoadingPlaceholder />}>
        <Spline
          scene={sceneUrl}
          onLoad={handleLoad}
          onError={handleError}
          onSplineMouseDown={handleSplineMouseDown}
          style={{
            width: '100%',
            height: '100%',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s ease-in-out',
          }}
        />
      </Suspense>
    </div>
  )
}
