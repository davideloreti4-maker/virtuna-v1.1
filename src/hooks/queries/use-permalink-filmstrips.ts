'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

/**
 * Loads persisted keyframe URLs for the current /analyze/[id] on permalink replay
 * via GET /api/analyze/[id]/filmstrips, so the Audience filmstrip + Input thumbnail
 * render after reload (live runs get these from SSE instead). Shared cache key
 * dedupes the fetch across the Audience node and Board (Input thumbnail).
 */
export function usePermalinkFilmstrips(): Record<number, string> {
  const params = useParams();
  const id =
    params && typeof (params as { id?: unknown }).id === 'string'
      ? (params as { id: string }).id
      : null;

  const query = useQuery({
    queryKey: ['analysis', 'filmstrips', id ?? ''],
    queryFn: async () => {
      const r = await fetch(`/api/analyze/${id}/filmstrips`);
      if (!r.ok) throw new Error(`Failed to load filmstrips ${id}`);
      return (await r.json()) as { frames: Record<number, string> };
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
  });

  return query.data?.frames ?? {};
}
