"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { ResultState } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { NoAudience } from "./no-audience";
import { LandingProvider, useLandingWindow } from "./landing";
import { PlayheadProvider, usePlayhead } from "./playhead";
import { ResultHeader } from "./result-header";
import { Running, type RunningPreview } from "./running";
import { usePushedTitle } from "./use-pushed-title";
import { ResultFrame } from "./first-block";
import { VideoResult } from "./video-result";

/** What the page can show: the row's state, or that the row could not be fetched. */
export type ResultPageState = ResultState | { kind: "not-found" };

function titleOf(state: ResultPageState): string {
  switch (state.kind) {
    case "result":
      return state.model.title;
    case "no-audience":
      return state.title;
    case "stalled":
      return "Video";
    case "running":
      return "Simulating";
    default:
      return "";
  }
}

/** Moves the playhead once, on arrival (the dev page's `?t=`). */
function StartAt({ t }: { t: number }) {
  const { seek } = usePlayhead();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    seek(t);
  }, [seek, t]);
  return null;
}

/**
 * One line and the way Home: the run is not there, or it never finished. Home is a new start, not a
 * step back: the back-to-Library marker a chat opened from Library left set is dropped, or that
 * chat's Back would step back onto this dead end.
 */
function DeadEnd({ line }: { line: string }) {
  const router = useRouter();
  const goHome = () => {
    useShellStore.getState().setThreadBack(null);
    router.push("/home");
  };
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-24 text-center">
      <p className="text-title font-[640] text-foreground">{line}</p>
      <Button variant="secondary" onClick={goHome}>
        Home
      </Button>
    </div>
  );
}

/**
 * True once the run turned into its result (or into no audience) while the page was open: that
 * result lands, that body fades in. A result opened directly does neither. The kind seen last is kept
 * in state, not in a ref, so it can be read while rendering.
 */
function useArrivedFromRun(kind: ResultPageState["kind"]): boolean {
  const [seen, setSeen] = useState<{ kind: ResultPageState["kind"]; arrived: boolean }>({ kind, arrived: false });
  if (seen.kind !== kind) {
    const next = { kind, arrived: seen.kind === "running" && (kind === "result" || kind === "no-audience") };
    setSeen(next);
    return next.arrived;
  }
  return seen.arrived;
}

// A run that turns into no audience fades in as a whole (not with reduced motion): opacity only, from
// the element's starting style. A result lands part by part instead (landing.tsx). An animated
// transform or filter would make a fixed element place itself against this element, not the screen.
const ARRIVAL_FADE = "motion-safe:transition-opacity motion-safe:duration-[400ms] motion-safe:starting:opacity-0";

/**
 * The result page of one video simulation: loading, not found, running,
 * stalled, no audience, or the result. `startAt` moves the playhead on arrival and
 * `runningPreview` stands in for a live run (dev page only).
 */
export function ResultPage({
  state,
  startAt,
  simulateAgain = false,
  runningPreview,
  after,
}: {
  state: ResultPageState;
  /** What stands directly under the result's first block ("After posting"); the screen supplies it. */
  after?: React.ReactNode;
  startAt?: number;
  /** Offer "Simulate again" on a run without an audience. Off until the server can re-run a stored file safely (see NoAudience). */
  simulateAgain?: boolean;
  /** Dev page only: what the running screen shows instead of the live run. */
  runningPreview?: RunningPreview;
}) {
  const title = titleOf(state);
  usePushedTitle(title);
  const arrived = useArrivedFromRun(state.kind);
  // Measured once, here: the run's screen and the result that takes its place share it, so the result
  // is drawn in its first commit and the loading frame never shows between the two.
  const viewport = useIsMobileHydrated();
  // Only a result that arrives from its run lands, and only with motion allowed. The setting was read
  // while the run's screen was open, so it has settled by the time the result arrives.
  const reducedMotion = usePrefersReducedMotion();
  const landing = useLandingWindow(arrived && state.kind === "result" && !reducedMotion);

  let body: React.ReactNode;
  switch (state.kind) {
    case "loading":
      body = <ResultFrame />;
      break;
    case "not-found":
      body = <DeadEnd line="This simulation is not here." />;
      break;
    case "stalled":
      body = <DeadEnd line="This simulation did not finish." />;
      break;
    case "running":
      // Keyed by the run: another run starts with its own clock, tile and strip.
      body = (
        <Running key={state.id} id={state.id} startedAt={state.startedAt} preview={runningPreview} viewport={viewport} />
      );
      break;
    case "no-audience":
      body = <NoAudience videoPath={state.videoPath} simulateAgain={simulateAgain} />;
      break;
    case "result":
      body = (
        <PlayheadProvider key={state.model.id} clipS={state.model.clipS} scenes={state.model.audience.scenes}>
          {startAt != null && <StartAt t={startAt} />}
          <LandingProvider value={landing}>
            <VideoResult model={state.model} after={after} viewport={viewport} />
          </LandingProvider>
        </PlayheadProvider>
      );
      break;
  }

  return (
    // A column as tall as what the shell leaves.
    <div className="flex min-h-full flex-col">
      <ResultHeader title={title} />
      <div
        // A new element when the run's outcome arrives, so the no-audience fade's starting style
        // (transparent) applies.
        key={arrived ? "arrived" : "page"}
        data-result-body=""
        data-arrived={arrived ? "" : undefined}
        data-result-landing={landing ? "" : undefined}
        className={cn("flex-1", arrived && state.kind === "no-audience" && ARRIVAL_FADE)}
      >
        {body}
      </div>
    </div>
  );
}
