import { describe, it, expect, vi } from "vitest";
import { adaptCorpusBlock, type AdaptComplete, type AdaptCorpusInput } from "../adapt";
import type { RetrievedExample } from "../types";

/**
 * The adapt briefer is exercised with an INJECTED `complete` fn — no network, fully deterministic.
 * These assert the plumbing the runner depends on: the fitted+dosed brief REPLACES the raw slice,
 * 'none' structures are dropped, `used` stays 1:1 with the brief numbering (so sourceIndex→receipt
 * survives), the receipt is CODE-stamped (a curated row can never be dressed "proven"), and ANY
 * failure falls back to the raw slice rather than crashing or silently ungrounding.
 */

function proven(id: string, madlib: string): RetrievedExample {
  return {
    teardownId: id,
    handle: `maker_${id}`,
    videoUrl: `https://tiktok.com/@maker/video/${id}`,
    coverUrl: null,
    platform: "tiktok",
    multiplier: 12, // ≥ MIN_OUTLIER_MULTIPLIER (3) + a baseline → "proven by"
    views: 1_000_000,
    baselineLabel: "vs followers",
    fitLabel: "adjacent",
    hookArchetype: "contrarian",
    format: "listicle",
    visualSetting: "studio_set",
    editingStyle: "office-room-yap",
    hookTechniques: [],
    niche: "health-fitness",
    similarity: 0.71,
    spokenHook: `spoken ${id}`,
    hookTemplate: madlib,
    template: null,
    idea: null,
    whyItWorks: `why ${id}`,
    sourcePool: "scraped",
    trustWeight: 0.6,
    fromPersonal: false,
  };
}

function curated(id: string, madlib: string): RetrievedExample {
  return {
    ...proven(id, madlib),
    handle: `curator_${id}`,
    multiplier: null, // no baseline + no multiplier → "curated exemplar —", never "proven"
    baselineLabel: null,
    sourcePool: "curated",
  };
}

function input(
  examples: RetrievedExample[],
  skill: AdaptCorpusInput["skill"] = "hooks",
): AdaptCorpusInput {
  return {
    skill,
    ask: "how to price freelance work",
    niche: "creator-economy",
    platform: "tiktok",
    profile: { niche_primary: "creator-economy", writing_voice_sample: "plain, direct" },
    examples,
  };
}

/** A `complete` that returns a canned structures JSON verbatim. */
const canned = (json: unknown): AdaptComplete => async () => JSON.stringify(json);

describe("adaptCorpusBlock — the fitted+dosed brief", () => {
  it("drops 'none', keeps the fitted structures, and numbers `used` 1:1 with the brief", async () => {
    const a = proven("a", "Stop buying [product].");
    const b = curated("b", "The [N] levels of [topic].");
    const c = proven("c", "You've been lied to about [topic].");

    const complete = vi.fn<AdaptComplete>(
      canned({
        structures: [
          { sourceIndex: 1, dosage: "swap", fitted: "Stop overpaying for your own time.", fitReason: "pricing fits the stop-frame" },
          { sourceIndex: 2, dosage: "angle", fitted: "The 3 levels of freelance pricing.", fitReason: "tiering maps onto rates" },
          { sourceIndex: 3, dosage: "none", fitted: "", fitReason: "conspiracy framing does not fit a pricing how-to" },
        ],
      }),
    );

    const { corpus, used } = await adaptCorpusBlock(input([a, b, c]), { complete });

    expect(complete).toHaveBeenCalledOnce();
    // c was judged 'none' → dropped. Only a + b survive, in input order.
    expect(used.map((e) => e.teardownId)).toEqual(["a", "b"]);
    expect(corpus).toContain("1. [swap] Stop overpaying for your own time.");
    expect(corpus).toContain("2. [angle] The 3 levels of freelance pricing.");
    // The dropped structure's fitted/reason text must not leak into the brief.
    expect(corpus).not.toContain("conspiracy framing");
    // It is a brief, not the raw slice — no "MADLIB:" lines.
    expect(corpus).not.toContain("MADLIB:");
  });

  it("stamps the receipt in CODE — a curated row is never dressed 'proven'", async () => {
    const a = proven("a", "Stop buying [product].");
    const b = curated("b", "The [N] levels of [topic].");

    const complete = canned({
      structures: [
        // The model even *claims* proof in its prose; the receipt is stamped by us regardless.
        { sourceIndex: 1, dosage: "swap", fitted: "line a", fitReason: "this proven viral banger fits" },
        { sourceIndex: 2, dosage: "swap", fitted: "line b", fitReason: "fits too" },
      ],
    });

    const { corpus } = await adaptCorpusBlock(input([a, b]), { complete });

    expect(corpus).toContain("proven by @maker_a"); // measured outlier → strong receipt
    expect(corpus).toContain("curated exemplar — @curator_b"); // no baseline → honest receipt
    // The curated row never gets a "proven by" line no matter what the model wrote.
    expect(corpus).not.toContain("proven by @curator_b");
  });

  it("falls back to the raw slice when the adapt call throws", async () => {
    const a = proven("a", "Stop buying [product].");
    const complete: AdaptComplete = async () => {
      throw new Error("dashscope 500");
    };

    const { corpus, used } = await adaptCorpusBlock(input([a]), { complete });

    // Raw-slice signature: buildCorpusBlock renders the MADLIB. Grounding degraded, not lost.
    expect(corpus).toContain("MADLIB: Stop buying [product].");
    expect(used.map((e) => e.teardownId)).toEqual(["a"]);
  });

  it("falls back to the raw slice when every structure is judged 'none'", async () => {
    const a = proven("a", "Stop buying [product].");
    const b = proven("b", "The [N] levels of [topic].");
    const complete = canned({
      structures: [
        { sourceIndex: 1, dosage: "none", fitted: "", fitReason: "no" },
        { sourceIndex: 2, dosage: "none", fitted: "", fitReason: "no" },
      ],
    });

    const { corpus, used } = await adaptCorpusBlock(input([a, b]), { complete });

    expect(corpus).toContain("MADLIB:"); // raw slice, not an empty/ungrounded result
    expect(used).toHaveLength(2);
  });

  it("ignores out-of-range / malformed sourceIndex without shifting the mapping", async () => {
    const a = proven("a", "Stop buying [product].");
    const b = proven("b", "The [N] levels of [topic].");
    const complete = canned({
      structures: [
        { sourceIndex: 99, dosage: "swap", fitted: "ghost", fitReason: "out of range" },
        { sourceIndex: 2, dosage: "swap", fitted: "real line for b", fitReason: "fits" },
      ],
    });

    const { corpus, used } = await adaptCorpusBlock(input([a, b]), { complete });

    // Only b (index 2) survives; it is renumbered to position 1 and `used` holds exactly it.
    expect(used.map((e) => e.teardownId)).toEqual(["b"]);
    expect(corpus).toContain("1. [swap] real line for b");
    expect(corpus).not.toContain("ghost");
  });

  it("returns an empty result on empty input (no LLM call)", async () => {
    const complete = vi.fn<AdaptComplete>();
    const result = await adaptCorpusBlock(input([]), { complete });
    expect(result).toEqual({ corpus: undefined, used: [] });
    expect(complete).not.toHaveBeenCalled();
  });
});

// ─── Phase 2: ideas + script get their OWN prompt, header, and fit measure ────

describe("adaptCorpusBlock — per-skill briefs (ideas + script fan-out)", () => {
  it("ideas: emits the belief↔reality brief header and keeps the fitted tension", async () => {
    const a = proven("a", "Stop buying [product].");
    const b = curated("b", "The [N] levels of [topic].");
    const complete = vi.fn<AdaptComplete>(
      canned({
        structures: [
          { sourceIndex: 1, dosage: "swap", fitted: "Freelancers believe rates equal skill — but clients pay for outcomes.", fitReason: "reframes the pricing belief" },
          { sourceIndex: 2, dosage: "none", fitted: "", fitReason: "no tension maps" },
        ],
      }),
    );

    // The system prompt handed to the model is the IDEAS one — not the hooks prompt.
    const { corpus, used } = await adaptCorpusBlock(input([a, b], "ideas"), { complete });
    const [systemPrompt] = complete.mock.calls[0]!;
    expect(systemPrompt).toContain("An IDEAS writer is about to generate content ideas");
    expect(systemPrompt).not.toContain("hook writer");

    // Brief header is the ideas one (unique marker), and the tension line survives.
    expect(corpus).toContain("ALREADY RE-POINTED at your subject");
    expect(corpus).toContain("1. [swap] Freelancers believe rates equal skill — but clients pay for outcomes.");
    expect(used.map((e) => e.teardownId)).toEqual(["a"]); // b dropped (none)
    // Not the hooks brief header, not the raw slice.
    expect(corpus).not.toContain("proven short-form hook structures");
    expect(corpus).not.toContain("works because:");
  });

  it("script: emits the beat-arc brief header and keeps the fitted arc uncapped", async () => {
    const a = proven("a", "Stop buying [product].");
    // A 5-beat arc is ~200 chars — it must NOT be truncated the way a 180-char hook cap would.
    const arc =
      "Hook: overpaying → Setup: your rate story → Turn: outcomes not hours → Payoff: a pricing frame → CTA: audit one invoice today";
    const complete = vi.fn<AdaptComplete>(
      canned({
        structures: [{ sourceIndex: 1, dosage: "swap", fitted: arc, fitReason: "arc fits a how-to" }],
      }),
    );

    const { corpus, used } = await adaptCorpusBlock(input([a], "script"), { complete });
    const [systemPrompt] = complete.mock.calls[0]!;
    expect(systemPrompt).toContain("A SCRIPT writer is about to write one short-form script");

    expect(corpus).toContain("ALREADY MAPPED onto your subject");
    expect(corpus).toContain(arc); // full arc, no mid-beat clip
    expect(corpus).toContain("→ CTA: audit one invoice today");
    expect(used.map((e) => e.teardownId)).toEqual(["a"]);
  });

  it("code-stamps the receipt for ideas/script too — a curated row is never 'proven'", async () => {
    const b = curated("b", "The [N] levels of [topic].");
    const complete = canned({
      structures: [
        { sourceIndex: 1, dosage: "swap", fitted: "belief X — but really Y", fitReason: "this proven banger fits" },
      ],
    });

    const { corpus } = await adaptCorpusBlock(input([b], "ideas"), { complete });
    expect(corpus).toContain("curated exemplar — @curator_b");
    expect(corpus).not.toContain("proven by @curator_b");
  });

  it("falls back to the raw per-skill slice on failure (script → the raw script renderer)", async () => {
    const a = proven("a", "Stop buying [product].");
    const complete: AdaptComplete = async () => {
      throw new Error("dashscope 500");
    };

    const { corpus, used } = await adaptCorpusBlock(input([a], "script"), { complete });
    // Raw script slice opens each line with the source hook — the brief never emits "opened with:".
    expect(corpus).toContain('opened with: "spoken a"');
    expect(corpus).not.toContain("ALREADY MAPPED");
    expect(used.map((e) => e.teardownId)).toEqual(["a"]);
  });
});
