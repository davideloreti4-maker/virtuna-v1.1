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

/**
 * WR-03 — like {@link useIsMobile} but also reports whether the viewport has
 * been measured yet (`hydrated`).
 *
 * `useIsMobile` must default to `true` for SSR safety, which makes the FIRST
 * client paint assume mobile. For layout decisions where that wrong guess is
 * visible (e.g. AppShell's content offset jumping 0px → sidebar-width on
 * desktop), callers need to know the value is provisional so they can pick a
 * sensible default until the real viewport is known. `hydrated` is false on the
 * initial render and flips true after the first measurement in the effect.
 */
export function useIsMobileHydrated(): { isMobile: boolean; hydrated: boolean } {
  const [state, setState] = useState<{ isMobile: boolean; hydrated: boolean }>({
    isMobile: true,
    hydrated: false,
  })

  useEffect(() => {
    const checkMobile = () => {
      setState({ isMobile: window.innerWidth < MOBILE_BREAKPOINT, hydrated: true })
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return state
}
