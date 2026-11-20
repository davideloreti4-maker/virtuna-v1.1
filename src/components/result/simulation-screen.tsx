"use client";

import { useEffect, useState } from "react";
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

/** `/simulation/[id]`: reads the stored run (polled while it is in flight) and picks the state. */
export function SimulationScreen({ id }: { id: string }) {
  const { row, notFound } = useSimulationRow(id);
  const now = useNowUntilStalled(!!row?.processing, row?.created_at);
  const state: ResultPageState = notFound ? { kind: "not-found" } : videoStateOf(row, now);
  return <ResultPage state={state} />;
}
