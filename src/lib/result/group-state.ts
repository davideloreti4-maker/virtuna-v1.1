import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import { HEAVY_PCT } from "./curve";
import { groupName, timecode } from "./format";
import type { Audience, GroupRow, GroupStatus, Verdict, Viewer } from "./types";

/**
 * The ten viewer groups at the playhead, in the app's fixed order. Everything is counted by
 * weight, like the number: a group is as large as the weight its viewers carry.
 *
 * A viewer is gone once the playhead passes the END of the scene they leave in, all at once: the
 * engine does not say when inside the scene.
 */
export function groupsAt(audience: Audience, verdict: Verdict, t: number): GroupRow[] {
  const endOf = (scene: number) => audience.scenes[scene]!.t1;
  const stays = (v: Viewer) => v.leftScene == null || t < endOf(v.leftScene);
  return ARCHETYPES.map((group) => {
    const viewers = audience.viewers.filter((v) => v.group === group);
    const weight = viewers.reduce((sum, v) => sum + v.weight, 0);
    const watching = viewers.reduce((sum, v) => sum + (stays(v) ? v.weight : 0), 0);
    // A group can carry no weight at all (its slot is missing from the run's weights). It still
    // has viewers, so its state is counted in viewers instead.
    const stillHere = viewers.filter(stays).length;
    const lit = weight > 0 ? watching / weight : viewers.length > 0 ? stillHere / viewers.length : 0;
    const status: GroupStatus =
      viewers.length === 0 ? "absent" : lit >= 0.999 ? "watching" : lit <= 0.001 ? "left" : "leaving";
    const everyoneLeaves = viewers.length > 0 && viewers.every((v) => v.leftScene != null);
    return {
      group,
      name: groupName(group),
      present: viewers.length > 0,
      weight,
      heavy: viewers.some((v) => v.weight >= HEAVY_PCT),
      lit,
      status,
      leftBy: everyoneLeaves ? Math.max(...viewers.map((v) => endOf(v.leftScene!))) : null,
      named: verdict.scene != null && viewers.length > 0 && viewers.every((v) => v.leftScene === verdict.scene),
    };
  });
}

/** The rows under their headings: who leaves (earliest first), who stays, who is not in the run. */
export function groupSections(rows: GroupRow[]): { left: GroupRow[]; stayed: GroupRow[]; absent: GroupRow[] } {
  const present = rows.filter((r) => r.present);
  return {
    // Array.prototype.sort is stable: groups that leave at the same time keep the app's order.
    left: present.filter((r) => r.leftBy != null).sort((a, b) => a.leftBy! - b.leftBy!),
    stayed: present.filter((r) => r.leftBy == null),
    absent: rows.filter((r) => !r.present),
  };
}

/** The words at the end of a row. No percentages and no head counts. */
export function groupWord(row: GroupRow, t: number, clipS: number): string {
  if (!row.present) return "Not in this run";
  if (row.status === "left") return `Left by ${timecode(row.leftBy ?? t)}`;
  // A group with several viewers of whom only some are gone.
  if (row.status === "leaving") return "Some left";
  return t >= clipS ? "To the end" : "Watching";
}
