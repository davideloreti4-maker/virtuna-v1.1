'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/query-keys';

/**
 * Reads the current /analyze/[id] route param and returns the cached analysis
 * row from `GET /api/analysis/[id]`. TanStack Query deduplicates the fetch so
 * multiple consumers (Board, AudienceNode, etc.) share a single network call
 * and the row hydrates every useAnalysisStream instance via its initialData.
 *
 * Without this shared lookup, child nodes that call `useAnalysisStream()`
 * with no initialData start with `result=null` — which surfaces as the
 * "no data loads at all" symptom on permalink loads.
 */
export function usePermalinkAnalysis() {
  const params = useParams();
  const id =
    params && typeof (params as { id?: unknown }).id === 'string'
      ? (params as { id: string }).id
      : null;

  const query = useQuery({
    queryKey: queryKeys.analysis.detail(id ?? ''),
    queryFn: async () => {
      const r = await fetch(`/api/analysis/${id}`);
      if (!r.ok) throw new Error(`Failed to load analysis ${id}`);
      return r.json();
    },
    enabled: !!id,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    // Converge on an IN-FLIGHT analysis on our own. The composer that streamed
    // the run lives in `home/page.tsx` and UNMOUNTS on the /home → /analyze/[id]
    // navigation, aborting its SSE POST before `complete` — so nothing bridges the
    // finished result into this cache. Without polling, the Reading froze on the
    // placeholder row (overall_score:null) until a manual refresh. Poll every 2s
    // while the row is still processing; stop the instant it completes (or fails).
    refetchInterval: (q) => {
      const d = q.state.data as
        | {
            processing?: boolean;
            overall_score?: number | null;
            engine_version?: string | null;
            analysis_unavailable?: boolean;
            created_at?: string | null;
            signal_availability?: { apollo?: boolean } | null;
            variants?: { apollo?: unknown } | null;
          }
        | undefined;
      if (!d) return 2000; // first fetch still resolving
      // Ceiling (mirrors use-analysis-stream's 360s POLLING_CEILING): stop polling a
      // row stuck mid-write so a dead/hung pipeline never polls forever.
      if (d.created_at && Date.now() - new Date(d.created_at).getTime() > 360_000) {
        return false;
      }
      const inFlight =
        d.processing ??
        (d.overall_score == null &&
          d.engine_version === 'pending' &&
          !d.analysis_unavailable);
      // Write-race grace: overall_score + heatmap land in the main upsert, but Apollo
      // (the driver-row dimensions + hook rewrites) is persisted to variants.apollo a
      // beat LATER. Stopping the instant overall_score appears froze the Reading on a
      // half-row ("Hook/Retention/Shareability — Not available") until a manual refresh.
      // Keep polling while Apollo is EXPECTED (signal_availability.apollo) but not yet
      // in variants; it lands within ~1 cycle, then we stop.
      const finalizingApollo =
        !inFlight &&
        d.overall_score != null &&
        d.signal_availability?.apollo === true &&
        d.variants?.apollo == null;
      return inFlight || finalizingApollo ? 2000 : false;
    },
  });

  return { id, data: query.data ?? null, isLoading: query.isLoading };
}
