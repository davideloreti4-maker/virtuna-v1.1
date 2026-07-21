/**
 * Round-4 fixture for the Ambient Audience v2 **Detail** view (Brain | Audience tabs).
 *
 * Design-review data — the exact content from `.scratch/panel-v6-round4.html`, rendered in real
 * code. Shapes mirror the live brain contract where it exists (build handoff §6):
 *   - signals ≈ `BrainSignal` (score 0..100) — `src/lib/brain/brain-signals.ts`
 *   - networks ≈ `NetworkSigma` (z-scored) — `src/lib/brain/network-sigma.ts`
 *   - attention ≈ `AttentionCurve` {points, hold, peaks} — `src/lib/brain/attention-curve.ts`
 * Brain data is MODELED, not measured (`BrainSignal.real === false`) — the corner chips + the mono
 * `modeled` tags carry that honesty. NOTE: r4's signal labels (Emotional hit / Credibility / Visual
 * pull) are the design target; the live signal set names them differently (no "Credibility" axis) —
 * reconciled when the P2 rework lands (translate σ → plain words). Kept as r4 for a faithful build.
 */

import type { DetailData } from "./AmbientDetail";

export const DETAIL_R4: DetailData = {
  backLabel: "All 5",
  pager: "hook 2 of 5",
  verdictPct: 38.2,

  brain: {
    seedKey: "hook-2-first-10k", // drifts the cortex parcellation; stable per stimulus
    // attention (curve-as-scrubber + synced transcript + moment chips)
    attention: {
      hold: 38,
      transcript: "I quit my 9-5 with $400 in my account. Here's month one.",
      peakWordIndex: 5, // "$400" — the held word
      clipSeconds: 12,
      // 0..80 attention over the clip (r4 ATT array)
      points: [66, 72, 69, 52, 28, 34, 46, 54, 52, 50, 48, 46, 44],
      moments: [
        { t: "0:01", v: 72 },
        { t: "0:04", v: 28, dip: true },
        { t: "0:07", v: 46 },
      ],
    },
    // signal breakdown (0..100)
    signals: [
      { label: "Emotional hit", score: 65, band: "strong" },
      { label: "Credibility", score: 62, band: "okay" },
      { label: "Visual pull", score: 61, band: "okay" },
    ],
    // networks at the playhead (z-scored σ) — negative = below the system's resting level
    networks: [
      { label: "Focus", z: -1.1, loss: true },
      { label: "Memory", z: 0.7 },
      { label: "Emotion", z: 0.4 },
      { label: "Visual", z: -0.4 },
    ],
  },

  // audience tab (surface ③) — r4 values
  audience: {
    terrain: {
      // one connected society: clusters knit by commuter edges (built in AudienceTab)
      clusters: [
        { name: "scrollers", cx: 128, cy: 90, spread: 52, n: 41, lit: 0.51 },
        { name: "builders", cx: 246, cy: 70, spread: 38, n: 27, lit: 0.82 },
        { name: "skeptics", cx: 250, cy: 154, spread: 33, n: 20, lit: 0.12 },
        { name: "drop-ins", cx: 122, cy: 162, spread: 27, n: 12, lit: 0.4 },
      ],
      lossClusterIndex: 2, // skeptics = the loudest-no cluster (coral)
    },
    percentileLine: "P82 of your 41",
    tri: { stopped: 38, skimmed: 41, scrolled: 21 },
    segments: [
      { label: "builders", pct: 82 },
      { label: "scrollers", pct: 51 },
      { label: "drop-ins", pct: 40 },
      { label: "skeptics", pct: 12, loss: true },
    ],
    reasons: [
      {
        label: "The payoff comes too late",
        count: 253,
        quote: "i'd be gone before the point lands",
        who: "Maya · skeptic",
        loss: true,
      },
      {
        label: "The $400 stake feels real",
        count: 190,
        quote: "that detail is what made me stay",
        who: "Dev · builder",
      },
      {
        label: "Heard this story before",
        count: 118,
        quote: "every creator has this exact arc",
        who: "Priya · scroller",
      },
    ],
  },
};
