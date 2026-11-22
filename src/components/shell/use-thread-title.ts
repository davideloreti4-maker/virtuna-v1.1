"use client";

import { useThreadList } from "@/hooks/queries";
import { useBoardStore } from "@/stores/board-store";

/**
 * The open thread's title (new look): the phone's thread header (NextShell) and the desktop thread
 * header (the composer, thread answers step 1) name the thread the same way.
 *
 * `threads.title` of the active thread, trimmed; "New chat" when the list does not hold it or holds
 * it untitled. Empty while the list loads, so a header never flashes "New chat" first.
 */
export function useThreadTitle(): string {
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const { data: threads } = useThreadList();
  return threads === undefined
    ? ""
    : threads.find((t) => t.id === activeThreadId)?.title?.trim() || "New chat";
}
