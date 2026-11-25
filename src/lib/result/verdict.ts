import { timecode } from "./format";
import type { Audience, Verdict, VerdictKind } from "./types";

/** Everyone gone by the end of the named scene, as a plain fraction. */
const part = (lostPct: number) =>
  lostPct >= 72 ? "Most" : lostPct >= 58 ? "Two thirds" : lostPct >= 42 ? "Half" : "A third";

/**
 * The page's one sentence, counted in viewers (owner ruling 2026-11-19). One heavy viewer is about
 * 15 points, so a percent threshold would flip on a 2% viewer; a count does not.
 *
 *  - Two or more heavy viewers leave in one scene: the sentence names that scene, the one that
 *    loses the most, the earlier on a tie. "A third leave by 0:03." The fraction is everyone gone
 *    by the END of that scene, so it reads like the rows ("Left by 0:03").
 *  - Otherwise, two or more heavy viewers leave over the clip: "They leave bit by bit."
 *  - Otherwise: "Most watch to the end.", or "They watch to the end." when nobody leaves.
 *
 * No cut and no projected gain follow from this data, so the sentence promises none.
 */
export function verdictOf(audience: Audience): Verdict {
  const { scenes, viewers, points } = audience;
  const after = (k: number) => points[k + 1]![1];
  const loss = scenes.map((_, k) => points[k]![1] - after(k));
  const heavyOut = scenes.map((_, k) => viewers.filter((v) => v.heavy && v.leftScene === k).length);
  const heavyGone = heavyOut.reduce((sum, n) => sum + n, 0);

  let named = -1;
  heavyOut.forEach((count, k) => {
    if (count >= 2 && (named < 0 || loss[k]! > loss[named]! + 0.01)) named = k;
  });

  if (named < 0) {
    if (heavyGone >= 2) return { kind: "leak", sentence: "They leave bit by bit.", scene: null };
    const everyone = heavyGone === 0 && after(scenes.length - 1) >= 99.5;
    return { kind: "holds", sentence: everyone ? "They watch to the end." : "Most watch to the end.", scene: null };
  }

  const { t0, t1 } = scenes[named]!;
  const who = part(Math.round(100 - after(named)));
  const kind: VerdictKind =
    named === 0 ? "opening" : named === scenes.length - 1 ? "ending" : t0 <= 3 ? "early" : "middle";
  const seconds = Math.round(t1);
  const sentence =
    named === 0
      ? seconds <= 1
        ? `${who} leave in the first second.`
        : `${who} leave in the first ${seconds} seconds.`
      : `${who} leave by ${timecode(t1)}.`;
  return { kind, sentence, scene: named };
}
