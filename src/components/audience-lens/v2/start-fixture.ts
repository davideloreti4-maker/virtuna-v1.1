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
  // MAKE — the maker grid (grows as verticals are added); each carries a preset lens
  makeLabel: "Make something",
  makeSkills: [
    { label: "Hook", lens: "would stop", icon: "sparkle" },
    { label: "Script", lens: "would finish", icon: "pen" },
    { label: "Caption", lens: "would stop", icon: "hash" },
    { label: "Idea", lens: "would want", icon: "idea" },
    { label: "Thumbnail", lens: "would stop", icon: "frame" },
    { label: "Repurpose", lens: "would stop", icon: "repeat" },
  ],
  // SIMULATE — the one separate door (cold-start: nothing to develop yet)
  simDoor: {
    title: "Test something against your audience",
    subtitle: "a video, a draft, or ask the room — the full read",
  },
  composerPlaceholder: "…or just ask",
};
