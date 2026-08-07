"use client";

/**
 * Ambient connection state — is this device reporting a network at all?
 *
 * `useSyncExternalStore` rather than `useState(navigator.onLine)` because `navigator` does not
 * exist while rendering on the server: the naive form throws in SSR, and the `useEffect` variant
 * hydration-mismatches (server paints "online", client immediately repaints "offline"). The
 * server snapshot is hardcoded `true` — the honest default, since a server render knows nothing
 * about the visitor's radio, and a page that paints "you are offline" before hydration is a lie
 * told to everyone whose connection is fine.
 *
 * ⚠️ `true` here does NOT mean reachable. A captive portal reports `onLine: true` while dropping
 * every request, and so does a machine on a LAN with no route to the internet. Nothing may use a
 * `true` reading to CLAIM connectivity; the only sound use is special-casing the negative.
 */

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getSnapshot = (): boolean => navigator.onLine;

/** The server knows nothing about the visitor's connection. Assume online; never paint a lie. */
const getServerSnapshot = (): boolean => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
