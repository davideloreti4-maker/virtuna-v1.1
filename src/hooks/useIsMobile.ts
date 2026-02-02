'use client'

import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Detects if viewport is mobile-sized.
 * Used to reduce WebGL complexity on mobile devices.
 * Defaults to true (mobile) for SSR safety - better to start low-perf.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
