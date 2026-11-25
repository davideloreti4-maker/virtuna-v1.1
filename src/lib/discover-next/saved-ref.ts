/**
 * A video saved from Discover (spec 3.3 "Save"). Library
 * lists it under Saved as "Video · saved in Discover" and a tap opens its page; a video pulled live
 * is saved the same way under a `tiktok:` ref, so its mark survives a reload and Library opens its
 * original, as today. Pure; the row's type is imported as a type only.
 */

import type { SavedItem } from "@/lib/shelf/shelf-repo";

import { lineOf } from "./card";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The longest title the shelf takes (`SavedItemInputSchema`, `title: z.string().max(200)`). */
const TITLE_MAX = 200;

/** A library video's id is a UUID; nothing else saved as a video is. */
export function isLibraryVideoRef(ref: string | null | undefined): boolean {
  return typeof ref === "string" && UUID.test(ref);
}

/** The ref a video pulled live is saved under. */
export function pulledVideoRef(platformVideoId: string): string {
  return `tiktok:${platformVideoId}`;
}

/** The library video a saved row opens: a video saved in Discover (no chat) under a library video's ref; else null. */
export function libraryVideoIdOf(item: Pick<SavedItem, "item_type" | "ref_id" | "thread_id">): string | null {
  if (item.item_type !== "outlier" || item.thread_id !== null) return null;
  return isLibraryVideoRef(item.ref_id) ? item.ref_id : null;
}

/** What Save needs of a video (a library video, or a card pulled live). */
export interface SavableVideo {
  id: string;
  spokenHook: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
  views: number;
  multiplier: number | null;
  baselineLabel: string | null;
  handle: string | null;
  platform: string | null;
  /** The line is a caption (a pulled video): kept as written. */
  captioned?: boolean;
}

/** The snapshot Library's row reads (`saved-item-vm.ts`, the "outlier" case: caption, multiplier,
 *  baselineLabel, views, coverUrl), and what opens the original. */
export interface VideoSnapshot {
  [key: string]: unknown;
  caption: string;
  videoUrl: string | null;
  coverUrl: string | null;
  views: number;
  multiplier: number | null;
  baselineLabel: string | null;
  handle: string | null;
  platform: string | null;
}

/** The saved row of a video: `item_type` "outlier" and `thread_id` null are the hook's to send. */
export interface VideoSave {
  refId: string;
  title: string | null;
  snapshot: VideoSnapshot;
}

/** A title the shelf takes: at most 200 (as the shelf counts), whole characters, no space at the cut. */
function titleOf(line: string): string {
  let title = "";
  for (const char of line) {
    if (title.length + char.length > TITLE_MAX) break;
    title += char;
  }
  return title.trimEnd();
}

function saveOf(video: SavableVideo, refId: string): VideoSave {
  const line = lineOf(video);
  return {
    refId,
    title: line ? titleOf(line) : null,
    snapshot: {
      caption: line ?? "",
      videoUrl: video.videoUrl,
      coverUrl: video.coverUrl,
      views: video.views,
      multiplier: video.multiplier,
      baselineLabel: video.baselineLabel,
      handle: video.handle,
      platform: video.platform,
    },
  };
}

/** A library video's saved row: its id as the ref. */
export function videoSaveOf(video: SavableVideo): VideoSave {
  return saveOf(video, video.id);
}

/** A video pulled live: the same row under `tiktok:<id>` (its id is the platform's). */
export function pulledVideoSaveOf(video: SavableVideo): VideoSave {
  return saveOf(video, pulledVideoRef(video.id));
}
