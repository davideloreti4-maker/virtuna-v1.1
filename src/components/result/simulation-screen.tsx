"use client";

import { useEffect, useState } from "react";
import { AfterPosting } from "@/components/posted-next/after-posting";
import { useSimulationRow } from "@/hooks/queries/use-simulation-row";
import { STALLED_AFTER_MS, videoStateOf } from "@/lib/result/video-model";
import { ResultPage, type ResultPageState } from "./result-page";

/**
 * The time, read again once a run in flight passes the point where it counts as stalled. The
 * row's polling stops at that same point, so nothing else would re-render the page.
 */
function useNowUntilStalled(processing: boolean, createdAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!processing || !createdAt) return;
    const started = Date.parse(createdAt);
    if (!Number.isFinite(started)) return;
    const wait = started + STALLED_AFTER_MS + 1000 - Date.now();
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [processing, createdAt]);
  return now;
}

/**
 * `/simulation/[id]`: reads the stored run (polled while it is in flight) and picks the state.
 *
 * A row last seen in flight and now past the stall limit is asked for again when the page opens
 * (useSimulationRow). Until that answer is in, the page shows its loading frame: the cached row
 * cannot tell a run that did not finish from one that finished while the page was closed.
 */
export function SimulationScreen({ id }: { id: string }) {
  const { row, notFound, asking } = useSimulationRow(id);
  const now = useNowUntilStalled(!!row?.processing, row?.created_at);
  const read: ResultPageState = notFound ? { kind: "not-found" } : videoStateOf(row, now);
  const state: ResultPageState = read.kind === "stalled" && asking ? { kind: "loading" } : read;
  // A result has a number (a run with no audience has none): under its first block, its posted link
  // or the row that adds one.
  const after = state.kind === "result" ? <AfterPosting key={id} piece={{ kind: "video", analysisId: id }} /> : undefined;
  return <ResultPage state={state} after={after} />;
}
