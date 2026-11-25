/**
 * A chat's posted piece as the Library endpoint sends it (`summary.posted`, plan 2026-11-24-after-posting),
 * for the Library's and Home's tests. Every handle and id is made up (the repository is public). Times
 * are given by the caller, against its own clock.
 */
import type { Posted } from "@/lib/posted/posted";

const HOUR = 3_600_000;

/** A final post, 1.8× the account's usual, 31K views. `postedAt` an ISO time (or null: unknown). */
export function postedPiece(postedAt: string | null, over: Partial<Posted> = {}): Posted {
  const at = postedAt === null ? null : Date.parse(postedAt);
  return {
    id: "p0000000-0000-4000-8000-000000000001",
    threadId: null,
    pieceKey: "piece-key-1",
    said: { number: 66, measure: "stop" },
    state: "final",
    linkedAt: postedAt ?? new Date(0).toISOString(),
    postedAt,
    finalAt: at === null ? null : new Date(at + 72 * HOUR).toISOString(),
    numbers: { views: 31_000, likes: 2_100, comments: 84, shares: 310, saves: 420 },
    usual: { ratio: 1.8, tone: "above" },
    handle: "nia.cooks",
    href: "https://www.tiktok.com/@nia.cooks/video/7301444403323456789",
    due: false,
    ...over,
  };
}

/** Read, younger than 72 hours: 12.4K views so far. */
export const soFarPiece = (postedAt: string, over: Partial<Posted> = {}): Posted =>
  postedPiece(postedAt, { state: "so-far", numbers: { views: 12_400, likes: 890, comments: 31, shares: 96, saves: 140 }, usual: null, ...over });

/** Just linked: nothing read yet, a read owed. */
export const readingPiece = (over: Partial<Posted> = {}): Posted =>
  postedPiece(null, { state: "reading", numbers: null, usual: null, handle: null, href: null, finalAt: null, due: true, ...over });

/** Private, deleted, or the reads failed. */
export const unreadPiece = (over: Partial<Posted> = {}): Posted => readingPiece({ state: "unread", due: false, ...over });

/**
 * The window's width as the browser's CSS would draw it: the few Tailwind rules a row's line and column
 * switch on at 768 (`md:hidden`, `max-md:hidden`, `hidden md:block`). The test DOM loads no stylesheet,
 * so without this every form of the line would be "visible" at once. Returns its removal.
 */
export function atWidth(view: "phone" | "desk"): () => void {
  const style = document.createElement("style");
  style.textContent =
    view === "phone"
      ? ".hidden{display:none}.max-md\\:hidden{display:none}"
      : ".hidden{display:none}.md\\:hidden{display:none}.md\\:block{display:block}";
  document.head.appendChild(style);
  return () => style.remove();
}
