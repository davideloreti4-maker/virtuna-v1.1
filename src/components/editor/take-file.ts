"use client";

/**
 * take-file.ts — a file as a take to edit (spec §5.1; plan 2026-11-24-editor-screens-a, Task 9): its type as the route signs it,
 * the edit tool's limits (MP4 or MOV, at most 2 GB; its length is measured after the upload), and the take signed for and its
 * upload started. Home's door (`start-edit.ts`) and the page's "Pick the video again" both use it.
 */
import { MAX_TAKE_BYTES, TAKE_TYPES } from "@/lib/edit/worker/takes";
import { call, problemOf } from "./net";
import { startUpload } from "./uploads";

/** The file's type, or one read from its name when the device gave none (".mov", ".mp4"). */
export function takeTypeOf(file: Pick<File, "name" | "type">): string {
  if (file.type !== "") return file.type;
  if (/\.mov$/i.test(file.name)) return "video/quicktime";
  if (/\.mp4$/i.test(file.name)) return "video/mp4";
  return "";
}

/** Why this file cannot be a take to edit, in a line; null when it can. */
export function editTakeProblem(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!(TAKE_TYPES as readonly string[]).includes(takeTypeOf(file))) return "A video to edit is an MP4 or a MOV file.";
  if (file.size > MAX_TAKE_BYTES) return "A video to edit is at most 2 GB.";
  if (file.size === 0) return "This video is empty.";
  return null;
}

/** Signs for the file as a take (`POST /api/edit/takes`) and starts its upload in the holder (`uploads.ts`). */
export async function sendTake(file: File): Promise<{ ok: true; takeId: string } | { ok: false; problem: string }> {
  const problem = editTakeProblem(file);
  if (problem) return { ok: false, problem };
  const type = takeTypeOf(file);
  const signed = await call<{ take: { id: string }; uploadUrl: string }>("/api/edit/takes", { name: file.name, bytes: file.size, type });
  if (!signed.ok) return { ok: false, problem: problemOf(signed) };
  startUpload({ id: signed.body.take.id, uploadUrl: signed.body.uploadUrl, type }, file);
  return { ok: true, takeId: signed.body.take.id };
}
