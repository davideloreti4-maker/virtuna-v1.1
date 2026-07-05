/**
 * month-plan — project the day's real, pre-tested ideas onto the calendar as a SUGGESTED plan.
 *
 * The content source is the same `LiveIdeaCard[]` the /start daily-ideas section warms (the
 * `ideas` skill: generate → sim → rank, each block carrying its own real per-audience Flash
 * reaction). There is no user-authored `planned_posts` table yet, so the honest v1 "plan" is a
 * DETERMINISTIC projection of those ranked ideas onto upcoming days:
 *
 *   - the REACTION is real (personasToCardFace → tone/stop/lead from the actual Flash personas);
 *   - the DAY is a labeled suggestion ("planned · pre-tested"), never a fabricated reaction.
 *
 * So /start's month widget + today's-plan and the /calendar workspace all read off ONE source
 * (the ideas cache) and agree. Pure + deterministic (no Date/PRNG) — SSR-safe; the caller passes
 * `today`/`daysInMonth` from the server-resolved `currentMonth`.
 */

import type { LiveIdeaCard, CardFace } from "./live-cards";
import { personasToCardFace } from "./live-cards";
import type { Tone } from "@/lib/room-contract/types";

/** A real pre-tested idea placed on a specific day of the month (the calendar's planned post). */
export interface LivePlannedPost {
  day: number; // day-of-month (1..daysInMonth)
  contentId: string; // the idea's stable id — opens the Room via the /start ideas index
  title: string;
  type: LiveIdeaCard["type"]; // Carousel | Reel — the format pill
  personas: LiveIdeaCard["personas"]; // the real Flash reaction → the actual AmbientRoom
  face: CardFace; // derived glance face (tone/stop/lead/fraction) — all from `personas`
}

export interface BuildLivePlanOpts {
  today: number; // day-of-month "today" (the projection's anchor)
  daysInMonth: number; // clamp: a slot past this is dropped (honest — the plan fills what it can)
  /** Days between placed posts (default 2 — the top idea soonest, then a light cadence). */
  cadence?: number;
  /** Days after `today` the first post lands (default 1 — tomorrow; `today` stays "current"). */
  startOffset?: number;
}

/**
 * Project ranked ideas → a `{ day → LivePlannedPost }` map. The top-ranked idea lands on the
 * first posting day (`today + startOffset`), then every `cadence` days. A slot that overflows the
 * month is dropped (the plan only fills days it can — never wraps, never fabricates). Empty ideas
 * (a cold/failed warm) → `{}`, so the calendar shows its honest empty grid.
 */
export function buildLivePlan(
  ideas: LiveIdeaCard[],
  opts: BuildLivePlanOpts,
): Record<number, LivePlannedPost> {
  const cadence = opts.cadence ?? 2;
  const startOffset = opts.startOffset ?? 1;
  const plan: Record<number, LivePlannedPost> = {};

  ideas.forEach((idea, i) => {
    const day = opts.today + startOffset + i * cadence;
    if (day < 1 || day > opts.daysInMonth) return; // overflow → drop (honest sparse)
    plan[day] = {
      day,
      contentId: idea.contentId,
      title: idea.title,
      type: idea.type,
      personas: idea.personas,
      face: personasToCardFace(idea.personas),
    };
  });

  return plan;
}

/** A day cell for the glanceable /start month widget — the planned tone-dot (undefined = empty). */
export interface WidgetDay {
  day: number;
  tone?: Tone;
}

/** Flatten a plan into the widget's day cells (1..daysInMonth), carrying each planned day's tone. */
export function planToWidgetDays(
  plan: Record<number, LivePlannedPost>,
  daysInMonth: number,
): WidgetDay[] {
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const post = plan[day];
    return post ? { day, tone: post.face.tone } : { day };
  });
}

/** The plan as a day-sorted list (today's-plan rows, calendar iteration). */
export function planToList(plan: Record<number, LivePlannedPost>): LivePlannedPost[] {
  return Object.values(plan).sort((a, b) => a.day - b.day);
}
