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
 *
 * A cached row never goes stale (`staleTime: Infinity`) and polling stops six minutes after the
 * start, so a row last seen in flight is asked for again whenever the page opens: otherwise a run
 * opened while it simulated, left, and opened again later would say "did not finish" about a run
 * that finished.
 */
export function useSimulationRow(id: string): {
  row: ResultRow | undefined;
  notFound: boolean;
  /** A request for the row is in the air (the first load, a poll, or asking again on opening). */
  asking: boolean;
} {
  const options = analysisDetailQuery(id);
  const query = useQuery({
    ...options,
    retry: 1,
    // In flight: always ask again on opening. Otherwise the default (`true`): with `staleTime:
    // Infinity` a finished row is asked for again only once it has been invalidated.
    refetchOnMount: (q) => ((q.state.data as ResultRow | undefined)?.processing ? "always" : true),
    // The shared options poll every 2 seconds while there is no row yet, which never ends for a
    // row that cannot be fetched: once the first fetch has failed, stop asking. A row we already
    // hold is different: one failed poll of a run in flight (a 401 and a 404 were seen on a real
    // run) must not freeze the page on "Simulating", so that keeps polling like any other.
    refetchInterval: (q) =>
      q.state.status === "error" && q.state.data === undefined
        ? false
        : typeof options.refetchInterval === "function"
          ? options.refetchInterval(q)
          : (options.refetchInterval ?? false),
  });
  return {
    row: query.data as ResultRow | undefined,
    notFound: query.isError && query.data === undefined,
    asking: query.isFetching,
  };
}
