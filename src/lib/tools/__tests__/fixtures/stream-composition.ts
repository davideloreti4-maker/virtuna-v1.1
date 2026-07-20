/**
 * THE canonical stream composition — one schema-valid `composed` block exercising all
 * 16 primitives (content from the frozen rev 7 sketch, docs/prototypes/
 * stream-concept-rev7.html). Consumers:
 *  - stream-primitives.test.ts — validates it + asserts every kind appears
 *    (the fixture half of the extension guarantee: no primitive without a fixture)
 *  - composed-block.test.tsx — renders it through the real MessageBlocks dispatch
 *  - /dev/cards fixtures.ts — the "Stream (composed)" gallery section
 */

import type { ComposedBlock } from "../../stream-primitives";

/** Self-contained 9:16 gradient cover (data URI) — the fixture must render identically
 *  offline/in tests; real rows carry ephemeral CDN covers and degrade via CoverFill. */
const cover = (a: string, b: string) =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='320'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23${a}'/><stop offset='1' stop-color='%23${b}'/></linearGradient></defs><rect width='180' height='320' fill='url(%23g)'/></svg>`;



const COVER_BRAEDAN = cover("4a4038", "262624");
const COVER_GYM = cover("3d4438", "1f1f1e");
const COVER_OFFICE = cover("383f4a", "262624");
const COVER_MORNING = cover("4a4438", "2a2622");
const COVER_CANDID = cover("344038", "1f1f1e");

export const STREAM_COMPOSITION: ComposedBlock = {
  type: "composed",
  props: {
    items: [
      { kind: "receipt", skill: "Hooks", summary: "ran your audience · 3 steps", model: "sim1-flash" },
      { kind: "prose", text: "Ranked — your room stopped hardest on the first one:" },
      {
        kind: "ranked",
        items: [
          {
            marker: "1",
            kicker: "For your Aspirants",
            hero: "I trained wrong for six years. Here's what I'd keep.",
            insight: "Outcome-first confession — opens an immediate “how?” gap your scanners stop for.",
            details: [
              { label: "Why it works", text: "Identity threat + earned authority: six years of receipts makes the confession credible." },
              { label: "Format", text: "Talking-head confession · on-screen receipts overlay" },
              { label: "Seed", text: "I trained wrong for six years." },
            ],
            proof: { band: "Strong", fraction: "8/10 stopped", door: true },
            verbatim: { quote: "Okay that opening got me — I need to know the rest.", speaker: "The Aspirant" },
            sourceProof: {
              handle: "braedan.health",
              videoUrl: "https://example.com/braedan",
              coverUrl: COVER_BRAEDAN,
              hookTemplate: "I [did the wrong thing] for [timeframe]. Here's what I'd keep.",
              archetype: "trap-mistake",
              multiplier: 90.7,
              views: 621000,
              baselineLabel: "vs followers",
              fitLabel: "adjacent",
            },
            primaryAction: "Write script →",
          },
          {
            marker: "2",
            hero: "Your form was never the problem.",
            proof: { band: "Mixed", fraction: "5/10 stopped" },
            source: "Original — not drawn from a retrieved video.",
            primaryAction: "Write script →",
          },
        ],
      },
      {
        kind: "revision",
        before: "Your form was never the problem.",
        after: "I filmed my form for 30 days. The problem was never form.",
        proof: { band: "Strong", fraction: "7/10 stopped · was 5/10" },
      },
      {
        kind: "stats",
        items: [
          { value: "2.9M", label: "views across 5 posts" },
          { value: "+212%", label: "vs your prior 5" },
          { value: "210K", label: "median — flat", tone: "warn" },
        ],
      },
      {
        kind: "table",
        columns: [
          { label: "Post" },
          { label: "Posted" },
          { label: "Views", align: "right" },
          { label: "vs usual", align: "right" },
        ],
        rows: [
          [{ text: "Gym transformation" }, { text: "May 18", tone: "dim" }, { text: "2.1M" }, { text: "9.2×", tone: "strong" }],
          [{ text: "30 days of ugly sets" }, { text: "Jun 20", tone: "dim" }, { text: "480K" }, { text: "2.4×" }],
          [{ text: "Office day-in-the-life" }, { text: "Jun 2", tone: "dim" }, { text: "38K" }, { text: "0.4×", tone: "accent" }],
        ],
      },
      {
        kind: "evidence",
        label: "Your last posts, measured",
        rows: [
          {
            title: "Gym transformation",
            byline: "@maven.creator",
            posted: "May 18",
            duration: "0:31",
            coverUrl: COVER_GYM,
            facet: "receipts-on-camera · talking-head",
            views: "2.1M",
            multiplier: { value: "9.2×", direction: "up" },
            baseline: "vs your usual",
            engagement: { likes: "312K", comments: "4.8K", shares: "21K", saves: "38K" },
            url: "https://example.com/gym",
          },
          {
            title: "Office day-in-the-life",
            byline: "@maven.creator",
            posted: "Jun 2",
            duration: "0:47",
            coverUrl: COVER_OFFICE,
            facet: "context-first vlog",
            views: "38K",
            multiplier: { value: "0.4×", direction: "down" },
            baseline: "vs your usual",
            engagement: { likes: "2.1K", comments: "88", shares: "41" },
          },
        ],
      },
      {
        kind: "media-strip",
        label: "Proven in adjacent rooms",
        basis: "× = views vs that creator's usual reach · fit = predicted for your audience",
        items: [
          {
            title: "The one habit that 10x'd my mornings",
            metric: "12×",
            fit: "Strong",
            byline: "@morning.mo",
            views: "2.4M",
            facet: "confession · zero-cut",
            duration: "0:34",
            engagement: { likes: "401K", shares: "18K" },
            coverUrl: COVER_MORNING,
            url: "https://example.com/morningmo",
          },
          {
            title: "Why your content isn't landing",
            metric: "4.1×",
            fit: "Mixed",
            byline: "@candid.kay",
            views: "890K",
            facet: "harsh-truth breakdown",
            duration: "0:51",
            coverUrl: COVER_CANDID,
          },
        ],
      },
      {
        kind: "compare",
        audiences: [
          {
            name: "Bootstrapped Founders",
            proof: { band: "Strong", fraction: "8/10 stop" },
            lever: "Lead with the dollar amount you saved in the first two seconds.",
            verbatim: { quote: "That's my exact problem, honestly.", speaker: "The Scout" },
          },
          {
            name: "General",
            proof: { band: "Mixed", fraction: "5/10 stop" },
            lever: "Add a concrete receipt early — that converts the skeptics.",
          },
        ],
      },
      {
        kind: "facts",
        sections: [
          {
            label: "Keep doing",
            rows: [
              { mark: "good", claim: "Counter-intuitive claims in the first two seconds", basis: "9 of 12 posts" },
              { mark: "good", claim: "On-screen receipts backing the hook", basis: "your top 3 all do it" },
            ],
          },
          {
            label: "Costing you",
            rows: [{ mark: "fix", claim: "Middles sag — 40% drop between 8s and 15s", basis: "7 of 12 posts" }],
          },
        ],
      },
      {
        kind: "plan",
        slots: [
          { when: "Tue", what: "The “trained wrong” script → film it", why: "your strongest opener" },
          { when: "Thu", what: "Form-myth explainer", why: "explainers over-index 2.1× for you" },
        ],
      },
      { kind: "proof", band: "Mixed", fraction: "6/10 stopped", door: true },
      { kind: "verbatim", quote: "Saving this — zero-cut is the realest thing on my feed all week.", speaker: "The Saver" },
      {
        kind: "persona-turn",
        speaker: "The Skeptic",
        text: "The payoff, in the first breath. Give me the number up front and I'll sit through every uncut second of it.",
      },
      {
        kind: "asset",
        label: "Script",
        title: "I trained wrong for six years",
        meta: "~40s · 5 beats",
        rows: [
          {
            label: "Hook",
            sub: "0–3s",
            text: "I trained wrong for six years — and kept every mistake on camera.",
            note: "Outcome-first claim opens an immediate “how?” gap.",
          },
          { label: "Turn", sub: "10–20s", text: "Then I noticed my worst-form months were my best-progress months." },
        ],
      },
      {
        kind: "test-verdict",
        verdict: "Solid contender",
        goNoGo: "go",
        audienceName: "Bootstrapped Founders",
        band: "Mixed",
        fraction: "6/10 stopped",
        theOneFix: "Open on the after-shot — your strongest frame is at 0:19; the scanners never reach it.",
        ceiling: "Keeps enough viewers to reach a thousand — the 0:08 drop stalls it before viral.",
        reactions: [
          { archetype: "The Saver", verdict: "stop", quote: "Saved it — the routine is specific enough to actually try." },
          { archetype: "The Scanner", verdict: "scroll", quote: "Three seconds of curtains before anything happens." },
        ],
        postWindow: "Tue 18:00–21:00 UTC",
        conceptText: "Zero-cut morning routine",
        analysisId: "dev-fixture-analysis",
        model: "sim1-max",
        tier: "Validated",
      },
      {
        kind: "input-ask",
        slots: [{ type: "link", placeholder: "Paste a TikTok link…" }],
        submitLabel: "Decode it →",
      },
      { kind: "prose", text: "The difference isn't the topic — it's that one opens on the payoff.", quiet: true },
    ],
  },
};
