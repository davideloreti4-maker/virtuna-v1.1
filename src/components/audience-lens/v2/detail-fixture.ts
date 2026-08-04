/**
 * CREATOR_TEMPLATE — the first DomainTemplate on the platform (creator · content), authored to the
 * rev-12 design.
 *
 * This is the design artefact: the numbers below are the ones the owner signed off on in
 * `docs/mockups/insights-rev6-hero-restored-2026-08-01.html`, moved into the slot contract so the
 * React rail renders the reviewed page rather than an approximation of it. It fills the invariant
 * Brain / Engagement / Population role-frames with the CREATOR figures and inherits every shared
 * slot. A second domain (pricing, A/B, survey) is authored the same way — one template object, new
 * figures into the swap slots — never a fork of the frames.
 *
 * Honesty: every count here is PROJECTED for a post that does not exist yet, and the surface says
 * so — the identity row carries a `projected` tag and is dimmed, the applied state is tagged
 * `projected`, and the sim disclosure is the last line of every page. The adapters
 * (`ambient-v2-brain.ts` / `-population.ts` / `-drill.ts`) derive the same blocks from real
 * persisted output and OMIT what no producer exists for — notably reach, the creator's own median
 * post, and the last-41 catalogue. Those three appear here because this is the design's demo clip.
 *
 * ONE UNIT on the surface: every percentage is "share of the room still watching". Anything on
 * another scale (the 0–100 signal scores, the z-scores, the per-second grid) says which scale it is
 * on, in its own card's right-meta. The verb "stop" is BANNED — the live rail meant it as the GOOD
 * outcome (stopped scrolling) while every creator reads it as the loss.
 */

import type { DomainTemplate, MetricTile, SignalCell } from "./domain-template";

const CLIP = 28;

/** `heatmap.weighted_curve` — the share of the room still watching, per second. */
const CURVE = [
  1, 0.84, 0.58, 0.38, 0.358, 0.348, 0.342, 0.336, 0.33, 0.325, 0.32, 0.316, 0.311, 0.306, 0.302,
  0.297, 0.293, 0.288, 0.284, 0.279, 0.274, 0.269, 0.264, 0.258, 0.251, 0.243, 0.234, 0.222, 0.209,
];
/** The creator's OWN median post — the only benchmark band we hold (never an industry band). */
const MEDIAN = [
  1, 0.92, 0.76, 0.58, 0.5, 0.462, 0.44, 0.425, 0.412, 0.4, 0.389, 0.378, 0.368, 0.358, 0.348,
  0.339, 0.33, 0.321, 0.312, 0.303, 0.294, 0.284, 0.274, 0.264, 0.253, 0.241, 0.227, 0.21, 0.175,
];
/** The re-simulated curve after the trim — the payoff now opens the video. */
const TRIMMED = [
  1, 0.96, 0.92, 0.89, 0.86, 0.835, 0.81, 0.79, 0.77, 0.752, 0.735, 0.72, 0.705, 0.69, 0.676, 0.662,
  0.648, 0.634, 0.62, 0.605, 0.59, 0.574, 0.557, 0.539, 0.52, 0.5, 0.478, 0.454, 0.428,
];

const SCRIPT =
  "I spent four hundred dollars testing every viral hook format so you don't have to and the one " +
  "that won wasn't the one anyone teaches here's what actually happened I ran the same script " +
  "twelve times and changed only the first three seconds";

/** avg-watch seconds across the creator's last 41 videos — the Key-metrics benchmark, DRAWN. */
const RANK41 = [
  3.1, 4.2, 4.8, 5.5, 6.1, 6.6, 7.0, 7.4, 7.9, 8.3, 8.6, 9.0, 9.3, 9.9, 10.2, 10.5, 10.8, 11.0,
  11.2, 11.5, 11.8, 12.1, 12.4, 12.8, 13.1, 13.5, 13.9, 14.4, 14.9, 15.4, 16.0, 16.7, 17.5, 18.4,
  19.4, 20.5, 21.7, 23.0, 24.4, 25.9, 27.4,
];

/** Per-second reaction intensity on the clip's own axis — WHEN saves, shares and comments fire. */
const REACT = [
  { label: "Saves", count: 102, intensity: [0.1, 0.06, 0.03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.04, 0.05, 0.06, 0.08, 0.1, 0.13, 0.16, 0.2, 0.26, 0.34, 0.45, 0.58, 0.74, 0.88, 1, 0.62] },
  { label: "Shares", count: 45, intensity: [0.05, 0.03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.03, 0.04, 0.05, 0.07, 0.09, 0.12, 0.16, 0.22, 0.3, 0.42, 0.56, 0.72, 0.9, 1, 0.7] },
  { label: "Comments", count: 16, intensity: [0.5, 0.35, 0.2, 0.1, 0.06, 0.05, 0.05, 0.06, 0.07, 0.08, 0.1, 0.12, 0.14, 0.15, 0.16, 0.17, 0.18, 0.2, 0.22, 0.25, 0.29, 0.34, 0.4, 0.48, 0.58, 0.7, 0.84, 1] },
];

const WATCH: MetricTile[] = [
  { label: "Avg watch", value: "9.7s", delta: "↓1.5s · of 0:28", lead: true },
  { label: "Watched full", value: "3.1%", delta: "↓6.3 pts" },
  { label: "Rewatch", value: "1.19×", delta: "↑0.15 · top 20%" },
];
const WATCH_DONE: MetricTile[] = [
  { label: "Avg watch", value: "16.4s", delta: "↑5.2s · of 0:25", lead: true },
  { label: "Watched full", value: "9.8%", delta: "↑0.4 pts" },
  { label: "Rewatch", value: "1.19×", delta: "↑0.15 · top 20%" },
];
/** Reactions read as COUNTS of the projected reach — creators think in saves, not in percentage
 *  points of modeled viewers. The rate rides the delta line; the denominator is the card's meta. */
const REACTIONS: MetricTile[] = [
  { label: "Saves", value: "102", delta: "3.2% of viewers ↑", lead: true },
  { label: "Shares", value: "45", delta: "1.4% of viewers ↑" },
  { label: "Comments", value: "16", delta: "0.5% of viewers ↓" },
  { label: "Follows", value: "13", delta: "0.4% of viewers ↓" },
];
const REACTIONS_DONE: MetricTile[] = [
  { label: "Saves", value: "269", delta: "3.2% of viewers ↑", lead: true },
  { label: "Shares", value: "119", delta: "1.4% of viewers ↑" }, // 45 × 2.64 — matches the timeline row exactly
  { label: "Comments", value: "42", delta: "0.5% of viewers ↓" },
  { label: "Follows", value: "34", delta: "0.4% of viewers ↓" },
];

/** The nine, on the 0–100 scale their card names. Grades carry NO colour — they are a cutoff on a
 *  modeled signal, not a benchmark against real outcomes. */
const SIGNALS: SignalCell[] = [
  { key: "visual", label: "Visual Pull", score: 68, word: "Strong", tone: "strong", delta: 5, whyScore: "The opening frame pulls — it is the wait behind it that costs." },
  { key: "voice", label: "Voice Impact", score: 37, word: "Weakness", tone: "weak", delta: 2, whyScore: "Even cadence; the claim lands without being pushed." },
  { key: "grip", label: "Cognitive Grip", score: 50, word: "Okay", tone: "okay", delta: -1, whyScore: "Easy enough to follow — nothing here is hard work." },
  { key: "emotion", label: "Emotional Hit", score: 57, word: "Okay", tone: "okay", delta: 6, whyScore: "$400 of your own money is a real stake." },
  { key: "memory", label: "Memorability", score: 32, word: "Weakness", tone: "weak", delta: 2, whyScore: "The number sticks; the arc around it is familiar." },
  { key: "attention", label: "Attention", score: 34, word: "Weakness", tone: "weak", delta: 6, whyScore: "Collapses by 0:03 and never recovers the room it lost." },
  { key: "buy", label: "Buy Signal", score: 35, word: "Weakness", tone: "weak", delta: 4, whyScore: "Interest is real, but it arrives after most have gone." },
  { key: "risk", label: "Hesitation / Risk", score: 58, word: "Weakness", tone: "weak", delta: 5, whyScore: "Resistance fires early — a claim before any proof.", lowerIsBetter: true },
  { key: "effort", label: "Mental Effort", score: 50, word: "Okay", tone: "okay", delta: 0, whyScore: "No load spike; the cost is patience, not comprehension.", lowerIsBetter: true },
];

/** The seven networks, z-scored at the break. Rendered by FUNCTION (the anatomy lives in the
 *  drawer): Body = somatomotor, Focus = dorsal attention, Alertness = ventral attention,
 *  Emotion = limbic, Effort = frontoparietal, Mind-wandering = default mode. */
const NETWORKS = [
  { label: "Visual", z: 0.35, band: "slightly above" },
  { label: "Somatomotor", z: 0.07, band: "about normal" },
  { label: "Dorsal Attention", z: -0.73, band: "slightly below", loss: true },
  { label: "Ventral Attention", z: -0.01, band: "about normal" },
  { label: "Limbic", z: -0.72, band: "slightly below" },
  { label: "Frontoparietal", z: -0.43, band: "slightly below" },
  { label: "Default Mode", z: -0.52, band: "slightly below" },
];

const SYSTEMS = ["Visual", "Audio", "Face", "Text", "Language", "Effort", "Reward", "Affect", "Story", "Surprise"];
/** Deterministic (no Math.random) so the grid is byte-identical on server and client. Retention
 *  carries most of the weight and the per-system phase only textures it — the grid has to SHOW the
 *  collapse after 0:03, not bury it under noise. */
const KPI_ROWS = SYSTEMS.map((label, r) => ({
  label,
  values: Array.from({ length: CLIP }, (_, c) => {
    const base = CURVE[Math.min(c, CURVE.length - 1)]!;
    const phase = Math.abs(Math.sin(c * 0.7 + r * 1.9));
    return Math.round(Math.max(0.05, Math.min(0.88, base * 0.72 + base * phase * 0.34)) * 100);
  }),
}));

/** ONE taxonomy — relationship to the creator, TikTok's own analytics vocabulary. It runs the
 *  terrain districts, these watch-time rows, the fit index and the spread multipliers. The archetype
 *  namespace (builders / learners / skeptics / drive-by) is owner-RETIRED: never re-propose it. */
const POOLS = [
  { label: "New viewers", share: "65% of room", sharePct: 65, dropAt: "0:02", loss: true, curve: [1, 0.82, 0.44, 0.22, 0.17, 0.15, 0.14, 0.135, 0.13, 0.128, 0.125, 0.123, 0.12, 0.118, 0.115, 0.113, 0.11, 0.108, 0.105, 0.103, 0.1, 0.098, 0.095, 0.092, 0.089, 0.085, 0.08, 0.074, 0.066] },
  { label: "Returning", share: "20% of room", sharePct: 20, dropAt: "0:11", curve: [1, 0.94, 0.86, 0.74, 0.68, 0.64, 0.61, 0.59, 0.57, 0.555, 0.54, 0.525, 0.51, 0.495, 0.48, 0.468, 0.455, 0.443, 0.43, 0.418, 0.405, 0.393, 0.38, 0.366, 0.35, 0.333, 0.313, 0.29, 0.26] },
  { label: "Followers", share: "10% of room", sharePct: 10, dropAt: "0:21", curve: [1, 0.97, 0.93, 0.89, 0.86, 0.84, 0.82, 0.805, 0.79, 0.777, 0.765, 0.753, 0.74, 0.728, 0.715, 0.703, 0.69, 0.677, 0.663, 0.648, 0.632, 0.614, 0.594, 0.57, 0.542, 0.508, 0.466, 0.412, 0.34] },
  { label: "Outside niche", share: "5% of room", sharePct: 5, dropAt: "0:03", curve: [1, 0.88, 0.62, 0.41, 0.33, 0.29, 0.27, 0.258, 0.248, 0.24, 0.233, 0.226, 0.22, 0.213, 0.207, 0.2, 0.194, 0.187, 0.181, 0.174, 0.168, 0.161, 0.154, 0.146, 0.137, 0.127, 0.115, 0.1, 0.08] },
];

export const CREATOR_TEMPLATE: DomainTemplate = {
  id: "creator",
  label: "Creator · content",
  backLabel: "The room",
  pager: "clip 2 of 5",
  verdict: { value: "62%", label: "leave by 0:03" },
  unlock: {
    lever: "Trim 0:00–0:03",
    gain: "→ 8.4K",
    insight: "The clip holds once it starts — 55% of the room still watching at 0:03 stays to the end. It is the first three seconds that lose the other 62%, not the rest of it.",
  },

  identity: {
    title: "“I spent four hundred dollars testing every viral hook format…”",
    thumbLabel: "0:28",
    stats: [{ kind: "play", value: "3.2K" }],
    projected: true,
  },

  answer: {
    head: "The first three seconds cap your reach.",
    stats: [
      { value: "62%", label: "leave by 0:03", loss: true },
      { value: "3.2K", label: "vs usual 8.1K" },
    ],
    cortexCorner: "at 0:03, the drop",
    verdict: { value: "62%", label: "leave by 0:03" },
    evidence: "engagement",
    fix: {
      label: "Trim 0:00–0:03",
      gain: "→ 8.4K",
      applied: {
        head: "The trim holds the room.",
        stats: [{ value: "8.4K", label: "projected · usual 8.1K" }],
        was: { value: "62%", label: "leave by 0:03" },
        now: { value: "11%", label: "after the fix" },
        verdict: { value: "11%", label: "leave by 0:03" },
        cortexCorner: "after the trim",
        thumbLabel: "0:25",
        retention: {
          curve: TRIMMED,
          clipSeconds: 25,
          anno: "11% gone by 0:03",
          moments: [{ at: 2, pct: 92 }, { at: 9, pct: 75 }, { at: 21, pct: 59 }],
          trimWords: 4, // the trim removes 0:00–0:03, so the transcript opens where the video now does
        },
        watchTiles: WATCH_DONE,
        rankValue: 16.4,
        reactionTiles: REACTIONS_DONE,
        reactionMeta: "of 8.4K reached",
        reactionScale: 2.64,
      },
    },
  },

  engagement: {
    retention: {
      clipSeconds: CLIP,
      curve: CURVE,
      median: MEDIAN,
      breakAt: 3,
      anno: "62% gone by 0:03",
      transcript: SCRIPT,
      breakWordIndex: 9,
      moments: [{ at: 2, pct: 58 }, { at: 9, pct: 33 }, { at: 21, pct: 27 }],
      coverLabel: "0:28",
    },
    watch: {
      title: "Key metrics",
      meta: "vs your last 41 videos",
      tiles: WATCH,
      rank: { values: RANK41, median: 11.2, max: 28, value: 9.7, unit: "s" },
    },
    reactionTimeline: { seconds: CLIP, rows: REACT },
    reactions: { title: "Projected reaction", meta: "of 3.2K reached", tiles: REACTIONS },
  },

  simline: "1,000 simulated · your 4.2K followers · confidence 0.82",
  method: [
    {
      heading: "The three scales on this page",
      notes: [
        "Share of the room — the verdict, the curve, the moment chips and the watch metrics. One unit, one meaning: how many of the 1,000 are still with you.",
        "0–100 signal scores — the breakdown. Nine signals derived from seven networks; two are composites. The grade words are a cutoff on a modeled signal, NOT a benchmark against real outcomes — which is why they carry no colour.",
        "z-scores — the network bars, against this clip's own baseline at the break. Zero is the centre line, so a bar left of it is below this clip's own normal, not below yours.",
        "The seven networks are shown by function. Anatomically: Visual, Body = somatomotor, Focus = dorsal attention, Alertness = ventral attention, Emotion = limbic, Effort = frontoparietal, Mind-wandering = default mode.",
      ],
    },
    {
      heading: "What this is not",
      notes: [
        "Modeled from your audience's real retention · calibrated on your 4.2k followers · confidence 0.82 · calibrated for engagement, not purchase · a cortical proxy, never a brain measurement.",
      ],
    },
  ],

  brain: {
    cortexSeedKey: "clip-2-hook-formats",
    clipSeconds: CLIP,
    stopRatio: 0.62,
    // Grounds the cortex on the SAME curve Engagement draws — the figure and the curve under it are
    // one instrument, not two readings of the same run.
    retentionCurve: CURVE,
    signalsBaseline: "vs your baseline",
    signalScale: "0–100 · vs your baseline",
    networkScale: "z-scored · at the break",
    calibrationNote: "Modeled from a cortical proxy · not measured attention",
    // ◇ the driver axis. A VIDEO has the timeline, and it lives on Engagement — retention is what
    // the room DID with the clip. This slot stays typed for the swap contract; Brain draws no
    // scrubber (the ReasonsCard / ResistanceCard branches are what fill it for the other kinds).
    driver: {
      kind: "attention-scrubber",
      data: {
        hold: 38,
        transcript: SCRIPT,
        peakWordIndex: 9,
        clipSeconds: CLIP,
        points: CURVE.map((v) => Math.round(v * 80)),
        moments: [{ t: "0:02", v: 46 }, { t: "0:09", v: 26, dip: true }, { t: "0:21", v: 22 }],
      },
    },
    signals: [],
    signalGrid: SIGNALS,
    // the three the page is about — they lead full-width, the other six keep the grid. All nine stay
    // on the surface: rank replaces the rev-8 drawer, which left this page thinner than the shipped one.
    signalMovers: ["attention", "visual", "voice"],
    networkBars: NETWORKS,
    networks: [
      { label: "Focus", z: -0.73, read: "running slightly below", loss: true },
      { label: "Visual", z: 0.35, read: "a mild lift" },
    ],
    kpiHeatmap: { seconds: CLIP, rows: KPI_ROWS },
    askWhy: { enabled: false, placeholder: "Ask why they reacted this way…" },
  },

  population: {
    heroVerdict: { value: "90%", label: "non-followers" },
    heroFigread: "% = kept watching",
    // ◇ the main figure. The tri-state row is deliberately NOT drawn: its two numbers are the hero
    // chip and the answer's stat row, and a page must not say one fact twice.
    main: { kind: "tri-state", data: { stopped: 38, skimmed: 0, scrolled: 62 }, percentileLine: "1,000 simulated" },
    terrain: {
      clusters: [
        { name: "followers", cx: 96, cy: 74, spread: 30, n: 14, lit: 0.82 },
        { name: "returning", cx: 262, cy: 108, spread: 38, n: 22, lit: 0.44 },
        { name: "new", cx: 150, cy: 168, spread: 54, n: 46, lit: 0.12 },
        { name: "outside niche", cx: 292, cy: 176, spread: 24, n: 8, lit: 0.08 },
      ],
      lossClusterIndex: 3,
    },
    pools: { title: "Who watches — and how long", meta: "no platform reports this", rows: POOLS },
    decisionStates: {
      total: 1000,
      // Plain behaviour, no attitude and no banned verb. "Almost stayed" is the product's best
      // concept and now says what it means.
      states: [
        {
          key: "sold", label: "Watched", count: 380, share: 38, lever: "small creator",
          voice: { who: "Maya", tag: "small creator", quote: "ok this is the first time someone's said the quiet part. the niche advice has been killing me for two years", echo: 296, echoOf: 380 },
        },
        {
          key: "winnable", label: "Almost stayed", count: 201, share: 20, lever: "found you today",
          voice: { who: "Ana", tag: "found you today", quote: "saving this. what counts as a format though — a series, or a shot type?", echo: 174, echoOf: 201, swing: "Win these 201: watched 38% → 47%" },
        },
        {
          key: "skeptical", label: "Wrong audience", count: 176, share: 18, lever: "bigger account",
          voice: { who: "Sam", tag: "bigger account", quote: "easy to say with 40k followers. format is all you need when the reach is already there", echo: 96, echoOf: 176 },
        },
        {
          key: "gone", label: "Scrolled past", count: 243, share: 24, lever: "seen every hook video", loss: true,
          voice: { who: "Dev", tag: "seen every hook video", quote: "sounds like everyone else. every account on here says pick a format now", echo: 218, echoOf: 243 },
        },
      ],
    },
    // A video fold emits no per-viewer objections — the voices ride the decision rows above.
    voices: { kicker: "Why · coded from 1,000", total: 1000, reasons: [] },
    audienceFit: {
      baseline: "vs the room average",
      rows: [
        { label: "Returning", index: 116 },
        { label: "Followers", index: 34 },
        { label: "New viewers", index: 5 },
        { label: "Outside niche", index: -68, loss: true },
      ],
      read: "",
    },
    amplification: {
      reachMultiplier: 5.1,
      reached: 5100,
      cascade: [
        { label: "saw it", count: 1000 },
        { label: "reshared", count: 193 },
        { label: "their networks", count: 5100 },
      ],
      carriers: [
        { label: "Returning", factor: 3.2, lead: true },
        { label: "Followers", factor: 1.4 },
        { label: "New viewers", factor: 0.7 },
        { label: "Outside niche", factor: 0.3 },
      ],
      read: "",
    },
    distribution: {
      title: "Where & when",
      meta: "surfaces · followers online",
      surfaces: [
        { label: "For You", value: "53%", weight: 53 },
        { label: "Sound", value: "33%", weight: 33 },
        { label: "Search", value: "14%", weight: 14 },
      ],
      week: [
        { day: "Mon", value: 17 },
        { day: "Tue", value: 38, best: true, hours: "7–9pm" },
        { day: "Wed", value: 24 },
        { day: "Thu", value: 29 },
        { day: "Fri", value: 20 },
        { day: "Sat", value: 32 },
        { day: "Sun", value: 11 },
      ],
    },
    swing: { nearMiss: 201, fromPct: 38, toPct: 47, gainLabel: "+9% of the room", read: "" },
    room: {
      simulated: 1000,
      calibratedOn: "your 4.2K followers",
      confidence: 0.82,
      confidenceLabel: "High",
      note: "A modeled society · calibrated for engagement, not purchase.",
    },
  },
};
