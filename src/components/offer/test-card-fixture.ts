import type { VideoTestCardBlock } from "@/lib/tools/blocks";
import { FRAME_STILLS } from "./frame-stills";

/**
 * The landing's Test-card fixture — a snapshot of the SAME block `/dev/cards`
 * feeds the real `VideoTestCardRenderer`. The card's *design* auto-updates
 * because the landing imports the live renderer; this data is a copy of the
 * gallery fixture (dev/cards/page.tsx → "video-test-card"). If we later export
 * that fixture from a shared module, import it here so the data auto-updates too.
 */
export const TEST_CARD_FIXTURE: VideoTestCardBlock = {
  type: "video-test-card",
  props: {
    craftScore: 77,
    drivers: [
      { name: "Hook", score: 87, band: "strong" },
      { name: "Credibility", score: 80, band: "strong" },
      { name: "Clarity", score: 72, band: "strong" },
      { name: "Substance", score: 70, band: "strong" },
    ],
    filmstrip: [
      { idx: 0, label: "Cold open", atMs: 0, mark: "asset", keyframeUrl: FRAME_STILLS.coldOpen },
      { idx: 1, label: "Setup", atMs: 3000, mark: null, keyframeUrl: FRAME_STILLS.setup },
      { idx: 2, label: "Stall", atMs: 6000, mark: "weak", keyframeUrl: FRAME_STILLS.stall },
      { idx: 3, label: "Payoff", atMs: 9000, mark: null, keyframeUrl: FRAME_STILLS.payoff },
      { idx: 4, label: "Close", atMs: 12000, mark: null, keyframeUrl: FRAME_STILLS.close },
    ],
    dropLabel: "0:06 drop",
    durationLabel: "0:15",
    working: [
      "Keep the cold open",
      "Hook — strong cold open, visual stop power high",
      "Credibility — natural delivery, no over-production",
    ],
    notWorking: [
      { text: "Recut the open", atMs: 8000 },
      { text: "Tighten the text overlay", atMs: 1000 },
      { text: "Add an explicit CTA", atMs: 14000 },
    ],
    fixes: [
      {
        title: "Recut the open",
        lever: "Momentum",
        atMs: 8000,
        keyframeUrl: FRAME_STILLS.stall,
        diagnosis:
          "You lose them at 0:08 — the setup runs long and the payoff doesn't land until 0:09, the longest flat stretch in the cut.",
        why: "Attention holds on open loops. When a beat resolves nothing and opens nothing, the mind is free to leave — a pattern interrupt reopens the loop.",
        move: null,
        proof: {
          handle: "explore_create_capture",
          videoUrl: "https://www.tiktok.com/@explore_create_capture",
          coverUrl: FRAME_STILLS.payoff,
          hookTemplate: "The [editing trick] everyone sleeps on for [retention].",
          archetype: "secret-reveal-breakdown",
          multiplier: 14.2,
          views: 2400000,
          baselineLabel: "vs their usual",
          fitLabel: "structural",
        },
      },
      {
        title: "Sharpen the open",
        lever: "Stakes",
        atMs: 0,
        keyframeUrl: FRAME_STILLS.coldOpen,
        diagnosis:
          "Your open — “Here are three things nobody tells you about freelancing”. It works as a list promise, but the stakes stay abstract.",
        why: "A low-stakes open is a cheap skip — nothing is at risk, so there's little reason to stay. Naming a concrete stake widens the curiosity gap.",
        move: "I lost $4k before I learned these three freelancing rules",
        proof: {
          handle: "successwithumar",
          videoUrl: "https://www.tiktok.com/@successwithumar",
          coverUrl: FRAME_STILLS.coldOpen,
          hookTemplate: "Why your [hooks] stop working after [10k followers].",
          archetype: "problem",
          multiplier: 6.8,
          views: 820000,
          baselineLabel: "vs their usual",
          fitLabel: "structural",
        },
      },
      {
        title: "Add an explicit CTA",
        lever: "CTA",
        atMs: 14000,
        keyframeUrl: FRAME_STILLS.close,
        diagnosis:
          "The last 2s trail off. Ask for the follow while attention is still on the payoff — one clear line, on screen and spoken.",
        why: "The end of a watch is the moment a viewer remembers most. An explicit ask, made while attention is still high, turns that peak into an action.",
        move: null,
        proof: null,
      },
    ],
    audienceName: "Skincare buyers",
    analysisId: "dev-fixture-id",
    model: "sim1-max",
    tier: "Directional",
  },
};
