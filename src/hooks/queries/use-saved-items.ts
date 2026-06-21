"use client";

/**
 * use-saved-items — react-query hook for the typed Saved shelf (Plan 10-04, SAVE-01/02).
 *
 * Mirrors use-bookmarks.ts: a list query + create/delete mutations with optimistic
 * cache updates. The shelf surface (saved-shelf.tsx) reads the list; the Save
 * affordance (save-affordance.tsx) drives the create mutation; saved-item-card
 * drives delete.
 *
 * FLAT: the optional `type` is a client-side filter, NOT a folder. Each filter
 * variant has its own query key; the "all" key holds the unfiltered list.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type {
  SavedItem,
  SavedItemInput,
  SavedItemType,
} from "@/lib/shelf/shelf-repo";

interface SavedItemsResponse {
  items: SavedItem[];
}

/**
 * QUERY: list saved items (optionally filtered by a flat item_type).
 */
export function useSavedItems(type?: SavedItemType) {
  return useQuery({
    queryKey: queryKeys.saved.list(type),
    queryFn: async () => {
      const qs = type ? `?type=${encodeURIComponent(type)}` : "";
      const res = await fetch(`/api/saved${qs}`);
      if (!res.ok) throw new Error("Failed to fetch saved items");
      return res.json() as Promise<SavedItemsResponse>;
    },
  });
}

/**
 * MUTATION: save an item to the shelf.
 *
 * Optimistically prepends a provisional item to the unfiltered list so the Save
 * affordance can flip to "Saved ✓" immediately; the settled refetch reconciles
 * the real row (id, created_at).
 */
export function useSaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SavedItemInput) => {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to save item");
      return (await res.json()) as { item: SavedItem };
    },
    onMutate: async (input) => {
      const key = queryKeys.saved.list();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedItemsResponse>(key);

      const optimistic: SavedItem = {
        id: `optimistic-${Date.now()}`,
        user_id: "",
        item_type: input.item_type,
        ref_id: input.ref_id ?? null,
        thread_id: input.thread_id ?? null,
        title: input.title ?? null,
        snapshot: input.snapshot,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<SavedItemsResponse>(key, (old) => ({
        items: [optimistic, ...(old?.items ?? [])],
      }));

      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.saved.list(), context.previous);
      }
    },
    onSettled: () => {
      // Invalidate every saved-list variant (all + per-type filters).
      queryClient.invalidateQueries({ queryKey: queryKeys.saved.all });
    },
  });
}

/**
 * MUTATION: remove an item from the shelf (never deletes the original output).
 */
export function useDeleteSavedItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/saved?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove saved item");
      return { id };
    },
    onMutate: async (id) => {
      const key = queryKeys.saved.list();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedItemsResponse>(key);

      queryClient.setQueryData<SavedItemsResponse>(key, (old) => ({
        items: (old?.items ?? []).filter((item) => item.id !== id),
      }));

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.saved.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.saved.all });
    },
  });
}
