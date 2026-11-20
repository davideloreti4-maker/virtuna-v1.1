"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ResultState } from "@/lib/result/types";
import { useShellStore } from "@/stores/shell-store";
import { NoAudience } from "./no-audience";
import { PlayheadProvider, usePlayhead } from "./playhead";
import { ResultHeader } from "./result-header";
import { Running } from "./running";
import { ResultFrame, VideoResult } from "./video-result";

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

/** Names the screen in the phone's pushed header (NextShell) and clears the name on the way out. */
function usePushedTitle(title: string) {
  const setPushedTitle = useShellStore((s) => s.setPushedTitle);
  useEffect(() => setPushedTitle(title), [title, setPushedTitle]);
  useEffect(() => () => setPushedTitle(""), [setPushedTitle]);
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

/** One line and the way Home: the run is not there, or it never finished. */
function DeadEnd({ line }: { line: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-24 text-center">
      <p className="text-title font-[640] text-foreground">{line}</p>
      <Button variant="secondary" onClick={() => router.push("/home")}>
        Home
      </Button>
    </div>
  );
}

/**
 * The result page of one video simulation (spec §5, plan Task 2): loading, not found, running,
 * stalled, no audience, or the result. `startAt` moves the playhead on arrival (dev page only).
 */
export function ResultPage({
  state,
  startAt,
  simulateAgain = false,
}: {
  state: ResultPageState;
  startAt?: number;
  /** Offer "Simulate again" on a run without an audience. Off until the server can re-run a stored file safely (see NoAudience). */
  simulateAgain?: boolean;
}) {
  const title = titleOf(state);
  usePushedTitle(title);

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
      body = <Running />;
      break;
    case "no-audience":
      body = <NoAudience videoPath={state.videoPath} simulateAgain={simulateAgain} />;
      break;
    case "result":
      body = (
        <PlayheadProvider key={state.model.id} clipS={state.model.clipS} scenes={state.model.audience.scenes}>
          {startAt != null && <StartAt t={startAt} />}
          <VideoResult model={state.model} />
        </PlayheadProvider>
      );
      break;
  }

  return (
    <div className="min-h-full">
      <ResultHeader title={title} />
      {body}
    </div>
  );
}
