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
  // Every skill the platform offers (SKILL_RUN_META), grouped by verb. Each carries a short lens:
  // what it produces / the audience question its thin rank arms.
  skillGroups: [
    {
      label: "Make",
      skills: [
        { id: "hooks", label: "Hooks", lens: "Would they stop?", icon: "sparkle" },
        { id: "ideas", label: "Ideas", lens: "Would they want it?", icon: "idea" },
        { id: "script", label: "Script", lens: "Would they finish?", icon: "pen" },
        { id: "remix", label: "Remix", lens: "Would it travel?", icon: "repeat" },
      ],
    },
    {
      label: "Analyze",
      skills: [
        { id: "test", label: "Test", lens: "Frame-by-frame read", icon: "target" },
        { id: "read", label: "Read", lens: "Would it land?", icon: "doc" },
        { id: "account", label: "Account", lens: "What's working", icon: "list" },
      ],
    },
    {
      label: "Discover",
      skills: [{ id: "explore", label: "Explore", lens: "What's breaking out", icon: "search" }],
    },
  ],
  composerPlaceholder: "…or just ask",
};
