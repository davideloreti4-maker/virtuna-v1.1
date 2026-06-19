'use client';

/**
 * useLensScale — the Panel·10 ⇄ Population·1,000 toggle state (D-07).
 *
 * Per UI-SPEC the scale is per-Read state that "remembers last choice". We back the
 * last-used default with a module-level value (SSR-safe — never reads localStorage on
 * the server) and hydrate it from localStorage on mount, so each newly-opened Lens
 * seeds from the user's last choice without a flash of the wrong tab.
 */

import { useCallback, useState } from 'react';

export type LensScale = 'panel' | 'population';

const STORAGE_KEY = 'numen.lens.scale';
const DEFAULT_SCALE: LensScale = 'panel';

/** Module-level last-used value — seeds new Lens instances within a session. */
let lastUsed: LensScale = DEFAULT_SCALE;

function isLensScale(v: string | null): v is LensScale {
  return v === 'panel' || v === 'population';
}

/** Read the persisted last choice (client only). Falls back to the module default. */
function readInitialScale(): LensScale {
  if (typeof window === 'undefined') return lastUsed;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLensScale(stored)) {
    lastUsed = stored;
    return stored;
  }
  return lastUsed;
}

export function useLensScale(): [LensScale, (next: LensScale) => void] {
  // Lazy initializer reads localStorage at mount — no setState-in-effect cascade.
  // The Lens mounts client-side only (Radix portal), so there is no SSR render of
  // this hook to mismatch against.
  const [scale, setScale] = useState<LensScale>(readInitialScale);

  const set = useCallback((next: LensScale) => {
    lastUsed = next;
    setScale(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return [scale, set];
}
