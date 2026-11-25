/**
 * next-followups.ts — the two chips under the last answer (spec §3 rule 7, §4.7).
 *
 * Picked BY LABEL from the existing curated entries (`followupsForKind`), so each chip keeps its
 * prompt, its pinned `skill` and its `carryCards`. No new chip copy is written here: a drawn chip
 * with no curated entry ("Why?", "Shorter", "Bolder") is not offered (spec §6).
 *
 * Pure: no React.
 */

import { followupsForKind, type ChatFollowup, type ChatTurnKind } from "@/lib/tools/chat-followups";

/**
 * The drawn pair per kind. A kind not listed takes its first two curated entries. The account read
 * keeps one: its card's own button ("Ideas from what works") starts the Ideas run, so "Ideas that fit
 * me" under it would be a second Ideas button right below the first (thread depth, second part §3).
 */
const PICKS: Partial<Record<ChatTurnKind, readonly string[]>> = {
  hooks: ["More hooks", "Punch them up"],
  ideas: ["More ideas", "Sharper angles"],
  script: ["Make it punchier", "Different angle"],
  remix: ["More like this", "Write hooks"],
  test: ["Rewrite the hook", "Fix the pacing"],
  chat: ["Give me ideas", "Write hooks"],
  account: ["Where am I weakest?"],
};

export function nextFollowups(kind: ChatTurnKind): ChatFollowup[] {
  const curated = followupsForKind(kind);
  const pick = PICKS[kind];
  if (!pick) return curated.slice(0, 2);
  return pick.flatMap((label) => curated.filter((f) => f.label === label).slice(0, 1));
}
