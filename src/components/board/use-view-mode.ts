'use client';
import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export type ViewMode = 'board' | 'cards';
type Override = ViewMode | null;

const STORAGE_KEY = 'virtuna-board-view-mode';

/** Phones get the card stack; tablets/desktop keep the pannable canvas. */
export const MOBILE_QUERY = '(max-width: 767px)';

function readOverride(): Override {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'board' || v === 'cards' ? v : null;
  } catch {
    return null;
  }
}

export interface UseViewMode {
  /** Effective render mode after applying override + viewport default. */
  mode: ViewMode;
  /** Viewport is below the phone breakpoint. */
  isMobile: boolean;
  /** Explicit user choice; `null` = follow the viewport default. */
  override: Override;
  setOverride: (m: Override) => void;
  /** Flip the effective mode and persist it as an explicit override. */
  toggle: () => void;
}

/**
 * View-mode resolution for the analysis board.
 *
 * Default: phones (<768px) render the vertical card stack, everything else
 * renders the canvas. A persisted localStorage override lets any user pin a
 * mode regardless of viewport (the manual board⇄cards switch).
 */
export function useViewMode(): UseViewMode {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [override, setOverrideState] = useState<Override>(null);

  // Hydrate the persisted override post-mount. A lazy useState initializer would
  // read localStorage during the client's first render and diverge from the
  // server's `null`, causing a hydration mismatch — so the effect is the correct
  // SSR-safe pattern here despite the set-state-in-effect lint heuristic.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrideState(readOverride());
  }, []);

  const setOverride = useCallback((m: Override) => {
    setOverrideState(m);
    try {
      if (m === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const mode: ViewMode = override ?? (isMobile ? 'cards' : 'board');

  const toggle = useCallback(() => {
    setOverride(mode === 'cards' ? 'board' : 'cards');
  }, [mode, setOverride]);

  return { mode, isMobile, override, setOverride, toggle };
}
