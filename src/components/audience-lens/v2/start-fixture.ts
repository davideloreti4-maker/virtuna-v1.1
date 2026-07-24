/**
 * Fixture for the Ambient Audience v2 **Start screen** (surface ④, L6 Option 1).
 *
 * Designed from the locked L6 spec + the 2026-07-21 config/rank model → Option 1
 * (`docs/HANDOFF-2026-07-21-ambient-audience-v2-config-rank-model.md`): the standing CONDITIONS block
 * is the L4 "Thread" shelf (room binding · scene/platform · fidelity) — NO auto-rank dial (the thin
 * rank is always-on). The MAKE GRID is the maker menu, each skill carrying a preset lens (question);
 * the SIM DOOR is the one separate, deliberate screening act. Swap for live producers later.
 */

import type { StartData } from "./AmbientStart";

export const START_R4: StartData = {
  name: "Davide",
  conditions: {
    audience: "Your audience",
    scene: "TikTok",
    sceneOptions: ["TikTok", "Instagram", "No feed"],
    fidelity: "SIM-1 Flash",
    fidelityOptions: ["SIM-1 Flash", "SIM-1 Max"],
  },
  // Every artifact the platform offers (SKILL_RUN_META ids), grouped by what you're working on.
  // Mirrors START_SKILL_GROUPS in ambient-v2-adapters.ts — keep the two in step.
  skillGroups: [
    {
      label: "Content",
      span: 2,
      skills: [
        { id: "ideas", label: "Ideas", lens: "Concepts for your audience", icon: "bulb" },
        { id: "hooks", label: "Hooks", lens: "Openers ranked by who stops", icon: "firstline" },
        { id: "script", label: "Script", lens: "A full short-form script", icon: "page" },
        { id: "remix", label: "Remix", lens: "Rebuild a video that worked", icon: "repeat" },
        { id: "test", label: "Video test", lens: "Frame by frame, one fix", icon: "filmstrip" },
        { id: "ad", label: "Ad creative", lens: "Test an ad before you spend", icon: "mega", status: "soon" },
      ],
    },
    {
      label: "Intel",
      skills: [
        { id: "explore", label: "Explore", lens: "What's breaking out", icon: "compass" },
        { id: "account", label: "Account teardown", lens: "Yours, or a rival's", icon: "at" },
        { id: "compare", label: "Compare A/B", lens: "Two versions, one winner", icon: "ab", status: "soon" },
      ],
    },
  ],
  composerPlaceholder: "…or just ask",
};
