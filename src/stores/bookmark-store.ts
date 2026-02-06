// src/stores/bookmark-store.ts
import { create } from "zustand";

const STORAGE_KEY = "virtuna-bookmarks";

interface BookmarkState {
  bookmarkedIds: Set<string>;
  _isHydrated: boolean;
  _hydrate: () => void;
  toggleBookmark: (videoId: string) => void;
  isBookmarked: (videoId: string) => boolean;
  getBookmarkedIds: () => string[];
}

function loadFromStorage(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveToStorage(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarkedIds: new Set<string>(),
  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        bookmarkedIds: new Set(stored),
        _isHydrated: true,
      });
    } else {
      set({ _isHydrated: true });
    }
  },

  toggleBookmark: (videoId: string) => {
    const current = get().bookmarkedIds;
    const newSet = new Set(current);

    if (newSet.has(videoId)) {
      newSet.delete(videoId);
    } else {
      newSet.add(videoId);
    }

    saveToStorage(Array.from(newSet));
    set({ bookmarkedIds: newSet });
  },

  isBookmarked: (videoId: string) => {
    return get().bookmarkedIds.has(videoId);
  },

  getBookmarkedIds: () => {
    return Array.from(get().bookmarkedIds);
  },
}));
