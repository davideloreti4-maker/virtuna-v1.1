"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

/** A sidebar chat-thread summary (active = index 0, newest-first). */
export interface ThreadSummary {
  id: string;
  title: string | null;
  updated_at: string;
  created_at: string;
  /** Timestamp the user pinned this thread; null = unpinned. */
  pinned_at: string | null;
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

/**
 * Rename a thread, or clear the title back to automatic derivation by passing "".
 *
 * Optimistic: the sidebar label swaps immediately and rolls back on failure. A
 * rename that only lands after a network round-trip feels broken — the user has
 * just typed the words and is looking straight at the row.
 */
export function useRenameThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to rename thread");
      return res.json();
    },
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.list() });
      const prev = queryClient.getQueryData<ThreadSummary[]>(queryKeys.threads.list());
      queryClient.setQueryData<ThreadSummary[]>(queryKeys.threads.list(), (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, title: title.trim() || null } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.threads.list(), ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() });
    },
  });
}

/**
 * Pin or unpin a thread.
 *
 * Optimistic, and it RE-SORTS locally rather than waiting for the server list:
 * pinning is a reordering action, so a row that stays put until the refetch lands
 * reads as "the click didn't work". Mirrors the server order in
 * listOpenThreads — pinned first (most recently pinned first), then by recency.
 */
export function usePinThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) throw new Error("Failed to pin thread");
      return res.json();
    },
    onMutate: async ({ id, pinned }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.list() });
      const prev = queryClient.getQueryData<ThreadSummary[]>(queryKeys.threads.list());
      queryClient.setQueryData<ThreadSummary[]>(queryKeys.threads.list(), (old) =>
        [...(old ?? [])]
          .map((t) => (t.id === id ? { ...t, pinned_at: pinned ? new Date().toISOString() : null } : t))
          .sort((a, b) => {
            if (a.pinned_at && !b.pinned_at) return -1;
            if (!a.pinned_at && b.pinned_at) return 1;
            if (a.pinned_at && b.pinned_at) return b.pinned_at.localeCompare(a.pinned_at);
            return b.updated_at.localeCompare(a.updated_at);
          }),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.threads.list(), ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() });
    },
  });
}
