/**
 * runHeaderBlock — the turn's RUN STAMP, written by every skill route.
 *
 * Persisted as the FIRST block of a run's assistant message so a reloaded thread can rebuild the
 * voice layer it used to lose. Before this, three things about a completed run existed only in
 * client memory:
 *
 *   the INTRO      derived from the armed tool + the live audience → gone on reload
 *   the RECEIPT    derived from ephemeral SSE stage events, never persisted → gone on reload
 *   the SKILL      inferable from block types, but its INPUTS (which audience, which platform,
 *                  which input hook) were not inferable at all → a reloaded intro said "General"
 *
 * The outro text already survived (each route persists it as a trailing `markdown` block), which
 * is what made the gap easy to miss: the turn came back with words, just not the ones that said
 * what had run, for whom.
 *
 * ⚠️ `skill` is the DISPLAY namespace — `ChatTurnKind` / SKILL_RUN_META / STAGE_PLANS keys, i.e.
 * "ideas" PLURAL — never the composer `ToolId` ("idea", singular). The two namespaces differ in
 * exactly this one id and a cast between them cannot fail at compile time; that is how F-017
 * shipped a paid video Test behind an "Ideas" tile. Guarded by run-header-namespace.test.ts.
 *
 * Omitted fields are omitted, never defaulted: a stamp that guessed "General" would be
 * indistinguishable from one that knew, and the renderer's own fallback is the honest place for
 * that decision.
 */

export interface RunHeaderInput {
  /** ChatTurnKind: "ideas" | "hooks" | "script" | "remix" | "explore" | "account" | "test" | … */
  skill: string;
  /** The audience the run was aimed at, as the intro line names it. */
  audienceLabel?: string | null;
  /** "tiktok" | "instagram" | "youtube". */
  platform?: string | null;
  /** The input hook a script run was anchored on — the intro cites it. */
  hookLine?: string | null;
}

export function runHeaderBlock(input: RunHeaderInput): {
  type: "run-header";
  props: Record<string, unknown>;
} {
  const props: Record<string, unknown> = { skill: input.skill };
  if (input.audienceLabel) props.audienceLabel = input.audienceLabel;
  if (input.platform) props.platform = input.platform;
  if (input.hookLine) props.hookLine = input.hookLine;
  return { type: "run-header", props };
}
