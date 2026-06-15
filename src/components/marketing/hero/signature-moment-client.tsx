"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  detectInitialTier,
  startFpsSampler,
  usePerfStore,
  nextLowerTier,
} from "@/lib/perf-tier";

import { HERO_SCORE } from "./hero-constants";
import { ComposedStill } from "./composed-still";

/**
 * SignatureMomentClient — the `"use client"` BOUNDARY for the signature
 * "crowd → score" moment (RESEARCH Pattern 1, THE landmine fix).
 *
 * This is the ONLY place the `dynamic(..., { ssr: false })` call may live: Next.js
 * 16 forbids `ssr: false` inside a Server Component (exact error: "ssr: false is
 * not allowed with next/dynamic in Server Components"). The RSC `Hero` renders this
 * boundary as a child; the boundary holds the lazy import. Same shape as the
 * in-repo `Board.tsx` (line 1 'use client'; lines 71-74 dynamic+ssr:false+loading).
 *
 * The `./signature-canvas` module is a FORWARD REFERENCE created by 02-02 — until
 * then the import target may not exist, but `dynamic` only invokes the import
 * factory when `<SignatureCanvas>` actually renders, and we render NOTHING on the
 * still-favoring (default + gated) paths, so the boundary builds and tests pass.
 * The `loading` fallback is `ComposedStill`, so before the canvas chunk arrives the
 * user already sees the resolved frame (D-16).
 */
const SignatureCanvas = dynamic(
  // 02-02 provides the default export of ./signature-canvas (the canvas-2D play).
  () => import("./signature-canvas"),
  {
    ssr: false,
    loading: () => <ComposedStill score={HERO_SCORE} />,
  },
);

export interface SignatureMomentClientProps {
  /** The resolved virality score driving the moment. Defaults to HERO_SCORE. */
  score?: number;
}

/**
 * Decides whether the heavy canvas island mounts AT ALL (RESEARCH Pattern 2).
 * Both `usePrefersReducedMotion` and `useIsMobile` default to the conservative,
 * still-favoring value (true) until mount, so first paint is ALWAYS the still
 * (the RSC `ComposedStill` rendered by `Hero` underneath). The canvas only ever
 * activates after a client effect confirms desktop + motion-OK + a capable GPU.
 *
 * When the gate is false → return `null` (render nothing). The canvas must not
 * mount under reduced-motion, so its rAF loop and at-rest drift never start
 * (Pitfall 5). The still beneath is already the full, accessible end-state.
 */
export function SignatureMomentClient({
  score = HERO_SCORE,
}: SignatureMomentClientProps) {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const tier = usePerfStore((s) => s.tier);
  // The store setter (real store always provides it). Read defensively via the
  // selector — guarded below — so this island also works when a consumer/test
  // supplies a minimal `{ tier }`-only store snapshot (the 02-00 contract mock).
  const setTier = usePerfStore((s) => s.setTier);

  // FPS-drop → settle to the still (robustness add, A3 — not the correctness gate).
  const [fpsDropped, setFpsDropped] = useState(false);

  // Detect initial GPU tier post-mount (Pitfall 5: never block first paint).
  // Mirrors Board.tsx:364-370. Guard `setTier` so a setter-less store is a no-op.
  useEffect(() => {
    if (typeof setTier !== "function") return;
    let cancelled = false;
    detectInitialTier().then((detected) => {
      if (!cancelled) setTier(detected);
    });
    return () => {
      cancelled = true;
    };
  }, [setTier]);

  // Runtime FPS sampler — on sustained <40fps, drop the tier once AND settle this
  // island to the still. Mirrors Board.tsx:373-384 (tier downgrade) plus a local
  // flag so the canvas unmounts here. Cancel on cleanup. `tier` (from the selector)
  // feeds nextLowerTier — no `usePerfStore.getState()` so a plain-fn store mock is
  // tolerated; the `fpsDropped` flag is what actually settles THIS island.
  useEffect(() => {
    const cancel = startFpsSampler(() => {
      if (typeof setTier === "function") setTier(nextLowerTier(tier));
      setFpsDropped(true);
    });
    return cancel;
  }, [setTier, tier]);

  const animate = !reduced && !isMobile && tier !== "low" && !fpsDropped;

  // Gate false → render nothing; the SSR ComposedStill underneath is the frame.
  if (!animate) return null;

  // Gate true → lazy-load the canvas (ssr:false) with the still as its loading
  // fallback; it plays the moment once over the still, then rests.
  return <SignatureCanvas score={score} />;
}
