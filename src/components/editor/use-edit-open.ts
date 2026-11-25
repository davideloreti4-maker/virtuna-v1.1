"use client";

import { useQuery } from "@tanstack/react-query";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/**
 * use-edit-open.ts — whether the editor is open to this account (`GET /api/edit/open`; spec E11; plan
 * 2026-11-24-editor-screens-a, Task 16). Asked under the new look only: flag off it asks nothing and answers false. Its answer
 * is kept for the session. It is closed until it answers and while it could not be asked, so nobody meets a door that is shut;
 * an asking that failed (no connection, the sign-in service not reached) is no answer and is not kept: it is asked again the
 * next time a screen that shows the door mounts.
 */
export function useEditOpen(): boolean {
  const asked = useQuery({
    queryKey: ["edit", "open"],
    queryFn: async () => {
      const response = await fetch("/api/edit/open", { cache: "no-store" });
      if (!response.ok) throw new Error(`the editor's door answered ${response.status}`);
      return ((await response.json()) as { open?: unknown }).open === true;
    },
    enabled: NEW_LOOK_ENABLED,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return asked.data === true;
}
