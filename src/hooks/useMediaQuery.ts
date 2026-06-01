'use client';
import { useEffect, useState } from 'react';

/**
 * SSR-safe media-query hook. Returns `false` on the server and the first client
 * render (avoids hydration mismatch), then tracks the query after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
