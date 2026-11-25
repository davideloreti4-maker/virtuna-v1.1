/**
 * rows.ts — take and job rows as the worker writes them (X62, X63), for the suite. The ready take is the
 * owner's test take as Task 6 read it back: 12.7 s, 720x1280 with sound, its first words.
 */
import type { TakeRow } from "../takes";
import type { JobRow } from "../jobs";
import { BUCKET } from "./stand-ins";

export const USER = "11111111-1111-4111-8111-111111111111";
export const OTHER = "99999999-9999-4999-8999-999999999999";
export const TAKE = "22222222-2222-4222-8222-222222222222";
export { BUCKET };

const probe = (w: number, h: number) => ({ videoMs: 12700, audioMs: 12714, ms: 12700, w, h, fps: 30, codec: "h264", hdr: false, sound: true, rotation: 0 });

export const WORDS = [
  { text: "Good", startMs: 519, endMs: 921 },
  { text: "morning.", startMs: 940, endMs: 1380 },
  { text: "Let", startMs: 1500, endMs: 1620 },
  { text: "us", startMs: 1620, endMs: 1760 },
  { text: "begin", startMs: 1760, endMs: 2100 },
];

export const keyOf = (name: string, take = TAKE, user = USER) => `u/${user}/takes/${take}/${name}`;

/** A take row; ready and analysed unless told otherwise. */
export function takeRow(over: Partial<TakeRow> = {}): TakeRow {
  const id = over.id ?? TAKE;
  const user = over.user_id ?? USER;
  return {
    id,
    user_id: user,
    status: "ready",
    name: "take.mp4",
    bytes: 4_893_635,
    source_path: keyOf("source", id, user),
    facts: { source: probe(720, 1280), full: probe(720, 1280), preview: probe(540, 960), ms: 12700 },
    words: WORDS,
    analysis: {
      files: { full: keyOf("full.mp4", id, user), preview: keyOf("preview.mp4", id, user), poster: keyOf("poster.jpg", id, user) },
      language: "en", untimed: 0, apart: 2, gaveWay: 0, pauses: [{ startMs: 0, endMs: 519, cutMs: 300 }], faces: [], loudness: null,
    },
    error: null,
    created_at: "2026-11-21T10:00:00.000Z",
    updated_at: "2026-11-21T10:00:00.000Z",
    ...over,
  };
}

/** A take that has just been signed for: no facts yet. */
export const uploadingTake = (over: Partial<TakeRow> = {}): TakeRow => takeRow({ status: "uploading", facts: null, words: null, analysis: null, ...over });

/** A job row; a running analysis of the take unless told otherwise. */
export function jobRow(over: Partial<JobRow> = {}): JobRow {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: USER,
    kind: "analyse",
    take_id: TAKE,
    input: null,
    status: "running",
    stage: "words",
    progress: 0.31,
    result: null,
    error: null,
    call_id: "fc-1",
    created_at: "2026-11-21T10:00:00.000Z",
    started_at: "2026-11-21T10:00:01.000Z",
    finished_at: null,
    updated_at: "2026-11-21T10:00:05.000Z",
    ...over,
  };
}
