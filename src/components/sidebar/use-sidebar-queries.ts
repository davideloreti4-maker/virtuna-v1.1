'use client';
/**
 * Sidebar query hooks — Phase 2 Plan 07.
 *
 * useSidebarRecent: returns the top-3 most recent analyses for the
 * InputDrawer "Recent inputs" picker. Uses useAnalysisHistory() (plan 2.5
 * uses the same hook) and projects to a minimal SidebarAnalysis shape.
 */

import { useAnalysisHistory } from '@/hooks/queries';

export interface SidebarAnalysis {
  id: string;
  /** First 80 chars of content_text, used as display title in the Recent picker. */
  title: string | null;
}

/**
 * Returns up to 3 recent analyses for the InputDrawer Recent picker.
 * Mirrors the `useSidebarRecent` contract described in plan 2.7:
 *   `(recent.data?.pages?.[0] ?? []).slice(0, 3)` — the pages wrapper
 *   is emulated here so consumers can use the same destructuring.
 */
export function useSidebarRecent(): {
  data: { pages: SidebarAnalysis[][] } | undefined;
  isLoading: boolean;
} {
  const history = useAnalysisHistory();

  // Normalise: project raw rows → SidebarAnalysis
  const rows: SidebarAnalysis[] = Array.isArray(history.data)
    ? (history.data as Array<{ id: string; content_text?: string | null }>).slice(0, 3).map(
        (row) => ({
          id: row.id,
          title: row.content_text ? row.content_text.slice(0, 80) : null,
        }),
      )
    : [];

  return {
    data: { pages: [rows] },
    isLoading: history.isLoading,
  };
}
