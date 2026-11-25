/**
 * takes.ts — a take as the app gives it out: the row the worker wrote (X62) as a file of the edit, with the
 * facts the worker measured and from nowhere else (N5); the state it is in; the first edit made of it; and
 * which files of an edit asked to render are not takes of the creator's as measured.
 *
 * Pure: no storage and no database, so the page can use it too. The routes read and write the rows.
 */
import { z } from "zod";
import { AssetSchema, WordsSchema, applyOps, newEdit, type Asset, type Edit, type Problem } from "@/lib/edit";
import type { Database } from "@/types/database.types";
import type { JobRow } from "./jobs";
import { STALE_MS } from "./stale";

export type TakeRow = Database["public"]["Tables"]["edit_takes"]["Row"];

/** MP4 and QuickTime only (X67): a Matroska take's streams have no length of their own to hold its sound to. */
export const TAKE_TYPES = ["video/mp4", "video/quicktime"] as const;
export const MAX_TAKE_BYTES = 2 * 1024 ** 3;
/** The longest take (X56). The film is at most three minutes, cut from a take of up to ten. */
export const MAX_TAKE_MS = 10 * 60 * 1000;

/** What the browser says of a file before it uploads it. Its length is not asked: the worker measures it (N5). */
export const UploadSchema = z.strictObject({
  name: z.string().trim().min(1, "a take has its file's name").max(255, "a file's name is at most 255 characters"),
  bytes: z.number().int("a whole number of bytes").min(1, "a take is not empty").max(MAX_TAKE_BYTES, "a take is at most 2 GB"),
  type: z.enum(TAKE_TYPES, "a take is an MP4 or QuickTime video"),
});

/** What the app reads of a ready take's row; the rest of it is kept for the agent (X62). */
const FactsSchema = z.object({ ms: z.number().int().min(1), full: z.object({ w: z.number().int().min(1), h: z.number().int().min(1), sound: z.boolean() }) });
const CopiesSchema = z.object({ files: z.object({ full: z.string().min(1), preview: z.string().min(1), poster: z.string().min(1) }) });

/** The keys in R2 of a ready take's copies. */
export function copiesOf(take: TakeRow): { full: string; preview: string; poster: string } {
  const copies = CopiesSchema.safeParse(take.analysis);
  if (!copies.success) throw new Error(`take ${take.id}: its row does not hold a take's copies`);
  return copies.data.files;
}

/**
 * A ready take as a file of the edit: its id is the take's, it is kept at its full copy, and its length, size,
 * sound and words are the worker's. Throws for a take that is not ready, or a row that does not hold a take.
 */
export function assetOf(take: TakeRow, bucket: string): Asset {
  if (take.status !== "ready") throw new Error(`take ${take.id} is ${take.status}, not ready`);
  const facts = FactsSchema.safeParse(take.facts);
  const words = WordsSchema.nullable().safeParse(take.words);
  const asset = facts.success && words.success
    ? AssetSchema.safeParse({
      id: take.id, kind: "video", origin: "filmed", at: { bucket, path: copiesOf(take).full },
      ms: facts.data.ms, w: facts.data.full.w, h: facts.data.full.h, sound: facts.data.full.sound,
      words: words.data?.length ? words.data : null,
    })
    : null;
  if (!asset?.success) throw new Error(`take ${take.id}: its row does not hold a take's facts`);
  return asset.data;
}

export interface TakeState {
  status: string;
  error: string | null;
}

/**
 * What a take is now. While it is analysing, its latest job decides: a failed one (or one that stopped, as the
 * job's own state says) fails the take with the job's message, and with no job at all (`latest` null: looked up,
 * and none) two minutes after it was last touched, its analysis was never started (the app died between the take
 * and its job). With its jobs not looked up (`latest` left out), an analysing take is analysing (143). A ready take
 * stays ready when an analysis of it fails again (X71), unless it is longer than ten minutes (X56), which is
 * known only once the worker has measured it. Otherwise it is what its row says.
 */
export function takeState(take: TakeRow, latest?: Pick<JobRow, "status" | "error"> | null, now = Date.now()): TakeState {
  if (take.status === "analysing" && latest?.status === "failed") return { status: "failed", error: latest.error ?? "its analysis failed" };
  if (take.status === "analysing" && latest === null && now - Date.parse(take.updated_at) > STALE_MS) return { status: "failed", error: "its analysis was never started" };
  const ms = (take.facts as { ms?: unknown } | null)?.ms;
  if (take.status === "ready" && typeof ms === "number" && ms > MAX_TAKE_MS) {
    return { status: "failed", error: `${take.name} is ${(ms / 60_000).toFixed(1)} minutes long; a take is at most ${MAX_TAKE_MS / 60_000} minutes` };
  }
  return { status: take.status, error: take.error };
}

/** What a creator is shown of a take, in the state it is in. */
export function takeView(take: TakeRow, state: TakeState): { id: string; name: string; bytes: number; status: string; error: string | null } {
  return { id: take.id, name: take.name, bytes: take.bytes, status: state.status, error: state.error };
}

/** The first edit of a take: all of it (its first three minutes, when longer), its own captions on, the natural look. Through the door. */
export function firstEdit(asset: Asset): Edit {
  const made = applyOps(newEdit(asset), [{ op: "captions.set", on: true }, { op: "look.set", preset: "natural" }], [asset]);
  if (!made.ok) throw new Error(`the first edit of "${asset.id}" is refused: ${made.problems.map((problem) => problem.message).join("; ")}`);
  return made.edit;
}

/**
 * Each file of an edit asked to render that is neither a kit file nor a ready take of this creator's, as the
 * worker measured it. The words may be retold, hidden or stressed; their times, like every other fact, are
 * the take's. `takes` are the creator's own rows, as their session reads them.
 */
export function refusedFiles(edit: Edit, takes: readonly TakeRow[], bucket: string): Problem[] {
  return edit.assets.flatMap((asset, i) => {
    if ("kit" in asset.at) return [];
    const say = (message: string): Problem[] => [{ path: `assets.${i}`, id: asset.id, message: `the file "${asset.id}" ${message}` }];
    const take = takes.find((candidate) => candidate.id === asset.id);
    if (!take) return say("is not one of your takes");
    const state = takeState(take); // its jobs not looked up: an analysing take reads as analysing (143)
    if (state.status !== "ready") return say(`is not ready: its take is ${state.status}${state.error ? ` (${state.error})` : ""}`);
    const differs = differenceOf(asset, assetOf(take, bucket));
    return differs ? say(`is not as its take was measured: ${differs}`) : [];
  });
}

/** What of a file asked for is not as measured, or null when nothing is. */
function differenceOf(asked: Asset, measured: Asset): string | null {
  if (asked.kind !== measured.kind) return "its kind is not the take's";
  if (asked.origin !== measured.origin) return "its origin is not the take's";
  const place = (asset: Asset) => ("kit" in asset.at ? `kit ${asset.at.kit}` : `${asset.at.bucket} ${asset.at.path}`);
  if (place(asked) !== place(measured)) return "where it is kept is not the take's";
  if (asked.kind !== "video" || measured.kind !== "video") return null;
  for (const key of ["ms", "w", "h", "sound"] as const) if (asked[key] !== measured[key]) return `its ${key} is not the take's`;
  const times = (clip: typeof asked) => JSON.stringify(clip.words?.map((word) => [word.startMs, word.endMs]) ?? null);
  return times(asked) === times(measured) ? null : "its words are not the take's";
}
