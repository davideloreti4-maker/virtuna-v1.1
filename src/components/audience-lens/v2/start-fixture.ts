/**
 * Fixture for the Ambient Audience v2 **Start screen** (surface ④, L6).
 *
 * No round-4 sketch exists — ④ was deferred before the sketch loop closed — so this is designed
 * fresh from the locked L6 spec ("configuration is loud exactly once, at its container's birth") +
 * the design doctrine, in the v2 grammar. The three thread-default chips are the L4 "Thread" shelf
 * (room binding · scene/platform · fidelity); the ACTIONS grid is the skill menu, each action
 * carrying a preset lens (question) and optionally setting chips. Swap for live producers later.
 */

import type { StartData } from "./AmbientStart";

export const START_R4: StartData = {
  name: "Davide",
  // the three loud-at-birth thread defaults (tappable; room binding hard-locks after — L1)
  chips: [
    { connective: "in", label: "Your audience" },
    { connective: "as", label: "TikTok" },
    { connective: "", label: "SIM-1 Flash" },
  ],
  composerPlaceholder: "Test a stimulus — a hook, an idea, a draft…",
  // the ACTIONS grid — "what would you like to simulate?" (each carries a preset lens)
  actions: [
    { icon: "sparkle", label: "Make ideas", desc: "ranked + pre-tested", lens: "would want" },
    { icon: "play", label: "Test a real video", desc: "the full read before you post", lens: "would stop" },
    { icon: "ask", label: "Ask the room", desc: "a raw thought, react instantly", lens: "would stop" },
    { icon: "repeat", label: "Repurpose a winner", desc: "remix a top performer", lens: "would share" },
  ],
};
