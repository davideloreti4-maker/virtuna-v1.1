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

import { useMemo } from "react";
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
 * QUERY (derived): the saved row for one originating block, or undefined.
 *
 * This is what makes saved state READABLE. It shipped derived from the save mutation's own
 * `isSuccess` flag, which is per-mount state: a card that was saved last week rendered "Save"
 * again on every fresh mount, and clicking it wrote a SECOND row. Identity is
 * (item_type, ref_id) — `${messageId}:${index}`, stable across reloads because message bodies
 * are immutable — which is the same key the partial unique index now enforces in Postgres.
 *
 * `refId === null` means the block is not persisted yet (a live run has no message row), so
 * there is no identity to match and the answer is honestly undefined rather than a guess.
 *
 * Returns `{ item, ready }`. `ready` is false while the list is loading or errored — an
 * un-fetched list must not be read as "not saved", or the affordance would flash "Save" on
 * every mount and re-introduce the duplicate it exists to prevent.
 */
export function useSavedItemByRef(
  item_type: SavedItemType,
  refId: string | null,
): { item: SavedItem | undefined; ready: boolean } {
  const { data, isSuccess } = useSavedItems();
  return useMemo(() => {
    if (!refId || !isSuccess) return { item: undefined, ready: isSuccess };
    return {
      item: data?.items.find((i) => i.item_type === item_type && i.ref_id === refId),
      ready: true,
    };
  }, [data, isSuccess, item_type, refId]);
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
        project_id: input.project_id ?? null,
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
 * MUTATION: file saved items into a project, or unfile them (`projectId: null`).
 *
 * Bulk, because the shelf's selection mode is the primary caller: "file all my hooks" is one
 * request. Optimistically rewrites project_id on the cached rows so the row leaves Unfiled and
 * the project's derived counts update in the same frame.
 */
export function useFileSavedItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, projectId }: { ids: string[]; projectId: string | null }) => {
      const res = await fetch("/api/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, project_id: projectId }),
      });
      if (!res.ok) throw new Error("Failed to file saved items");
      return (await res.json()) as { updated: number };
    },
    onMutate: async ({ ids, projectId }) => {
      const key = queryKeys.saved.list();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedItemsResponse>(key);
      const idSet = new Set(ids);

      queryClient.setQueryData<SavedItemsResponse>(key, (old) => ({
        items: (old?.items ?? []).map((item) =>
          idSet.has(item.id) ? { ...item, project_id: projectId } : item,
        ),
      }));

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.saved.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.saved.all });
      // Filing touches the destination's updated_at, which orders the project list.
      queryClient.invalidateQueries({ queryKey: queryKeys.libraryProjects.all });
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
