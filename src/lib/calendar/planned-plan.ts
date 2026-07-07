/**
 * planned-plan — turn the persisted planned_posts rows into the /calendar view-model,
 * plus the two pure planning helpers the workspace renders off:
 *
 *   - buildPlannedPlan: rows → { day → PlannedPost } for a viewed (year, monthIndex),
 *     each carrying its glance `face` (tone/stop/lead/fraction) derived from the frozen
 *     personas (personasToCardFace) — the honesty spine: the reaction is REAL, the day
 *     is the creator's own choice.
 *   - recommendedDays: the best-slot heuristic — upcoming empty days that keep a light
 *     posting rhythm (labeled guidance; a real best-time-to-post engine swaps in later).
 *   - cadenceNext7: how many posts land in the next 7 days (the cadence readout).
 *
 * Everything here is PURE (dates parsed from 'YYYY-MM-DD' parts, no wall-clock / TZ
 * surprises) so it's SSR-safe and unit-testable; the caller passes the viewed month +
 * "today" from the server-resolved currentMonth.
 */

import type { ReactionPersona } from "@/lib/tools/blocks";
import { personasToCardFace, type CardFace } from "@/lib/surfaces/live-cards";
import type { WidgetDay } from "@/lib/surfaces/month-plan";
import type { PlannedPostRow, PlannedFormat } from "@/lib/planned-posts/planned-posts-repo";

/** A planned post placed on a specific day of the viewed month. */
export interface PlannedPost {
  id: string; // planned_posts row id
  day: number; // day-of-month within the viewed month
  scheduledDate: string; // 'YYYY-MM-DD'
  contentId: string;
  title: string;
  format: PlannedFormat;
  personas: ReactionPersona[];
  face: CardFace;
}

/** Parse an ISO 'YYYY-MM-DD' into local (year, monthIndex, day) — no Date/TZ drift. */
function parseISODate(iso: string): { year: number; monthIndex: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { year: Number(m[1]), monthIndex: Number(m[2]) - 1, day: Number(m[3]) };
}

/** Format (year, monthIndex, day) back into an ISO 'YYYY-MM-DD'. */
export function toISODate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Glance date labels for an ISO 'YYYY-MM-DD' — e.g. { md: "Jul 8", dow: "Wed" }. The
 * weekday uses `new Date(y, m, d)` on explicit parts (deterministic — NOT a wall-clock
 * read), so it renders identically on server + client (no hydration mismatch).
 */
export function labelWhen(iso: string): { md: string; dow: string } {
  const d = parseISODate(iso);
  if (!d) return { md: iso, dow: "" };
  const dow = DOW_SHORT[new Date(d.year, d.monthIndex, d.day).getDay()] ?? "";
  return { md: `${MONTHS_SHORT[d.monthIndex] ?? ""} ${d.day}`, dow };
}

/**
 * Flatten a plan into the /start month-widget's day cells (1..daysInMonth), carrying each
 * planned day's REAL tone-dot. The glanceable widget + the /calendar workspace now read the
 * SAME planned_posts source, so they agree (they diverged while /start was on the projection).
 */
export function plannedToWidgetDays(
  plan: Record<number, PlannedPost>,
  daysInMonth: number,
): WidgetDay[] {
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const post = plan[day];
    return post ? { day, tone: post.face.tone } : { day };
  });
}

/** A plan as a day-sorted list (the /start today's-plan rows). */
export function plannedToList(plan: Record<number, PlannedPost>): PlannedPost[] {
  return Object.values(plan).sort((a, b) => a.day - b.day);
}

/** The soonest planned post on/after today's ISO date (the up-next hero). Null if none. */
export function nextPlanned(rows: PlannedPostRow[], todayISO: string): PlannedPostRow | null {
  let best: PlannedPostRow | null = null;
  for (const r of rows) {
    if (r.scheduled_date < todayISO) continue;
    if (!best || r.scheduled_date < best.scheduled_date) best = r;
  }
  return best;
}

/**
 * Rows → { day → PlannedPost } for the viewed (year, monthIndex). Rows outside the
 * viewed month are dropped (each month renders its own). If two posts somehow share a
 * day, the later-listed wins (the grid shows one per day; the UI bumps on schedule).
 */
export function buildPlannedPlan(
  rows: PlannedPostRow[],
  year: number,
  monthIndex: number,
): Record<number, PlannedPost> {
  const plan: Record<number, PlannedPost> = {};
  for (const r of rows) {
    const d = parseISODate(r.scheduled_date);
    if (!d || d.year !== year || d.monthIndex !== monthIndex) continue;
    plan[d.day] = {
      id: r.id,
      day: d.day,
      scheduledDate: r.scheduled_date,
      contentId: r.content_id,
      title: r.title,
      format: r.format,
      personas: r.personas,
      face: personasToCardFace(r.personas),
    };
  }
  return plan;
}

/**
 * Best-slot heuristic: up to `count` upcoming empty days that keep a light ~2-day
 * cadence, starting the day after `today`. Guidance only (labeled on the surface) —
 * a real best-time-to-post model (from the creator's engagement history) replaces the
 * step later without touching this signature. Returns [] once the month is full ahead.
 */
export function recommendedDays(
  occupiedDays: Set<number>,
  today: number,
  daysInMonth: number,
  count = 3,
  cadence = 2,
): number[] {
  const recs: number[] = [];
  let last: number | null = null;
  for (let d = today + 1; d <= daysInMonth && recs.length < count; d++) {
    if (occupiedDays.has(d)) continue; // never suggest a taken day
    if (last === null || d - last >= cadence) {
      recs.push(d);
      last = d;
    }
  }
  return recs;
}

/**
 * How many posts land in the next 7 days (today inclusive) — the cadence readout's
 * numerator. Only the base ("today") month contributes; other months pass today=null.
 */
export function cadenceNext7(plan: Record<number, PlannedPost>, today: number | null): number {
  if (today == null) return 0;
  let n = 0;
  for (let d = today; d < today + 7; d++) if (plan[d]) n++;
  return n;
}
