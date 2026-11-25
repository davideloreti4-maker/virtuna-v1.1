"use client";

/**
 * start-edit.ts — the door to the editor (spec §3 screen 1, E3, E11; plan 2026-11-24-editor-screens-a, Task 16). A video staged in
 * Home's field may be simulated or edited: it is staged when either takes it (Simulate's 200 MB is not the editor's 2 GB), armed
 * as an Edit when Edit was picked or only Edit takes it, and sent with Edit: the edit tool's checks, the take signed for and its
 * upload started in the holder that outlives a page (`uploads.ts`), the edit made with its chat, then its page, where the take
 * already plays from the device's own copy. A door that fails at any step leaves nothing half made: the creator stays where they
 * are with one sentence of why. The composer calls this from one branch of its send.
 */
import { TAKE_TYPES } from "@/lib/edit/worker/takes";
import { validateVideoFile } from "@/lib/video-file";
import { WENT_WRONG, call, problemOf } from "./net";
import { editTakeProblem, sendTake, takeTypeOf } from "./take-file";
import { forgetUpload } from "./uploads";

/** Whether Simulate takes this file (its own checks). */
export function simulates(file: Pick<File, "name" | "type" | "size">): boolean {
  return validateVideoFile(file as File) === null;
}

/**
 * The field's check of a picked or dropped video with the editor open: staged when either skill takes it. One neither takes is
 * refused in Simulate's words, but for an MP4 or a MOV: that one is past the editor's limit too, the larger of the two, and is
 * told that limit (Simulate's 200 MB is not what this field holds such a file to).
 */
export function stageableVideo(file: File): string | null {
  const simulate = validateVideoFile(file);
  if (simulate === null) return null;
  const edit = editTakeProblem(file);
  if (edit === null) return null;
  return (TAKE_TYPES as readonly string[]).includes(takeTypeOf(file)) ? edit : simulate;
}

/** The skill a staged video is armed with: Edit when Edit was picked or only Edit takes it; Simulate otherwise, and always with the editor closed. */
export function videoSkillOf(file: Pick<File, "name" | "type" | "size">, picked: string, editOpen: boolean): "test" | "edit" {
  if (!editOpen) return "test";
  return picked === "edit" || !simulates(file) ? "edit" : "test";
}

/**
 * Sends a staged video to the editor: the take signed for and its upload started, the edit made, its page opened (`push`).
 * An edit that is not made takes its upload with it: the PUT is stopped and the holder forgets it, so no file goes on
 * uploading for an edit nobody is shown. An answer that is ok and names no edit is no edit.
 */
export async function sendToEditor(file: File | null, push: (href: string) => void): Promise<{ ok: true; id: string } | { ok: false; problem: string }> {
  if (!file) return { ok: false, problem: "Add a video to edit." };
  const sent = await sendTake(file);
  if (!sent.ok) return sent;
  const made = await call<{ id?: unknown }>("/api/edit/edits", { take: sent.takeId });
  const id = made.ok && typeof made.body.id === "string" ? made.body.id : null;
  if (id === null) {
    forgetUpload(sent.takeId);
    return { ok: false, problem: made.ok ? WENT_WRONG : problemOf(made) };
  }
  push(`/edit/${id}`);
  return { ok: true, id };
}
