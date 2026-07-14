/**
 * MODE-01 — the socials-skill guard (the server half of the mode seam).
 *
 * `hooks` / `ideas` / `script` / `remix` / `explore` / `test` are socials-shaped BY
 * CONSTRUCTION: they write TikTok hooks, decode TikTok winners, and score against a
 * TikTok FYP. A `mode: 'general'` audience (an analyst panel, a hiring panel, one named
 * person) is not a crowd on a feed, so handing it to one of those skills is meaningless —
 * and today nothing refuses it.
 *
 * The composer already gates this on the CLIENT (`SkillMeta.modes` + `isSkillVisible`, and
 * composer.tsx resets the skill when the audience changes). This is the server half: a
 * stale client, a restored thread, or a direct API call must not be able to run a TikTok
 * skill against a panel.
 *
 * Mirrors the shape of the one guard that already existed — predict's
 * `mode !== "general" → 400 predict_requires_general_panel` (predict/route.ts:112) — in the
 * opposite direction. `read` / `chat` / `simulate` accept BOTH modes and must NOT call this.
 */

import type { Audience } from "./audience-types";

/** Skills that only mean something against a socials audience. Keep in sync with the
 *  `modes: ["socials"]` entries of SKILLS (composer-controls.tsx). */
export type SocialsOnlySkill = "hooks" | "ideas" | "script" | "remix" | "explore" | "test";

const SKILL_LABEL: Record<SocialsOnlySkill, string> = {
  hooks: "Hooks",
  ideas: "Ideas",
  script: "Script",
  remix: "Remix",
  explore: "Explore",
  test: "A real video",
};

/**
 * Reject a `mode: 'general'` audience for a socials-only skill.
 *
 * @returns a 400 Response to return AS-IS, or `null` when the audience is acceptable.
 *          Never throws — the runners turn a throw into a 500, and this is a 400 (T-06-20).
 */
export function requireSocialsAudience(
  audience: Pick<Audience, "mode" | "name"> | null | undefined,
  skill: SocialsOnlySkill,
): Response | null {
  // No audience resolves to General (mode: 'socials') — always acceptable (D-04).
  if (!audience) return null;
  if (audience.mode !== "general") return null;

  return Response.json(
    {
      error: "skill_requires_socials_audience",
      message: `${SKILL_LABEL[skill]} writes for a social feed, so it needs a social audience. “${audience.name}” is a custom audience — use it with Read, Simulate, or the room instead.`,
    },
    { status: 400 },
  );
}
