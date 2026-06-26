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
