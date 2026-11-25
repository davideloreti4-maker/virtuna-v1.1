"use client";

import { useMemo, useRef } from "react";

/** Two calls closer together than this are one tap that landed twice. */
export const BURST_MS = 1500;

/**
 * A paid action behind a tap, made safe against the tap landing twice: a double-click, or a second
 * tap on a button that is still closing. The same call again within `BURST_MS` is dropped. The
 * request itself has no guard of its own (a second one starts a second billed turn), so every
 * new-look button that writes a script goes through this (final review 2026-11-23).
 */
export function useOncePerBurst<A extends unknown[]>(
  action: ((...args: A) => void) | null | undefined,
): ((...args: A) => void) | undefined {
  const last = useRef(Number.NEGATIVE_INFINITY);
  return useMemo(() => {
    if (!action) return undefined;
    return (...args: A) => {
      const now = Date.now();
      if (now - last.current < BURST_MS) return;
      last.current = now;
      action(...args);
    };
  }, [action]);
}
