"use client";

import { useQuery } from "@tanstack/react-query";
import type { ResultRow } from "@/lib/result/types";
import { analysisDetailQuery } from "./use-permalink-analysis";

/**
 * The stored row of one video simulation, for the result page (`/simulation/[id]`).
 *
 * Same cache entry, fetch and polling as the board's `usePermalinkAnalysis` (one factory,
 * `analysisDetailQuery`): `GET /api/analysis/[id]`, polled every 2 seconds while the run is in
 * flight, so a run opened while it simulates turns into its result on its own.
 *
 * One retry instead of the app's three: a run that is not there (deleted, or not the viewer's)
 * says so after about a second instead of seven.
 */
export function useSimulationRow(id: string): { row: ResultRow | undefined; notFound: boolean } {
  const options = analysisDetailQuery(id);
  const query = useQuery({
    ...options,
    retry: 1,
    // The shared options poll every 2 seconds while there is no row yet, which never ends for a
    // row that cannot be fetched. Once the fetch has failed, stop asking.
    refetchInterval: (q) =>
      q.state.status === "error"
        ? false
        : typeof options.refetchInterval === "function"
          ? options.refetchInterval(q)
          : (options.refetchInterval ?? false),
  });
  return { row: query.data as ResultRow | undefined, notFound: query.isError && query.data === undefined };
}
