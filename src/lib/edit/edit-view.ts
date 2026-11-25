/**
 * edit-view.ts — an edit as the page and the card read it: what `GET /api/edit/edits/[id]` answers, and what every route that
 * changes an edit answers (plan 2026-11-24-editor-screens-a; spec §5, §7). Types only, and `LIVE_JOB`.
 */
import type { Asset, Edit } from "./doc";
import type { NextStep } from "./next-steps";
import type { Finding } from "./review";
import type { TurnKind } from "./turns";

/** A job still at work: queued or running (as `liveJob` counts one). */
export const LIVE_JOB: ReadonlySet<string> = new Set(["queued", "running"]);

/** A turn of the conversation: what was asked, what was said, whether it holds an edit, what the review found then and what of it was put away. */
export interface TurnShown {
  n: number;
  kind: TurnKind;
  /** The creator's words; a cut's look key (`house`, a preset's id, `video`, `words`). */
  request: string | null;
  /** The film frame a request was about (slice B, E15); null for none. */
  at: number | null;
  say: string;
  doc: boolean;
  findings: Finding[];
  /** The findings of this turn put away, by key (`findingKey`; slice B, Task 8). */
  kept: string[];
}

/** The take: its state as it stands (`takeState`), its analysis's progress, and once ready its facts and fresh addresses. */
export interface TakeShown {
  id: string;
  name: string;
  /** `uploading`, `analysing`, `ready` or `failed`. */
  status: string;
  error: string | null;
  stage: string | null;
  progress: number | null;
  ms: number | null;
  posterUrl: string | null;
  previewUrl: string | null;
  asset: Asset | null;
}

/** The export of the turn shown: its job as it stands, and the file's address once it is made. */
export interface ExportShown {
  job: string;
  turn: number;
  status: string;
  stage: string | null;
  progress: number;
  error: string | null;
  filmUrl: string | null;
  /** The film's length as rendered, in ms; null until it is made. */
  ms: number | null;
}

export interface EditView {
  id: string;
  title: string;
  threadId: string | null;
  /** The look of the edit shown: a preset's id, `house`, `video`, `words`; null before the first cut. */
  look: string | null;
  updatedAt: string;
  take: TakeShown;
  /** The last turn of the line the creator is on; null before the first cut. */
  head: number | null;
  /** The turn whose edit is shown, and that edit. */
  shown: number | null;
  edit: Edit | null;
  /** Where Undo and Redo go; null where they cannot. */
  undo: number | null;
  redo: number | null;
  /** The conversation: every turn up to `head`. */
  turns: TurnShown[];
  /** The export of the turn shown; null when there is none. */
  export: ExportShown | null;
  /** The steps after the change shown (`nextSteps`, slice B, Task 8); [] when the turn shown is no change. */
  next: NextStep[];
}
