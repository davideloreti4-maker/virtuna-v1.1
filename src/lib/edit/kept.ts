/**
 * kept.ts — the findings a creator put away ("Keep it"; spec 2026-11-24-editor-screens-design.md §7, E18; plan
 * 2026-11-25-editor-screens-b, Task 8; S18). A finding is known across turns by its key: its code and the thing it is about, never its
 * frame, so a change that moves a thing keeps it put away while the review still finds the same of it. A turn holds the keys put
 * away of its own findings (`edit_turns.kept`); a change carries them on while they last, a cut in another look starts again
 * with none (spec §7, E9; ruling S2).
 *
 * Pure: the routes and the page ask it, and both read the same keys.
 */
import type { Finding } from "./review";

/**
 * The codes whose two levels are two things (S18): `on-face` as an error is the face covered, as a warning the chin touched, which
 * is never put to the creator (`toCheck`). A key of one is never taken for the other.
 */
const BY_LEVEL: ReadonlySet<Finding["code"]> = new Set(["on-face"]);

/**
 * A finding's key across turns: its code (with its level, for a code of `BY_LEVEL`: "on-face error s1", "on-face warn s1") and the
 * thing it is about (an item, a mark, else the shot), never its frame. A key put away before the level was part of it ("on-face
 * s1") is a string like any other: no finding has it now, so that finding comes back to check once and the key is not carried.
 */
export function findingKey(finding: Finding): string {
  const { item, mark, shot } = finding.where;
  const code = BY_LEVEL.has(finding.code) ? `${finding.code} ${finding.severity}` : finding.code;
  return `${code} ${item ?? mark ?? shot ?? ""}`.trimEnd();
}

/**
 * A finding a creator is never asked to check (S18): the chin touched, `on-face` as a warning. The house's first cut sets its
 * captions there itself, so every edit would open on it; the review keeps it for the agent.
 */
const notForTheCreator = (finding: Finding): boolean => finding.code === "on-face" && finding.severity === "warn";

/**
 * What is left to check: the findings not put away, one a key (the first in the list's order), in the list's order. The review
 * says one thing twice where two apps' buttons cover it, which is one thing to check. The one list a creator is asked from: the
 * count, the card, the rings and what may be put away all read it; a finding `notForTheCreator` is never in it.
 */
export function toCheck(findings: readonly Finding[], kept: readonly string[]): Finding[] {
  const seen = new Set(kept);
  return findings.filter((finding) => {
    if (notForTheCreator(finding)) return false;
    const key = findingKey(finding);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** What a new turn keeps put away: the keys of `kept` still among its findings, each once, in kept's order. */
export function carryKept(kept: readonly string[], findings: readonly Finding[]): string[] {
  const found = new Set(findings.map(findingKey));
  return [...new Set(kept)].filter((key) => found.has(key));
}
