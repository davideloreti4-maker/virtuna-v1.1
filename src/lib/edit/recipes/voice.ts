/**
 * voice.ts — the shots made as loud as one another (N8). Pure.
 *
 * The rule, as built (the brief, with ruling B3 of part 3's Task 4):
 * - A shot's loudness is the power mean of its take's levels (the worker's momentary loudness every
 *   500 ms, X62) whose moment lies in its stretch, `10·log10(mean(10^(L/10)))`, leaving out the
 *   levels at the worker's floor, -70, which is silence (BS.1770's absolute gate). What the shot is
 *   heard at adds its own volume: `+ 20·log10(volume)`.
 * - The film's target is the median of what its shots are heard at.
 * - A shot heard more than 1 LU off it gets the volume that brings it there,
 *   `volume × 10 ** ((target − heard) / 20)`, which is `10 ** ((target − lufs) / 20)` of its take's
 *   own loudness: held to 0.71 to 1.41 (±3 dB, Task 10's fix round 2: nobody has listened to more)
 *   and rounded to two places.
 * - A piece shorter than 3 s of film is not levelled on its own: it takes the volume of the longer of
 *   the nearest pieces of its own take, at least 3 s long and not muted, on either side of it among the
 *   shots next to it (fix round 2: a punch-in's split had given a 1 s piece 1.58 between 0.82 and 1.0);
 *   with none, it keeps its own (fix round 3). Either way the volume is held to 0.71 to 1.41. The film's
 *   target is worked out from the longer pieces only.
 * - Clamping and rounding move the median, so the volumes are applied and the target worked out again
 *   until nothing changes (fix rounds 1 and 2, I3): at most once more than there are shots, and no
 *   further once a set of volumes comes round again. The operations are the volumes that end up
 *   different, so a second run changes nothing. If it stopped at the cap or on a repeat, `levelled`
 *   says so; it is pure, so the caller logs it.
 * - Left alone and not counted: a shot of a take without loudness or analysis, a muted shot, and a
 *   shot with no level above silence in its stretch.
 */
import type { Analyses } from "../analysis";
import { assetOf } from "../derive";
import type { Edit } from "../doc";
import type { Op } from "../ops";
import { analysisFor } from "./tighten";

/** The worker's floor: nothing reads under -70 LUFS, which is silence. */
const SILENCE = -70;
/** How far off the target a shot may be heard and be left alone, in LU. */
const NEAR = 1;
const VOLUME = { min: 0.71, max: 1.41 } as const;
/** A piece shorter than this, in ms of film, takes a longer neighbour's volume. */
const SHORT_MS = 3000;

/** What `levelVoice` did: its operations, how many times it worked the target out, and why it stopped. */
export interface Levelled {
  ops: Op[];
  rounds: number;
  /** "stable": a round changed nothing; "cap": it stopped at one round more than there are shots; "cycle": a set of volumes came round again. */
  settled: "stable" | "cap" | "cycle";
}

/** `shot.set { volume }` for each shot heard more than 1 LU off the film's median. */
export function levelVoice(edit: Edit, analyses: Analyses): Op[] {
  return levelled(edit, analyses).ops;
}

/** `levelVoice`, with how it settled. */
export function levelled(edit: Edit, analyses: Analyses): Levelled {
  const loudnessOf = (shot: Edit["shots"][number]) => {
    const asset = assetOf(edit, shot.asset);
    return asset?.kind === "video" ? analysisFor(analyses, asset.id)?.loudness : null;
  };
  const isShort = (shot: Edit["shots"][number]) => (shot.endMs - shot.startMs) / shot.speed < SHORT_MS;
  const shots = edit.shots.flatMap((shot) => {
    const loudness = loudnessOf(shot);
    if (!loudness || shot.volume <= 0 || isShort(shot)) return [];
    const levels = loudness.levels.filter((level) => shot.startMs <= level.ms && level.ms < shot.endMs && level.lufs > SILENCE);
    if (levels.length === 0) return [];
    return [{ shot, lufs: 10 * Math.log10(levels.reduce((sum, level) => sum + 10 ** (level.lufs / 10), 0) / levels.length) }];
  });
  let volumes = shots.map(({ shot }) => shot.volume);
  const seen = new Set([volumes.join(" ")]);
  let rounds = 0;
  let settled: Levelled["settled"] = "cap";
  while (shots.length > 0 && rounds < shots.length + 1) {
    rounds++;
    const heard = shots.map(({ lufs }, i) => lufs + 20 * Math.log10(volumes[i]!));
    const target = median(heard);
    const next = shots.map(({ lufs }, i) =>
      Math.abs(heard[i]! - target) <= NEAR ? volumes[i]! : Math.round(Math.min(VOLUME.max, Math.max(VOLUME.min, 10 ** ((target - lufs) / 20))) * 100) / 100);
    if (next.every((volume, i) => volume === volumes[i])) {
      settled = "stable";
      break;
    }
    volumes = next;
    if (seen.has(volumes.join(" "))) {
      settled = "cycle";
      break;
    }
    seen.add(volumes.join(" "));
  }
  if (shots.length === 0) settled = "stable";
  // Each piece's volume: the longer pieces' as worked out; a short piece, its longer neighbour's.
  const final = new Map(shots.map(({ shot }, i) => [shot.id, volumes[i]!]));
  const longer = (i: number, step: -1 | 1): { volume: number; ms: number } | null => {
    for (let j = i + step; j >= 0 && j < edit.shots.length; j += step) {
      const other = edit.shots[j]!;
      if (other.asset !== edit.shots[i]!.asset) return null;
      if (!isShort(other)) return { volume: final.get(other.id) ?? other.volume, ms: (other.endMs - other.startMs) / other.speed };
    }
    return null;
  };
  edit.shots.forEach((shot, i) => {
    if (!isShort(shot) || shot.volume <= 0 || !loudnessOf(shot)) return;
    // The longer audible neighbour (the one before it on a tie), else its own; held to the range either way.
    const [pick] = [longer(i, -1), longer(i, 1)].filter((each): each is { volume: number; ms: number } => each !== null && each.volume > 0).sort((a, b) => b.ms - a.ms);
    final.set(shot.id, Math.min(VOLUME.max, Math.max(VOLUME.min, pick ? pick.volume : shot.volume)));
  });
  const ops = edit.shots.flatMap((shot) => {
    const volume = final.get(shot.id);
    return volume === undefined || volume === shot.volume ? [] : [{ op: "shot.set" as const, id: shot.id, volume }];
  });
  return { ops, rounds, settled };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
