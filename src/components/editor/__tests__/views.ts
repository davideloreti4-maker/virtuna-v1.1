/**
 * views.ts — `EditView`s as `GET /api/edit/edits/[id]` answers them, for the editor's client tests (plan
 * 2026-11-24-editor-screens-a). Their edits are real: made by the door (`firstEdit`, `applyOps`) from the suite's take (12.7 s,
 * 381 frames, "Good morning. Let us begin").
 */
import { applyOps, type Edit, type Op } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { BUCKET, takeRow } from "@/lib/edit/worker/__tests__/rows";

export const EDIT_ID = "55555555-5555-4555-8555-555555555555";
export const THREAD_ID = "66666666-6666-4666-8666-666666666666";
export const ASSET = assetOf(takeRow(), BUCKET);
export const FIRST = firstEdit(ASSET);
/** When the views were last changed: today, read once a test file, so two views of the same edit are equal. */
export const TODAY = new Date().toISOString();

export function changed(edit: Edit, ops: Op[]): Edit {
  const made = applyOps(edit, ops, [ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
}

/** A ready take and its first cut shown, nothing put away and no steps after it, unless told otherwise. */
export function viewOf(over: Partial<EditView> = {}): EditView {
  return {
    id: EDIT_ID,
    title: "Good morning",
    threadId: THREAD_ID,
    look: "house",
    updatedAt: TODAY,
    take: { id: ASSET.id, name: "take.mp4", status: "ready", error: null, stage: null, progress: null, ms: 12_700, posterUrl: "https://media.test/poster.jpg", previewUrl: "https://media.test/preview.mp4", asset: ASSET },
    head: 1,
    shown: 1,
    edit: FIRST,
    undo: null,
    redo: null,
    turns: [{ n: 1, kind: "cut", request: "house", at: null, say: "Captions are on.", doc: true, findings: [], kept: [] }],
    export: null,
    next: [],
    ...over,
  };
}
