"use client";

/**
 * use-library — the Library's chats, a page at a time (plan 2026-11-23-library).
 *
 * `GET /api/threads/library`, keyset-paged on each page's `next`. One cache entry per search text,
 * trimmed. Its own key, apart from `["threads", "list"]`: that short list feeds the sidebar, Home and
 * ⌘K and stays as it is.
 */

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { LibraryPage } from "@/lib/library/library-page";

export const libraryKeys = {
  all: ["library"] as const,
  chats: (q: string) => ["library", "chats", q.trim()] as const,
  /** Home's Recent: the first page alone, apart from the Library's pages. */
  recent: ["library", "recent"] as const,
};

function libraryUrl(q: string, cursor: string | null): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/api/threads/library?${query}` : "/api/threads/library";
}

/**
 * The creator's chats whose title contains `q` (all of them for a blank `q` (untitled chats that hold nothing are left out by the server)), newest first.
 *
 * A request for a text that is no longer asked for is aborted (TanStack's `signal`). While a new
 * text loads, the previous rows stay (`isPlaceholderData` says they are the previous text's).
 */
export function useLibraryChats(q: string): UseInfiniteQueryResult<InfiniteData<LibraryPage>> {
  const text = q.trim();
  return useInfiniteQuery({
    queryKey: libraryKeys.chats(text),
    queryFn: async ({ pageParam, signal }) => {
      const res = await fetch(libraryUrl(text, pageParam), { signal });
      if (!res.ok) throw new Error(`Library request failed (${res.status})`);
      return (await res.json()) as LibraryPage;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next,
    placeholderData: keepPreviousData,
  });
}

/**
 * The first page of the creator's chats, for Home's Recent.
 *
 * One `GET /api/threads/library` (no cursor, no search) under its own key: a refetch is that one
 * request, never every page the Library has loaded into its own entry. No retry: a failure leaves Home
 * on the chat list's rows, and a funnel visitor (the route answers 404) costs one request, not four.
 */
export function useLibraryRecent(): UseQueryResult<LibraryPage> {
  return useQuery({
    queryKey: libraryKeys.recent,
    queryFn: async ({ signal }) => {
      const res = await fetch(libraryUrl("", null), { signal });
      if (!res.ok) throw new Error(`Library request failed (${res.status})`);
      return (await res.json()) as LibraryPage;
    },
    retry: false,
  });
}
