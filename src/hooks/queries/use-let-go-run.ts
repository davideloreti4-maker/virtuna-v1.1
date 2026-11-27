"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { holdLetGo, reportLetGoRunEnded } from "@/lib/thread-next/let-go-runs";

/**
 * The let-go machinery of the chat's stream hooks, in one place: a run the creator leaves (a thread
 * switch, or leaving /home mid-run) goes on in the background, its request open to its end so its
 * route stays alive to store the result in the chat it was started in, while every frame it still
 * sends is dropped (`let-go-runs`). Stop is what ends a run.
 *
 * The hook keeps its own `abortRef` (the request in flight; null once its stream has ended) and
 * `isMountedRef`, and calls this right after declaring them. Per request:
 * - `begin()`, right after the request's controller is put in `abortRef`: its number, and `isLive`,
 *   which every frame and every state update of that request reads (mounted, and still the live one);
 * - `finish(gen)`, in the request's `finally`: a request that was let go has its hold released and its
 *   end told (`reportLetGoRunEnded`), so the chat list is read again.
 * `detach()` lets the request in flight go (a thread switch).
 *
 * The mount effect also owns `isMountedRef`. Unmounted mid-run, the run is let go as a switch lets it
 * go. Mounted again, the same hook (a dev remount: Fast Refresh re-runs effects), it takes back the
 * run its cleanup let go a moment ago, so its frames draw again and its end clears `isStreaming`
 * (left let go, its stream would read as running for good). A real unmount never comes back.
 */
export interface LetGoRun {
  begin: () => { gen: number; isLive: () => boolean };
  finish: (gen: number) => void;
  detach: () => void;
}

export function useLetGoRun(
  abortRef: RefObject<AbortController | null>,
  isMountedRef: RefObject<boolean>,
): LetGoRun {
  // The live request's number: bumped by each start and by each let-go.
  const genRef = useRef(0);
  // The requests let go while still out, by number, each with its hold (`holdLetGo`: ended at the
  // limit, or as the oldest of too many), so their end can be told.
  const letGoRef = useRef(new Map<number, () => void>());
  // The run the unmount let go, for a remount of this same hook to take back (dev only).
  const remountRef = useRef<{ gen: number; controller: AbortController } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    // The same Map for the hook's life (never replaced), held here for the cleanup.
    const letGo = letGoRef.current;
    const back = remountRef.current;
    if (back && genRef.current === back.gen + 1) {
      remountRef.current = null;
      const hold = letGo.get(back.gen);
      if (hold) {
        letGo.delete(back.gen);
        hold();
      }
      genRef.current = back.gen;
      abortRef.current = back.controller;
    }
    return () => {
      isMountedRef.current = false;
      if (abortRef.current) {
        letGo.set(genRef.current, holdLetGo(abortRef.current));
        remountRef.current = { gen: genRef.current, controller: abortRef.current };
      }
      genRef.current += 1;
      abortRef.current = null;
    };
  }, [abortRef, isMountedRef]);

  return useMemo<LetGoRun>(
    () => ({
      begin: () => {
        const gen = ++genRef.current;
        return { gen, isLive: () => isMountedRef.current && genRef.current === gen };
      },
      finish: (gen) => {
        const hold = letGoRef.current.get(gen);
        if (hold) {
          letGoRef.current.delete(gen);
          hold();
          reportLetGoRunEnded();
        }
        // Ended: nothing left for a remount to take back.
        if (remountRef.current?.gen === gen) remountRef.current = null;
      },
      detach: () => {
        if (abortRef.current) letGoRef.current.set(genRef.current, holdLetGo(abortRef.current));
        genRef.current += 1;
        abortRef.current = null;
      },
    }),
    [abortRef, isMountedRef],
  );
}
