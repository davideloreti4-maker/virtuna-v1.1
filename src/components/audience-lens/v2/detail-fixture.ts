/**
 * CREATOR_TEMPLATE — the first DomainTemplate on the platform (creator · content).
 *
 * Authored from the round-4 design data (`.scratch/panel-v6-round4.html`) into the slot contract
 * (`domain-template.ts`). This is template #1: it fills the invariant Brain/Population role-frames
 * with the CREATOR figures (attention-scrubber · tri-state) and inherits every shared slot (cortex ·
 * terrain · voices · footer · ask-why). A second domain (pricing, A/B, survey) is authored the same
 * way — one template object, new figures into the swap slots — never a fork of the frames.
 *
 * Values are unchanged from the prior DETAIL_R4 fixture, so the creator view renders identically
 * (the refactor's regression anchor). Brain data is MODELED, not measured (corner chips + `modeled`
 * tags carry that honesty). NOTE: r4's signal labels are the design target; the live signal set
 * names them differently — reconciled when the P2 σ→plain-words rework lands.
 */

import type { DomainTemplate } from "./domain-template";

export const CREATOR_TEMPLATE: DomainTemplate = {
  id: "creator",
  label: "Creator · content",
  backLabel: "All 5",
  pager: "hook 2 of 5",
  verdict: { value: "38.2%", label: "would stop" },

  brain: {
    cortexSeedKey: "hook-2-first-10k", // drifts the cortex parcellation; stable per stimulus
    clipSeconds: 12, // cortex replay-loop duration
    stopRatio: 0.382, // from the verdict — drives the cortex bold
    // ◇ driver axis — creator = attention over the clip (curve-as-scrubber + synced transcript)
    driver: {
      kind: "attention-scrubber",
      data: {
        hold: 38,
        transcript: "I quit my 9-5 with $400 in my account. Here's month one.",
        peakWordIndex: 5, // "$400" — the held word
        clipSeconds: 12,
        points: [66, 72, 69, 52, 28, 34, 46, 54, 52, 50, 48, 46, 44], // 0..80 over the clip
        moments: [
          { t: "0:01", v: 72 },
          { t: "0:04", v: 28, dip: true },
          { t: "0:07", v: 46 },
        ],
      },
    },
    // ◇ signal breakdown (0..100)
    signals: [
      { label: "Emotional hit", score: 65, band: "strong" },
      { label: "Credibility", score: 62, band: "okay" },
      { label: "Visual pull", score: 61, band: "okay" },
    ],
    // ◇ networks at the playhead (z-scored σ) — negative = below the system's resting level
    networks: [
      { label: "Focus", z: -1.1, loss: true },
      { label: "Memory", z: 0.7 },
      { label: "Emotion", z: 0.4 },
      { label: "Visual", z: -0.4 },
    ],
    // ● ask-why chat — shared slot, deferred (no chat infra in v2 yet)
    askWhy: { enabled: false, placeholder: "Ask why they reacted this way…" },
  },

  population: {
    // ◇ headline + main figure — creator = the stop/skim/scroll tri-state
    main: { kind: "tri-state", data: { stopped: 38, skimmed: 41, scrolled: 21 }, percentileLine: "P82 of your 41" },
    // ● the society — one connected terrain, clusters knit by commuter edges
    terrain: {
      clusters: [
        { name: "scrollers", cx: 128, cy: 90, spread: 52, n: 41, lit: 0.51 },
        { name: "builders", cx: 246, cy: 70, spread: 38, n: 27, lit: 0.82 },
        { name: "skeptics", cx: 250, cy: 154, spread: 33, n: 20, lit: 0.12 },
        { name: "drop-ins", cx: 122, cy: 162, spread: 27, n: 12, lit: 0.4 },
      ],
      lossClusterIndex: 2, // skeptics = the loudest-no cluster (coral)
    },
    // ◇ segments — the tiers that matter here
    segments: {
      title: "Who stopped · by segment",
      rows: [
        { label: "builders", pct: 82 },
        { label: "scrollers", pct: 51 },
        { label: "drop-ins", pct: 40 },
        { label: "skeptics", pct: 12, loss: true },
      ],
    },
    // ● voices — coded reasons + exemplar cast
    voices: {
      kicker: "Why · coded from 1,000",
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
  },
};
