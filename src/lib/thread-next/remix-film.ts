/**
 * remix-film.ts — what a remix's "How to film it" sheet holds (thread depth spec, second part §4).
 *
 * Known from the card itself (`remixFilmOf`), so it decides whether the card has the button at all:
 * - "Why the original worked": the decode's plain line (`whyPlain`) alone when it has one; for a remix
 *   stored before it existed, the decode's `hookPattern`, then its `theTurn` under it. One of the
 *   two missing: the other alone (as the row's text). Both missing: no row.
 * - The plan, when the card has `production`: the script's own rows (`filmPlanOf`).
 * - Neither: null, and the card has no button. A `blueprintId` alone is not enough: what it holds is
 *   only known once it is read.
 *
 * Read from `GET /api/remix/blueprint/[id]` when the sheet first opens (`remixBeatsOf`): your version
 * of each beat, for this card's variant (`blueprintVariant`, absent: 0). Each adapted beat is matched
 * to the original beat with the same `index`, which names it by its role (Hook, Setup, Turn, Payoff,
 * Close) and gives its span ("3 to 9 s"). What to say first; then one paragraph of the shot, "On
 * screen: …" and what to do differently (`repair`). A beat with nothing to say and nothing to shoot
 * has no row. A timing that could not be read (`from_fixed_buckets`), no beats for the variant, or an
 * answer of any other shape: no rows. The answer is not trusted: it is read field by field.
 *
 * Pure: no React, no fetch.
 */

import type { RemixCardBlock } from "@/lib/tools/blocks";

import { beatName } from "./beat-name";
import { filmPlanOf, type FilmPlanRow } from "./film-notes";

type RemixProps = RemixCardBlock["props"];

export interface RemixFilm {
  /** "Why the original worked": `text` in the ink, `sub` under it in the secondary ink. */
  why: { text: string; sub: string | null } | null;
  plan: FilmPlanRow[];
  /** What to read the beats from; null: the sheet has no beat rows. */
  blueprintId: string | null;
  /** Which of the read's scripts is this card's. */
  variant: number;
}

export interface RemixBeatRow {
  /** The original beat's role, as a name; null without one. */
  name: string | null;
  /** "3 to 9 s"; null when its times cannot be read. */
  span: string | null;
  /** What to say, trimmed (the sheet puts it in quotes); null when there are no words. */
  say: string | null;
  /** The shot, "On screen: …" and the repair, as one paragraph; null when there is none. */
  notes: string | null;
}

export function remixFilmOf(props: Pick<RemixProps, "sourceDecode" | "production" | "blueprintId" | "blueprintVariant">): RemixFilm | null {
  const pattern = props.sourceDecode?.hookPattern.trim() || null;
  const turn = props.sourceDecode?.theTurn.trim() || null;
  const plain = props.sourceDecode?.whyPlain?.trim() || null;
  const lead = pattern ?? turn;
  const why = plain ? { text: plain, sub: null } : lead ? { text: lead, sub: pattern ? turn : null } : null;
  const plan = filmPlanOf(props.production);
  if (!why && plan.length === 0) return null;
  return { why, plan, blueprintId: props.blueprintId ?? null, variant: props.blueprintVariant ?? 0 };
}

const record = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The role as a name: "hook" is "Hook" (and "cta" "Call to action", as a script's beat). */
function roleName(role: unknown): string | null {
  const r = text(role);
  return r ? beatName(r.charAt(0).toUpperCase() + r.slice(1)) : null;
}

/**
 * "3 to 9 s" in whole seconds; "3 s" when both round to the same second (a beat shorter than a
 * second); null when either end is missing or the end comes before the start.
 */
function spanOf(beat: Record<string, unknown> | undefined): string | null {
  const start = finite(beat?.t_start);
  const end = finite(beat?.t_end);
  if (start === null || end === null || end < start) return null;
  const [from, to] = [Math.round(start), Math.round(end)];
  return from === to ? `${from} s` : `${from} to ${to} s`;
}

/** A comma, semicolon, colon or dash at the end, with the space around it. */
const TRAILING_MARK = /[\s,;:\-–—]+$/u;

/**
 * A piece of the paragraph: a comma, semicolon, colon or dash at its end dropped, capitalised, and
 * ended with a full stop unless it ends on punctuation of its own. Nothing left: no piece.
 */
function piece(s: string): string {
  const body = s.replace(TRAILING_MARK, "");
  if (body.length === 0) return "";
  const capital = body.charAt(0).toUpperCase() + body.slice(1);
  return /[.?!…]["'”’)]*$/.test(capital) ? capital : `${capital}.`;
}

function notesOf(adapted: Record<string, unknown>): string | null {
  const shot = text(adapted.shot);
  const onScreen = text(adapted.on_screen_text).replace(TRAILING_MARK, "");
  const repair = text(adapted.repair);
  const pieces = [shot, onScreen ? `On screen: ${onScreen}` : "", repair].map(piece).filter((p) => p.length > 0);
  return pieces.length > 0 ? pieces.join(" ") : null;
}

export function remixBeatsOf(answer: unknown, variant: number): RemixBeatRow[] {
  const root = record(answer);
  const blueprint = record(root?.blueprint);
  if (!blueprint || blueprint.from_fixed_buckets === true) return [];
  const originals = (Array.isArray(blueprint.beats) ? blueprint.beats : []).map(record).filter((b): b is Record<string, unknown> => b !== null);
  if (originals.length === 0) return [];
  const scripts = root?.script;
  const mine = Array.isArray(scripts) ? scripts[variant] : undefined;
  if (!Array.isArray(mine)) return [];

  const rows: RemixBeatRow[] = [];
  for (const adapted of mine.map(record)) {
    if (!adapted) continue;
    const say = text(adapted.spoken) || null;
    const notes = notesOf(adapted);
    if (!say && !notes) continue;
    // Matched only when both indexes are numbers: two beats without one are not the same beat.
    const index = adapted.index;
    const original = typeof index === "number" ? originals.find((b) => b.index === index) : undefined;
    rows.push({ name: roleName(original?.role), span: spanOf(original), say, notes });
  }
  return rows;
}
