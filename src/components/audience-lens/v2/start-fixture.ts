/**
 * Fixture for the Ambient Audience v2 **Start screen** (surface ④, L6 variant B).
 *
 * Designed from the locked L6 spec + the 2026-07-21 config/rank model
 * (`docs/HANDOFF-2026-07-21-ambient-audience-v2-config-rank-model.md`): the standing CONDITIONS block
 * is the L4 "Thread" shelf (room binding · scene/platform · fidelity) plus the auto-rank toggle; the
 * SKILL GRID is the Societies-explicit menu, each skill carrying a preset lens (question). Swap for
 * live producers later.
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
    autoRank: true,
  },
  composerPlaceholder: "…or just type a hook, an idea, a draft",
  // the skill grid — "what would you like to simulate?" (each carries a preset lens)
  categories: [
    {
      label: "Make",
      skills: [
        { label: "Hook", lens: "would stop", icon: "sparkle" },
        { label: "Script", lens: "would finish", icon: "pen" },
        { label: "Caption", lens: "would stop", icon: "hash" },
      ],
    },
    {
      label: "Test",
      skills: [
        { label: "A real video", lens: "would stop", icon: "play" },
        { label: "A draft", lens: "would stop", icon: "doc" },
      ],
    },
    {
      label: "Ask",
      skills: [
        { label: "The room", lens: "would want", icon: "ask" },
        { label: "A survey", lens: "would want", icon: "list" },
      ],
    },
  ],
};
