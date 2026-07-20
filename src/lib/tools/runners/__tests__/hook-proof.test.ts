import { describe, it, expect } from "vitest";
import { buildHookProof } from "../hooks-runner";
import { buildProofFromSource, coerceSourceIndex } from "../build-proof";
import { HookProofSchema, parseProofProp } from "@/lib/tools/blocks";
import type { RetrievedExample } from "@/lib/grounding/types";

/**
 * buildHookProof — the receipts-on-cards attribution link (§11f). Maps a model-emitted
 * sourceIndex back to the grounding example it adapted and freezes the honest receipt.
 * These tests pin the honesty-spine rules: no source / out-of-range / handle-less → no receipt.
 */

function makeExample(over: Partial<RetrievedExample> = {}): RetrievedExample {
  return {
    teardownId: "t-1",
    handle: "braedan.health",
    videoUrl: "https://www.tiktok.com/@braedan.health/video/7300000000000000000",
    coverUrl: "https://cdn.example/cover.jpg",
    platform: "tiktok",
    multiplier: 90.7,
    views: 621000,
    baselineLabel: "vs followers",
    fitLabel: "adjacent",
    hookArchetype: "secret-reveal-breakdown",
    format: "breakdowns-explainers",
    visualSetting: "studio_set",
    editingStyle: "office-room-yap",
    hookTechniques: [],
    niche: "health-fitness",
    similarity: 0.71,
    spokenHook: "The one breakfast that fixed my energy",
    hookTemplate: "The one [thing] that fixed my [problem]",
    template: null,
    idea: null,
    whyItWorks: "Concrete outcome + curiosity gap",
    sourcePool: "scraped",
    trustWeight: 1,
    fromPersonal: false,
    ...over,
  };
}

describe("buildHookProof", () => {
  const examples = [makeExample({ handle: "a" }), makeExample({ handle: "b" }), makeExample({ handle: "c" })];

  it("maps a valid 1-based index to that example's receipt", () => {
    const proof = buildHookProof(2, examples);
    expect(proof).not.toBeNull();
    expect(proof!.handle).toBe("b");
    // Output is a valid HookProof (renderer + block schema contract)
    expect(HookProofSchema.safeParse(proof).success).toBe(true);
  });

  it("carries the frozen receipt fields verbatim", () => {
    const proof = buildHookProof(1, [makeExample()]);
    expect(proof).toEqual({
      handle: "braedan.health",
      videoUrl: "https://www.tiktok.com/@braedan.health/video/7300000000000000000",
      coverUrl: "https://cdn.example/cover.jpg",
      hookTemplate: "The one [thing] that fixed my [problem]",
      archetype: "secret-reveal-breakdown",
      multiplier: 90.7,
      views: 621000,
      baselineLabel: "vs followers",
      fitLabel: "adjacent",
    });
  });

  it("returns null for sourceIndex 0 (hook adapted no specific source)", () => {
    expect(buildHookProof(0, examples)).toBeNull();
  });

  it("returns null when the index is out of range (never fabricate a source)", () => {
    expect(buildHookProof(4, examples)).toBeNull();
    expect(buildHookProof(-1, examples)).toBeNull();
  });

  it("returns null when the matched example has no handle (nothing honest to attribute)", () => {
    expect(buildHookProof(1, [makeExample({ handle: null })])).toBeNull();
  });

  it("returns null against an empty corpus (ungrounded/degraded run)", () => {
    expect(buildHookProof(1, [])).toBeNull();
  });

  it("preserves nullable stats — a caption-tier row with no multiplier still yields a handle receipt", () => {
    const proof = buildHookProof(1, [makeExample({ multiplier: null, views: null, baselineLabel: null })]);
    expect(proof).not.toBeNull();
    expect(proof!.handle).toBe("braedan.health");
    expect(proof!.multiplier).toBeNull();
    expect(HookProofSchema.safeParse(proof).success).toBe(true);
  });

  it("is the SAME shared mapper every grounded runner uses (fan-out — ideas/script attribute identically)", () => {
    expect(buildHookProof).toBe(buildProofFromSource);
  });
});

describe("coerceSourceIndex — shared structured-output coercion (§11f)", () => {
  it("passes clean positive integers and truncates floats", () => {
    expect(coerceSourceIndex(3)).toBe(3);
    expect(coerceSourceIndex(2.9)).toBe(2);
  });

  it("maps missing/malformed/non-positive to 0 (never fabricate an attribution)", () => {
    expect(coerceSourceIndex(undefined)).toBe(0);
    expect(coerceSourceIndex(null)).toBe(0);
    expect(coerceSourceIndex("2")).toBe(0);
    expect(coerceSourceIndex(NaN)).toBe(0);
    expect(coerceSourceIndex(-1)).toBe(0);
    expect(coerceSourceIndex(0)).toBe(0);
  });
});

describe("parseProofProp — client-side SSE proof coercion (§11f stream fix)", () => {
  it("accepts a valid receipt object from the wire", () => {
    const proof = buildProofFromSource(1, [makeExample()]);
    expect(parseProofProp(proof)).toEqual(proof);
  });

  it("rejects null/absent/malformed values to undefined (card renders ungrounded, never crashes)", () => {
    expect(parseProofProp(null)).toBeUndefined();
    expect(parseProofProp(undefined)).toBeUndefined();
    expect(parseProofProp("not-an-object")).toBeUndefined();
    expect(parseProofProp({ handle: 42 })).toBeUndefined();
  });
});
