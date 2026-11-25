/**
 * landing.ts — an answer lands once (thread feel spec §4.3, rulings 11).
 *
 * When a run's cards arrive while the creator watches, its rows come in one after another. The live
 * turn that drew them is folded into history a moment later, and a new element (the persisted copy)
 * mounts in its place; without a memory it would either play the landing again or cut it short. So
 * the first moment an answer landed is remembered here, keyed by the answer as it stands
 * (`landingKeyOf`), and a turn that mounts within `LANDING_WINDOW_MS` of it carries on where the
 * landing was (a negative delay). Any later mount, and every turn of a chat opened later, is drawn
 * at rest.
 *
 * One memory for the page: only the newest answer can be landing. Module state, on purpose: it must
 * outlive the element that landed.
 *
 * Pure apart from that one memory: no React.
 */

import type { CSSProperties } from "react";

import { RESULT_TYPES } from "@/lib/thread-next/answer-parts";
import { cardLinesOf } from "@/lib/tools/chat-followups";

/** Longer than any landing takes: ten staggered rows, the button and the chips are in by ~1.4 s. */
export const LANDING_WINDOW_MS = 1600;

/** The most rows staggered one after another; the rest come in with the tenth (`--i` 9). */
const LAND_ROWS_STAGGERED = 10;

let memory: { key: string; at: number } | null = null;

/** A result block's own stable text, where it has one: a remix's adapted hook, a video run's id. */
const OWN_TEXT: Readonly<Record<string, string>> = { "remix-card": "adaptedHook", "video-test-card": "analysisId" };

/** A raw block's type, when it is a result card's. */
function resultTypeOf(raw: unknown): string | null {
  const t = (raw as { type?: unknown } | null)?.type;
  return typeof t === "string" && RESULT_TYPES.has(t) ? t : null;
}

/**
 * The answer a turn holds as it stands, as the landing knows it: what it starts with, then how many
 * result blocks it holds ("<first>|3"). What it starts with is its first card line, trimmed (a hook,
 * an idea, a script's beat); a turn with a result card but no card line (a remix, a video, an
 * account read, an outlier grid) is known by its first result block: the type and its own text where
 * it has one ("remix-card:<adapted hook>"), else the type alone. The count tells a second pack in
 * the same turn (a chat turn that runs twice) from the first, so it lands too; the persisted copy of
 * the turn holds the same result blocks (its run headers and closing line are none), so it still
 * matches. A turn with no result card has none.
 */
export function landingKeyOf(blocks: readonly unknown[]): string | null {
  const count = blocks.filter((b) => resultTypeOf(b) !== null).length;
  if (count === 0) return null;
  const line = cardLinesOf(blocks)[0]?.trim();
  if (line) return `${line}|${count}`;
  const b = blocks.find((raw) => resultTypeOf(raw) !== null) as { type: string; props?: Record<string, unknown> };
  const field = OWN_TEXT[b.type];
  const own = field ? b.props?.[field] : undefined;
  const text = typeof own === "string" ? own.trim() : "";
  return `${text ? `${b.type}:${text}` : b.type}|${count}`;
}

/**
 * The answer `key` has landed: remembers the first moment it did and returns the ms since then (0 on
 * the first call). Marking it again keeps that first moment, so a render that runs twice stays at
 * the same point of the landing. A different key replaces the memory.
 */
export function markLanded(key: string, now: number = Date.now()): number {
  if (memory?.key === key) return Math.max(0, now - memory.at);
  memory = { key, at: now };
  return 0;
}

/**
 * The landed answer `from` grew in place, with no wait between (a dispatched pack's cards arrive one
 * by one, the key's count going up each time): the memory now answers to `to`, from the same first
 * moment, so the persisted copy that holds the whole answer still carries on. A memory that holds
 * another answer is left as it is.
 */
export function landingGrew(from: string, to: string): void {
  if (memory?.key === from) memory = { key: to, at: memory.at };
}

/** The ms since `key` landed, while that is inside the window; otherwise null (draw it at rest). */
export function landedAgo(key: string, now: number = Date.now()): number | null {
  if (memory?.key !== key) return null;
  const ago = now - memory.at;
  return ago >= 0 && ago <= LANDING_WINDOW_MS ? ago : null;
}

/** For tests: forget the last landing. */
export function resetLanding(): void {
  memory = null;
}

/** A row's place in the landing: one after another, the rest with the tenth. */
export function rowLand(index: number): number {
  return Math.min(index, LAND_ROWS_STAGGERED - 1);
}

/** The place of what comes after `count` rows (a card's button): after the last staggered row. */
export function afterRows(count: number): number {
  return count <= 0 ? 0 : rowLand(count - 1) + 1;
}

/** The `--i` a `land` element carries (globals.css: `[data-thread-landing] .land`, 70 ms apart). */
export function landStyle(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}
