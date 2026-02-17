// src/stores/bookmark-store.ts
//
// Thin Zustand store wrapping the TanStack Query bookmark hooks.
// Components that already use useBookmarkStore continue to work.
// The actual data comes from /api/bookmarks via useBookmarks().
//
// For components that can't use hooks (e.g. event handlers), the store
// provides imperative access. The canonical source of truth is the query cache.

import { create } from "zustand";

interface BookmarkState {
  /** Set of bookmarked video IDs (synced from query cache) */
  bookmarkedIds: Set<string>;
  _isHydrated: boolean;

  /** Called by the provider/component to sync query data into the store */
  syncFromQuery: (ids: string[]) => void;

  /** Optimistic toggle — call the mutation separately */
  optimisticToggle: (videoId: string) => void;

  isBookmarked: (videoId: string) => boolean;
  getBookmarkedIds: () => string[];

  /** @deprecated kept for backwards compat — now a no-op */
  _hydrate: () => void;
  /** @deprecated kept for backwards compat — use optimisticToggle + mutation */
  toggleBookmark: (videoId: string) => void;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarkedIds: new Set<string>(),
  _isHydrated: false,

  syncFromQuery: (ids: string[]) => {
    set({ bookmarkedIds: new Set(ids), _isHydrated: true });
  },

  optimisticToggle: (videoId: string) => {
    const current = get().bookmarkedIds;
    const newSet = new Set(current);
    if (newSet.has(videoId)) {
      newSet.delete(videoId);
    } else {
      newSet.add(videoId);
    }
    set({ bookmarkedIds: newSet });
  },

  isBookmarked: (videoId: string) => {
    return get().bookmarkedIds.has(videoId);
  },

  getBookmarkedIds: () => {
    return Array.from(get().bookmarkedIds);
  },

  _hydrate: () => {
    // No-op — hydration now comes from syncFromQuery
    set({ _isHydrated: true });
  },

  toggleBookmark: (videoId: string) => {
    // Legacy compat — just does optimistic toggle
    get().optimisticToggle(videoId);
  },
}));
