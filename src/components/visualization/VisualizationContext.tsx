'use client'

import { createContext, useContext, useMemo, ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useIsMobile } from '@/hooks/useIsMobile'

interface VisualizationContextValue {
  /** User prefers reduced motion (OS setting) */
  reducedMotion: boolean
  /** Viewport is mobile-sized */
  isMobile: boolean
  /** Geometry detail level based on device capability */
  geometryDetail: number
}

const VisualizationContext = createContext<VisualizationContextValue | null>(null)

interface VisualizationProviderProps {
  children: ReactNode
  /** Force reduced motion (for testing) */
  forceReducedMotion?: boolean
}

/**
 * Provides visualization settings to all child components.
 * Handles reduced motion detection and mobile optimization.
 */
export function VisualizationProvider({
  children,
  forceReducedMotion = false,
}: VisualizationProviderProps) {
  const systemReducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobile()

  const value = useMemo<VisualizationContextValue>(
    () => ({
      reducedMotion: forceReducedMotion || systemReducedMotion,
      isMobile,
      // Mobile: 32 subdivisions (~5K vertices), Desktop: 64 (~40K vertices)
      geometryDetail: isMobile ? 32 : 64,
    }),
    [forceReducedMotion, systemReducedMotion, isMobile]
  )

  return (
    <VisualizationContext.Provider value={value}>
      {children}
    </VisualizationContext.Provider>
  )
}

/**
 * Hook to access visualization settings.
 * Must be used within VisualizationProvider.
 */
export function useVisualization(): VisualizationContextValue {
  const context = useContext(VisualizationContext)
  if (!context) {
    throw new Error('useVisualization must be used within VisualizationProvider')
  }
  return context
}
