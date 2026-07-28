/**
 * Fixture for the Ambient Audience v2 **Simulate sheet** (surface ⑤, the run picker).
 *
 * ⑤ is "arming an instrument, not filling a form" — the deliberate-screening surface reached from
 * a ④ ACTIONS-grid preset, a `Screen ▾` on a chat object, or a one-tap on a skill card. It carries
 * the L4 **Run** shelf (lens · segment · stimulus) over the inherited **Thread** context (room ·
 * scene · fidelity), assembling into a receipt sentence before the run is armed.
 *
 * Owner design calls resolved 2026-07-21 (concept doc opens #2/#8):
 *  - Preset lenses = the BEHAVIORAL funnel STOP · FINISH · SHARE · FOLLOW · BUY (observable actions;
 *    want/believe/feel are internal states the Brain tab decomposes as signals, not population lenses).
 *  - Custom question compiles VISIBLY to the nearest preset (resolved open #2 — custom is IN for v1).
 *  - Scene ≠ provenance ⇒ ONE inline mono projection tag, never a gate/soft-block (resolved open #8).
 *
 * Swap each field for a live producer as the run-result contract lands (build handoff §6).
 */

import type { SimulateData } from "./AmbientSimulate";

export const SIMULATE_R4: SimulateData = {
  stimulus: {
    text: "Nobody tells you the first 10k followers is the hardest part…",
    kind: "hook",
  },
  room: "Your audience",
  provenance: "TikTok", // what the audience was CALIBRATED from (fact, from the audience-page badge)
  scene: "TikTok", // how they ENCOUNTER this stimulus (choice, inherited thread chip). ≠ provenance ⇒ tag
  sceneOptions: ["TikTok", "No feed"], // only scenes with a real engine frame (TikTok → socials, No feed → general)
  fidelity: "flash",
  // the behavioral funnel — each lens is a decision the room makes, in funnel order (owner call
  // 2026-07-21). The `stage` names where in the funnel it sits so the choice is legible.
  lenses: [
    { key: "stop", label: "Stop", gloss: "stop scrolling", stage: "Attention — the thumb-stop in the first 2 seconds" },
    { key: "finish", label: "Finish", gloss: "watch it through", stage: "Retention — do they stay to the end" },
    { key: "share", label: "Share", gloss: "send it to someone", stage: "Spread — worth passing on" },
    { key: "follow", label: "Follow", gloss: "follow you", stage: "Growth — worth coming back for" },
    { key: "buy", label: "Buy", gloss: "act on the CTA", stage: "Conversion — click, buy, or sign up" },
  ],
  defaultLens: 0, // armed from the ACTIONS preset ("Test a real video" → would stop)
  // slices of the calibrated room (share reduces n; whole-room is the default)
  // `archetype` is the ENGINE key the projection is read by; the label is display text only.
  segments: [
    { archetype: null, label: "Everyone", share: 1 },
    { archetype: "niche_buyer", label: "Builders", share: 0.41 },
    { archetype: "casual_scroller", label: "Scrollers", share: 0.26 },
    { archetype: "cross_niche_curiosity", label: "Drop-ins", share: 0.14 },
    { archetype: "tough_crowd", label: "Skeptics", share: 0.12 },
  ],
  // the rank this run is deepening (only shown on a `develop` entry) — the sim refines it, never overturns it
  develop: { band: "Strong", value: "8/10", lensLabel: "stopped" },
  // cold-start intake doors — SCREEN active; COMPARE (A/B) + QUERY (ask/survey) deferred ("soon"),
  // their arms/outputs need their own read-templates (the per-domain-bundle work, same as pricing)
  intake: [
    { kind: "video", label: "Test a real video", sub: "upload or paste a link — the full read", family: "screen", status: "active", stimulusKind: "video" },
    { kind: "draft", label: "Screen a draft", sub: "a hook, script, or caption you're weighing", family: "screen", status: "active", stimulusKind: "draft" },
    { kind: "ab", label: "Compare two (A/B)", sub: "run both variants, see who wins", family: "compare", status: "soon" },
    { kind: "ask", label: "Ask the room", sub: "put a question to your audience", family: "query", status: "soon" },
    { kind: "survey", label: "Run a survey", sub: "structured answers across the room", family: "query", status: "soon" },
  ],
};

/** Same run, but the encounter scene ≠ calibration provenance — demonstrates the projection tag.
 *  The drift runs the other way now: the scene is always one the engine can simulate, and it is the
 *  PROVENANCE that differs (an Instagram-calibrated audience screened in the TikTok frame). Before
 *  2026-07-28 this fixture set `scene: "Instagram"`, a scene with no engine frame behind it. */
export const SIMULATE_R4_MISMATCH: SimulateData = {
  ...SIMULATE_R4,
  provenance: "Instagram",
};
