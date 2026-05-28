'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DayOfWeek } from './optimal-post-constants';

// Discriminated-union payload type — mirrors server-side Zod schema in Plan 03 (D-27).
export type SetOverridePayload = {
  day_of_week: DayOfWeek;
  hour_range: [number, number];
};
export type ClearOverridePayload = { clear: true };
export type OverridePayload = SetOverridePayload | ClearOverridePayload;

export function useOptimalPostOverride(analysisId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OverridePayload) => {
      if (!analysisId) throw new Error('missing_analysis_id');
      const res = await fetch(`/api/analyze/${analysisId}/optimal-post-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('override_write_failed');
      return res.json();
    },
    onSuccess: () => {
      if (analysisId) {
        queryClient.invalidateQueries({ queryKey: ['analysis', analysisId] });
      }
    },
  });
}
