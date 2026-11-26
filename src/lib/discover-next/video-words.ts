/**
 * A video's words (spec 3.3): the multiple and
 * what it is measured against, the platform's name, the meta line under the heading, why it works in
 * two parts, and the one rule for a web address. Pure.
 */

import { basisOf, timesLabel, viewsLabel } from "@/lib/multiple-words";

import { handleOf, shownViews } from "./card";
import type { CardVideo } from "./hub-data";

/** The platforms by their names. */
export const PLATFORM_NAMES = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" } as const;

/** The watch link of a video on a platform Maven does not name. */
export const WATCH_ORIGINAL = "Watch the original";

export interface MultipleWords {
  /** "16× their average", "8× their followers", "16×", "more than 100× their average". */
  text: string;
  /** Past 100: a small account makes the number shaky (the page says so under the cover). */
  shaky: boolean;
}

/** The multiple in words, for a proven video, and for a creator's own video that beat their usual (`beat`). */
export function multipleWords(video: Pick<CardVideo, "proven" | "extreme" | "multiplier" | "baselineLabel" | "beat">): MultipleWords | null {
  if (!video.proven && !video.beat) return null;
  const basis = basisOf(video.baselineLabel);
  const on = basis ? ` ${basis}` : "";
  if (video.extreme) return { text: `more than 100×${on}`, shaky: true };
  if (video.multiplier === null || !Number.isFinite(video.multiplier)) return null;
  return { text: `${timesLabel(video.multiplier)}${on}`, shaky: false };
}

/** "TikTok", "Instagram", "YouTube"; any other platform, or none: null. */
export function platformName(platform: string | null | undefined): string | null {
  const key = (platform ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLATFORM_NAMES, key) ? PLATFORM_NAMES[key as keyof typeof PLATFORM_NAMES] : null;
}

/** "Watch on TikTok" (Instagram, YouTube); else "Watch the original". */
export function watchLabel(platform: string | null | undefined): string {
  const name = platformName(platform);
  return name ? `Watch on ${name}` : WATCH_ORIGINAL;
}

/** The year a video was posted, read in UTC; null when the date cannot be read. */
function postedYear(postedAt: string | null): number | null {
  if (!postedAt) return null;
  const t = Date.parse(postedAt);
  return Number.isFinite(t) ? new Date(t).getUTCFullYear() : null;
}

/** "@nia.cooks · 25M views · TikTok · 2020"; a missing part is left out with its dot; nothing: null. */
export function videoMeta(video: Pick<CardVideo, "handle" | "views" | "platform" | "postedAt">): string | null {
  const handle = handleOf(video.handle);
  const views = shownViews(video.views);
  const year = postedYear(video.postedAt);
  const parts = [
    handle ? `@${handle}` : null,
    views !== null ? `${viewsLabel(views)} views` : null,
    platformName(video.platform),
    year !== null ? String(year) : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Where a sentence ends: after ".", "!" or "?" (and a closing quote, if one follows), before
 * whitespace and a capital or an opening quote. "Dr. Lee" splits too: the rule reads no
 * abbreviations, and the text it reads is the library's own ("why it works", about 550 characters).
 */
const SENTENCE_END = /[.!?]["”’']?(?=\s+[\p{Lu}"“‘'])/gu;

/** The longest opening of two sentences, in whole characters: two long ones filled six lines of a phone. */
export const WHY_LEAD_MAX = 220;

/**
 * Why it works: the opening, and the rest (null when there is nothing more). The opening is the first
 * two sentences when together they run to 220 characters or fewer; else the first sentence alone.
 */
export function splitWhy(text: string | null | undefined): { lead: string; rest: string | null } | null {
  const body = (text ?? "").trim();
  if (!body) return null;
  // Where the first and the second sentence end (the second may be the end of the text).
  const cuts: number[] = [];
  for (const match of body.matchAll(SENTENCE_END)) {
    cuts.push(match.index + match[0].length);
    if (cuts.length === 2) break;
  }
  const split = (cut: number) => {
    const rest = body.slice(cut).trim();
    return { lead: body.slice(0, cut), rest: rest || null };
  };
  const two = cuts[1] ?? body.length;
  if (Array.from(body.slice(0, two)).length <= WHY_LEAD_MAX) return split(two);
  return cuts[0] !== undefined ? split(cuts[0]) : { lead: body, rest: null };
}

/** A web address to open in a new tab: http(s) only (stored data is never a script). One rule for
 *  Discover and Library. */
export function webAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
