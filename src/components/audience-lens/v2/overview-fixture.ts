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
  provenance: "calibrated",
  scene: "TikTok",
  tier: "flash",
  watching: {
    stimulus: "Nobody tells you the first 10k is the hardest…",
    verdictPct: 31.7, // revealed only at n-of-n (sealed until then)
  },
  ranked: [
    { id: "h1", stimulus: "Last Tuesday I posted a 7-second clip with no…", stopPct: 41.9, kind: "hook" },
    { id: "h2", stimulus: "I quit my 9-5 with $400 in my account…", stopPct: 38.2, kind: "idea" },
    // A TESTED video, revealed: it carries its native VIRAL score (craft) AND — now that it's been
    // simulated — the audience attention %. Both read on the row; the % is the audience read on top.
    { id: "h3", stimulus: "The cold-plunge cut, tested frame by frame…", stopPct: 29.5, viralScore: 91, kind: "video" },
    { id: "h4", stimulus: "Everyone tells you to post consistently to…", stopPct: 21.0, kind: "hook" },
    { id: "h5", stimulus: "Your video didn't flop because the algorithm…", stopPct: 12.4, kind: "script" },
    // On the board but not yet run past the AUDIENCE. They carry NO score of their own: the
    // generation-time N-of-10 they used to show (and rank and bar-chart by) is dead — the engine
    // stopped measuring it (owner, 2026-08-02). A tested video keeps its VIRAL score, which is a
    // real reading of the file; its attention % stays withheld until Simulate reveals the
    // already-measured read (no re-run).
    { id: "h8", stimulus: "The morning-routine cut, 42s, one take…", stopPct: 0, viralScore: 84, kind: "video", state: "queued" },
    { id: "h6", stimulus: "The 3 edits that saved my worst video…", stopPct: 0, kind: "remix", state: "queued" },
    { id: "h7", stimulus: "I stopped chasing trends for 30 days…", stopPct: 0, kind: "idea", state: "queued" },
  ],
  segments: [
    {
      archetype: "aspiring_creator",
      label: "Aspiring creators",
      sharePct: 34,
      repaint: "Watches for what they could copy tomorrow; skips anything that needs a budget.",
    },
    {
      archetype: "casual_scroller",
      label: "Casual scrollers",
      sharePct: 27,
      repaint: "Passive consumption at speed; stops only for an immediate, visual payoff.",
    },
    {
      archetype: "skeptic",
      label: "Skeptics",
      sharePct: 22,
      repaint: "Judges authenticity and production value; dismisses low-effort posts immediately.",
    },
    {
      archetype: "practitioner",
      label: "Practitioners",
      sharePct: 17,
      repaint: "Reads for technique and business model; ignores motivation with no method behind it.",
    },
  ],
};

/** The same room at rest — no run in flight (the P1 "rest header" state). */
export const OVERVIEW_R4_REST: OverviewData = {
  ...OVERVIEW_R4,
  watching: null,
};

/** The ARRIVAL board (2026-08-11 r3): the rail before any work exists. Nothing in flight, nothing
 *  ranked, nothing queued — so it states the room's makeup instead of an empty "Ranked". This is
 *  the state a creator meets FIRST on desktop, which is why it has its own fixture. */
export const OVERVIEW_R4_ARRIVAL: OverviewData = {
  ...OVERVIEW_R4,
  watching: null,
  ranked: [],
};
