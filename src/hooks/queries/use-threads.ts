"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

/** A sidebar chat-thread summary (active = index 0, newest-first). */
export interface ThreadSummary {
  id: string;
  title: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * List the user's open chat threads for the sidebar history.
 * Returns newest-first; the active thread is the first row.
 */
export function useThreadList() {
  return useQuery<ThreadSummary[]>({
    queryKey: queryKeys.threads.list(),
    queryFn: async () => {
      const res = await fetch("/api/threads/list");
      if (!res.ok) throw new Error("Failed to fetch threads");
      const data = (await res.json()) as { threads?: ThreadSummary[] };
      return data.threads ?? [];
    },
  });
}

/** Open a fresh blank chat thread ("New Thread"). Resolves to the new thread id. */
export function useCreateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/threads/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error("Failed to create thread");
      const data = (await res.json()) as { threadId: string };
      return data.threadId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() });
    },
  });
}

/** Re-open a past thread — touches it so it becomes the active (newest) thread. */
export function useActivateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const res = await fetch(`/api/threads/${threadId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error("Failed to activate thread");
      return threadId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() });
    },
  });
}

/**
 * Remove a past thread from the sidebar (archive — reversible at the data layer).
 * Bodyless DELETE; the CSRF guard exempts it from the Content-Type requirement.
 */
export function useArchiveThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const res = await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete thread");
      return threadId;
    },
    // A7: optimistically drop the row so the sidebar updates instantly; roll back if the DELETE fails.
    onMutate: async (threadId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.list() });
      const previous = queryClient.getQueryData<ThreadSummary[]>(
        queryKeys.threads.list(),
      );
      queryClient.setQueryData<ThreadSummary[]>(
        queryKeys.threads.list(),
        (old) => old?.filter((t) => t.id !== threadId) ?? [],
      );
      return { previous };
    },
    onError: (_err, _threadId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.threads.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() });
    },
  });
}
