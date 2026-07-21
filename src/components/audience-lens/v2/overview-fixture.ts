/**
 * Round-4 fixture for the Ambient Audience v2 **Overview** surface.
 *
 * This is design-review data — the exact content from `.scratch/panel-v6-round4.html`
 * rendered in real code so the owner judges round 4 in the true medium (not a sketch).
 *
 * Shapes mirror the live contract where it exists (ranked stimuli ≈ `AmbientFocusSibling`,
 * cast ≈ `Person`/`PersonaNode`). The `WatchingRun` staged-progress model is UI-only: the
 * engine emits terminal binary snapshots, NOT partial-vote streams (verified 2026-07-21), so
 * the watching state shows honest PROGRESS with the verdict SEALED until n-of-n decide — never
 * a fabricated partial (design law: sealed verdicts during watching). Swap each field for a
 * live producer as the run-result contract lands (build handoff §6).
 */

import type { OverviewData } from "./AmbientOverview";

export const OVERVIEW_R4: OverviewData = {
  audienceName: "Your audience",
  provenance: "calibrated · 3d",
  tier: "flash",
  watching: {
    stimulus: "Nobody tells you the first 10k is the hardest…",
    verdictPct: 31.7, // revealed only at n-of-n (sealed until then)
  },
  ranked: [
    { id: "h1", stimulus: "Last Tuesday I posted a 7-second clip with no…", stopPct: 41.9 },
    { id: "h2", stimulus: "I quit my 9-5 with $400 in my account…", stopPct: 38.2 },
    { id: "h3", stimulus: "I analyzed why my best story got 200 views…", stopPct: 29.5 },
    { id: "h4", stimulus: "Everyone tells you to post consistently to…", stopPct: 21.0 },
    { id: "h5", stimulus: "Your video didn't flop because the algorithm…", stopPct: 12.4, loss: true },
  ],
  cast: [
    { id: "m", initial: "M" },
    { id: "d", initial: "D" },
    { id: "p", initial: "P" },
    { id: "t", initial: "T" },
  ],
  castOverflow: 8,
};

/** The same room at rest — no run in flight (the P1 "rest header" state). */
export const OVERVIEW_R4_REST: OverviewData = {
  ...OVERVIEW_R4,
  watching: null,
};
