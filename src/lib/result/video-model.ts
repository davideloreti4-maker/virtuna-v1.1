import { avgWatchSeconds } from "./avg-watch";
import { audienceOf } from "./curve";
import { timecode } from "./format";
import { headlineOf } from "./headline";
import type { Intent, ResultRow, ResultState } from "./types";
import { verdictOf } from "./verdict";

const INTENTS: ReadonlyArray<{ id: Intent["id"]; label: string; key: "share_pct" | "comment_pct" | "loop_pct" | "save_pct" }> = [
  { id: "share", label: "Share", key: "share_pct" },
  { id: "comment", label: "Comment", key: "comment_pct" },
  { id: "rewatch", label: "Rewatch", key: "loop_pct" },
  { id: "save", label: "Save", key: "save_pct" },
];

/**
 * How long a run may stay "in flight" before the page stops believing it. When the pipeline
 * crashes, the placeholder row is never updated and reads as in flight forever; the row's polling
 * gives up at the same six minutes (`analysisDetailQuery`).
 */
export const STALLED_AFTER_MS = 360_000;

/** Only an uploaded or linked video has a file the app can sign and play. */
function videoPathOf(row: ResultRow): string | null {
  const playable = row.input_mode === "video_upload" || row.input_mode === "tiktok_url";
  return playable && row.video_storage_path ? row.video_storage_path : null;
}

function intentsOf(row: ResultRow): Intent[] | null {
  const stored = row.persona_behavioral_aggregate;
  if (!stored) return null;
  return INTENTS.map(({ id, label, key }) => ({ id, label, value: stored[key] ?? 0 })).sort(
    (a, b) => b.value - a.value,
  );
}

/**
 * The one object the video result page renders from.
 *
 * It holds the number, the sentence, the moment, the line and the groups, and nothing from the
 * craft grader: its score, its confidence label and its "Don't post yet" line change between
 * runs of one clip and are not shown (owner ruling 2026-11-19).
 */
export function videoStateOf(row: ResultRow | null | undefined, now: number = Date.now()): ResultState {
  if (!row) return { kind: "loading" };
  if (row.processing) {
    const started = row.created_at ? Date.parse(row.created_at) : Number.NaN;
    const stalled = Number.isFinite(started) && now - started > STALLED_AFTER_MS;
    return { kind: stalled ? "stalled" : "running", id: row.id };
  }

  const audience = audienceOf(row);
  if (!audience) return { kind: "no-audience", id: row.id, title: "Video", videoPath: videoPathOf(row) };

  const verdict = verdictOf(audience);
  return {
    kind: "result",
    model: {
      id: row.id,
      title: `Video · ${timecode(audience.clipS)}`,
      clipS: audience.clipS,
      audience,
      headline: headlineOf(audience),
      verdict,
      moment: verdict.scene == null ? null : audience.scenes[verdict.scene]!,
      avgWatchS: avgWatchSeconds(audience),
      intents: intentsOf(row),
      videoPath: videoPathOf(row),
    },
  };
}
