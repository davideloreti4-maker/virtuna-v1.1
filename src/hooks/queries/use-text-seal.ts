"use client";

import { useQuery } from "@tanstack/react-query";
import type { PopulationAggregate } from "@/lib/audience/population";

/** The endpoint's body (`GET /api/threads/[id]/seals/[key]`). */
export interface TextSeal {
  text: string;
  at: string;
  population: PopulationAggregate;
  /** The thread is open: only then can "Script this one" run in it (archived → no button). */
  open: boolean;
}

/** Not there (404) or not the viewer's (401): asked once, never again. */
class SealMissing extends Error {}

/**
 * One text simulation's stored result, for `/simulation/hook/[threadId]/[key]`. A seal never changes once
 * written (`staleTime: Infinity`). A missing one says so at once; any other failure is asked once more,
 * then shown as not here (the page has no other state for it).
 */
export function useTextSeal(threadId: string, key: string): { seal: TextSeal | undefined; notFound: boolean } {
  const query = useQuery({
    queryKey: ["text-seal", threadId, key] as const,
    queryFn: async (): Promise<TextSeal> => {
      const res = await fetch(`/api/threads/${encodeURIComponent(threadId)}/seals/${encodeURIComponent(key)}`);
      if (res.status === 404 || res.status === 401) throw new SealMissing(String(res.status));
      if (!res.ok) throw new Error(`text seal: ${res.status}`);
      return (await res.json()) as TextSeal;
    },
    retry: (failures, error) => !(error instanceof SealMissing) && failures < 1,
    staleTime: Infinity,
  });
  return { seal: query.data, notFound: query.isError && query.data === undefined };
}
