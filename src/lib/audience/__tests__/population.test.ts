/**
 * Audience Sim v2 — Stage 2 population math (pure core).
 *
 * Proves the two load-bearing behaviours the spike established (design §8.2), now on the
 * PRODUCTION `AudienceSignature` shape:
 *   - the TWO independent stop-drivers (a strong hook carries a low-attention scroller with
 *     ZERO topic interest; on-topic substance carries a patient niche viewer) — the asymmetry
 *     the flat interest-gate erased;
 *   - a believable, DIFFERENTIATED distribution across content (different hooks rotate which
 *     segment leads), produced by pure arithmetic — no LLM in the scoring loop.
 * Plus the mechanical guarantees: determinism, share-weighted counts, axis-guard, legacy skip.
 */

import { describe, it, expect } from "vitest";
import type { AudienceSignature, SignaturePersona } from "../audience-types";
import {
  signatureHasPopulationAxes,
  expandSignature,
  pStop,
  reactPopulation,
  type ContentVector,
  type PopulationIndividual,
} from "../population";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSignature(personas: SignaturePersona[], topicVocab: string[]): AudienceSignature {
  return {
    creator_persona: {
      content_description: "x",
      context: "x",
      writing_style_sample: "x",
      format_signature: "x",
    },
    audience: {
      follower_tier: "10k-100k",
      maturity: "established",
      temperature_mix: { cold: 0.4, warm: 0.4, hot: 0.2 },
      interest_tags: ["magic"],
      what_resonates: "x",
      what_falls_flat: "x",
      persona_weights: { fyp: 0.4, niche: 0.3, loyalist: 0.2, cross_niche: 0.1 },
      personas,
      topic_vocab: topicVocab,
    },
    summary: "x",
    provenance: {
      handle: "@x",
      scraped_at: "2026-07-16",
      videos_analyzed: 8,
      videos_watched: 4,
      sub_coverage: "6/8",
    },
  };
}

/** A low-attention scroller who lives on the hook and cares about no niche subject. */
const SCROLLER: SignaturePersona = {
  archetype: "lurker",
  share: 0.6,
  temperature: "cold",
  disposition: "scanner",
  reaction_frame: "x",
  evidence: "x",
  display_name: "Dopamine Scrollers",
  reaction: {
    interests: {}, // no topical affinity at all
    hookSensitivity: 0.2,
    noveltyBias: 0.5,
    skepticism: 0.2,
    attentionSpan: 0.1, // hookAppetite ≈ 0.9
  },
  behavior: { watchThrough: 0.2, sharePropensity: 0.5, commentPropensity: 0.3, savePropensity: 0.1 },
};

/** A patient craft student — deep interest in the niche subject, indifferent to raw spectacle. */
const CRAFT_NERD: SignaturePersona = {
  archetype: "niche_deep_buyer",
  share: 0.4,
  temperature: "hot",
  disposition: "collector",
  reaction_frame: "x",
  evidence: "x",
  display_name: "Frame-by-frame editors",
  reaction: {
    interests: { craft: 0.9 },
    hookSensitivity: 0.8,
    noveltyBias: 0.3,
    skepticism: 0.5,
    attentionSpan: 0.9, // hookAppetite ≈ 0.1
  },
  behavior: { watchThrough: 0.9, sharePropensity: 0.2, commentPropensity: 0.4, savePropensity: 0.9 },
};

const VOCAB = ["craft", "spectacle"];

/** A broad-spectacle strong hook that hits NO niche subject. */
const SPECTACLE_HOOK: ContentVector = {
  topics: { spectacle: 0.9 },
  hookStrength: 0.95,
  novelty: 0.5,
  hype: 0.2,
  slowness: 0.1,
};
/** An on-topic craft hook: weaker opening, slow payoff, deep subject. */
const CRAFT_HOOK: ContentVector = {
  topics: { craft: 0.9 },
  hookStrength: 0.4,
  novelty: 0.3,
  hype: 0.1,
  slowness: 0.7,
};

const indiv = (p: SignaturePersona): PopulationIndividual => ({
  id: p.archetype,
  archetype: p.archetype,
  ...p.reaction!,
});

// ─── signatureHasPopulationAxes ───────────────────────────────────────────────

describe("signatureHasPopulationAxes", () => {
  it("true when topic_vocab non-empty AND ≥1 persona has reaction axes", () => {
    expect(signatureHasPopulationAxes(makeSignature([SCROLLER], VOCAB))).toBe(true);
  });
  it("false when topic_vocab is empty", () => {
    expect(signatureHasPopulationAxes(makeSignature([SCROLLER], []))).toBe(false);
  });
  it("false when no persona carries reaction axes (legacy/General)", () => {
    const legacy: SignaturePersona = { ...SCROLLER, reaction: undefined, behavior: undefined };
    expect(signatureHasPopulationAxes(makeSignature([legacy], VOCAB))).toBe(false);
  });
  it("false for null signature", () => {
    expect(signatureHasPopulationAxes(null)).toBe(false);
  });
});

// ─── The scorer's two independent stop-drivers (the asymmetry) ────────────────

describe("pStop — two independent stop-drivers", () => {
  it("a strong hook carries a low-attention scroller with ZERO topic interest", () => {
    const { p, why } = pStop(indiv(SCROLLER), SPECTACLE_HOOK);
    expect(p).toBeGreaterThan(0.5);
    expect(why).toBe("strong-hook");
  });
  it("that same spectacle hook does NOT carry a patient craft student (low hook appetite, no interest)", () => {
    const { p } = pStop(indiv(CRAFT_NERD), SPECTACLE_HOOK);
    expect(p).toBeLessThan(0.5);
  });
  it("on-topic substance carries the patient niche viewer (interest, not hook)", () => {
    const { p, why } = pStop(indiv(CRAFT_NERD), CRAFT_HOOK);
    expect(p).toBeGreaterThan(0.5);
    expect(why).toBe("interest");
  });
  it("the slow craft hook does NOT carry the impatient scroller", () => {
    const { p } = pStop(indiv(SCROLLER), CRAFT_HOOK);
    expect(p).toBeLessThan(0.5);
  });
});

// ─── expandSignature — determinism, counts, guard ─────────────────────────────

describe("expandSignature", () => {
  const sig = makeSignature([SCROLLER, CRAFT_NERD], VOCAB);

  it("is deterministic — same seed ⇒ byte-identical individuals", () => {
    const a = expandSignature(sig, { N: 200, seed: 42 });
    const b = expandSignature(sig, { N: 200, seed: 42 });
    expect(a).toEqual(b);
  });

  it("samples share-weighted counts (~60/40 of N)", () => {
    const people = expandSignature(sig, { N: 100, seed: 1 });
    const scrollers = people.filter((p) => p.archetype === "lurker").length;
    const nerds = people.filter((p) => p.archetype === "niche_deep_buyer").length;
    expect(scrollers).toBe(60);
    expect(nerds).toBe(40);
  });

  it("keeps all axes in [0,1] after jitter", () => {
    for (const p of expandSignature(sig, { N: 300, seed: 7 })) {
      for (const v of [p.hookSensitivity, p.noveltyBias, p.skepticism, p.attentionSpan]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("skips personas without reaction axes (never samples a legacy slot)", () => {
    const legacy: SignaturePersona = { ...CRAFT_NERD, reaction: undefined };
    const mixed = makeSignature([SCROLLER, legacy], VOCAB);
    const people = expandSignature(mixed, { N: 100, seed: 1 });
    expect(people.every((p) => p.archetype === "lurker")).toBe(true);
  });
});

// ─── reactPopulation — aggregate integrity + differentiation ──────────────────

describe("reactPopulation", () => {
  const sig = makeSignature([SCROLLER, CRAFT_NERD], VOCAB);

  it("stop + scroll === total, and segments are sorted by share desc", () => {
    const agg = reactPopulation(sig, SPECTACLE_HOOK, { N: 1000, seed: 3 });
    expect(agg.stop + agg.scroll).toBe(agg.total);
    expect(agg.total).toBeGreaterThan(0);
    expect(agg.segments[0]!.archetype).toBe("lurker"); // 0.6 share leads
    expect(agg.segments[1]!.archetype).toBe("niche_deep_buyer");
  });

  it("carries the creator-specific display_name onto each segment", () => {
    const agg = reactPopulation(sig, SPECTACLE_HOOK, { N: 200, seed: 3 });
    const lurker = agg.segments.find((s) => s.archetype === "lurker");
    expect(lurker!.displayName).toBe("Dopamine Scrollers");
  });

  it("DIFFERENTIATES: the spectacle hook lights the scrollers, the craft hook lights the nerds", () => {
    const spectacle = reactPopulation(sig, SPECTACLE_HOOK, { N: 1000, seed: 3 });
    const craft = reactPopulation(sig, CRAFT_HOOK, { N: 1000, seed: 3 });

    const scrollerStop = (a: typeof spectacle) =>
      a.segments.find((s) => s.archetype === "lurker")!.stopPct;
    const nerdStop = (a: typeof spectacle) =>
      a.segments.find((s) => s.archetype === "niche_deep_buyer")!.stopPct;

    // spectacle: scrollers stop hard, nerds mostly scroll.
    expect(scrollerStop(spectacle)).toBeGreaterThan(nerdStop(spectacle));
    // craft: nerds stop hard, scrollers mostly scroll — the lead segment ROTATES.
    expect(nerdStop(craft)).toBeGreaterThan(scrollerStop(craft));
    // the overall distribution genuinely moves between the two hooks.
    expect(spectacle.stopPct).not.toBe(craft.stopPct);
  });

  it("empty-topics content never crashes and yields a low-stop aggregate", () => {
    const agg = reactPopulation(sig, { topics: {}, hookStrength: 0.1, novelty: 0.5, hype: 0, slowness: 0.5 }, { N: 200, seed: 3 });
    expect(agg.total).toBe(200);
    expect(agg.stopPct).toBeLessThan(50);
  });
});
