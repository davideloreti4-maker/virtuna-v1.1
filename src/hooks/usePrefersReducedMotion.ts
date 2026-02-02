'use client'

import { useState, useEffect } from 'react'

const QUERY = '(prefers-reduced-motion: no-preference)'

/**
 * Detects user's motion preference from OS settings.
 * Returns true if user prefers reduced motion, false otherwise.
 * Defaults to true (reduced motion) for SSR safety.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(QUERY)
    // If no-preference matches, user does NOT prefer reduced motion
    setPrefersReducedMotion(!mediaQueryList.matches)

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(!event.matches)
    }

    mediaQueryList.addEventListener('change', listener)
    return () => mediaQueryList.removeEventListener('change', listener)
  }, [])

  return prefersReducedMotion
}
