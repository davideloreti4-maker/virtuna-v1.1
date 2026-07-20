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
            hero: "I trained wrong for six years. Here's what I'd keep.",
            proof: { band: "Strong", fraction: "8/10 stopped", door: true },
            verbatim: { quote: "Okay that opening got me — I need to know the rest.", speaker: "The Aspirant" },
            source: "↳ structure from @braedan.health · 90.7× vs followers · 621K views",
            sourceUrl: "https://example.com/braedan",
          },
          {
            marker: "2",
            hero: "Your form was never the problem.",
            proof: { band: "Mixed", fraction: "5/10 stopped" },
            source: "↳ original — not drawn from a retrieved video",
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
        rows: [
          {
            title: "Gym transformation",
            byline: "May 18",
            multiplier: { value: "9.2×", direction: "up" },
            meta: "vs your usual · 2.1M",
            url: "https://example.com/gym",
          },
          {
            title: "Office day-in-the-life",
            byline: "Jun 2",
            multiplier: { value: "0.4×", direction: "down" },
            meta: "vs your usual · 38K",
          },
        ],
      },
      {
        kind: "media-strip",
        basis: "× = views vs that creator's usual reach · fit = predicted for your audience",
        items: [
          { title: "The one habit that 10x'd my mornings", metric: "12×", fit: "Strong", byline: "@morning.mo · 2.4M", duration: "0:34" },
          { title: "Why your content isn't landing", metric: "4.1×", fit: "Mixed", byline: "@candid.kay · 890K", duration: "0:51" },
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
        kind: "input-ask",
        slots: [{ type: "link", placeholder: "Paste a TikTok link…" }],
        submitLabel: "Decode it →",
      },
      { kind: "prose", text: "The difference isn't the topic — it's that one opens on the payoff.", quiet: true },
    ],
  },
};
