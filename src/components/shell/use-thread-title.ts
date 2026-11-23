"use client";

import { useThreadList } from "@/hooks/queries";
import { THREAD_TITLE_MAX } from "@/lib/threads/title";
import { useBoardStore } from "@/stores/board-store";

/**
 * A stored title as a header shows it. Titles are stored cut to `THREAD_TITLE_MAX` characters,
 * wherever that falls ("…meal prep for busy stu"): one that fills the cap is taken back to its
 * last whole word and ends on "…", so it reads as cut and never as a typo (review 2026-11-23).
 * A shorter title is shown as stored.
 */
export function shownThreadTitle(title: string): string {
  if (title.length < THREAD_TITLE_MAX) return title;
  const lastSpace = title.lastIndexOf(" ");
  // A cap-long title with no late space is one long token: keep it, mark it as cut.
  const whole = lastSpace >= THREAD_TITLE_MAX / 2 ? title.slice(0, lastSpace) : title;
  return `${whole.replace(/[\s,;:.!?–—-]+$/, "")}…`;
}

/**
 * The open thread's title (new look): the phone's thread header (NextShell) and the desktop thread
 * header (the composer, thread answers step 1) name the thread the same way.
 *
 * `threads.title` of the active thread, trimmed (`shownThreadTitle`); "New chat" when the list does
 * not hold it or holds it untitled. Empty while the list loads, so a header never flashes "New chat"
 * first.
 */
export function useThreadTitle(): string {
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const { data: threads } = useThreadList();
  if (threads === undefined) return "";
  const title = threads.find((t) => t.id === activeThreadId)?.title?.trim();
  return title ? shownThreadTitle(title) : "New chat";
}
