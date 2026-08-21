/**
 * attribution.test.ts — one test per strip reason, plus the two behavior-preservation
 * properties the refactor exists to protect.
 *
 * The classifier replaces hooks-runner's proof ternary, so its GUARD ORDER is the contract,
 * not an implementation detail: `admit()` mutates a per-run counter, so a citation stripped
 * by an earlier guard must never consume a diversity slot. The last two tests pin that —
 * without them a reordering that looks equivalent would silently change which cards keep
 * receipts on a real run.
 */

import { describe, expect, it } from "vitest";
import type { RetrievedExample } from "@/lib/grounding/types";
import { resolveAttribution } from "../attribution";
import { createSourceDiversityCap } from "../output-guards";

/** A real-shaped grounding example whose madlib the generated line will NOT instantiate. */
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

const EX = makeExample({ hookTemplate: "did you know [thing] about [topic]" });
const LINE_MATCHING = "did you know this about protein"; // instantiates the template
const LINE_FOREIGN = "completely unrelated words here"; // shares no skeleton

function args(over: Partial<Parameters<typeof resolveAttribution>[0]> = {}) {
  return {
    sourceIndex: 1,
    shownExamples: [EX],
    allExamples: [EX],
    line: LINE_MATCHING,
    adapted: false,
    admit: createSourceDiversityCap().admit,
    ...over,
  };
}

describe("resolveAttribution", () => {
  it("model-zero when the model cited nothing", () => {
    const d = resolveAttribution(args({ sourceIndex: 0 }));
    expect(d).toMatchObject({ proof: null, reason: "model-zero" });
  });

  it("invalid-index when the citation exceeds every example", () => {
    const d = resolveAttribution(args({ sourceIndex: 9 }));
    expect(d).toMatchObject({ proof: null, reason: "invalid-index" });
  });

  it("trimmed-from-bundle when the cited example was truncated out of the prompt", () => {
    const d = resolveAttribution(args({ shownExamples: [], allExamples: [EX] }));
    expect(d).toMatchObject({ proof: null, reason: "trimmed-from-bundle" });
  });

  it("no-handle when the shown example cannot be attributed", () => {
    const bare = makeExample({ handle: null });
    const d = resolveAttribution(args({ shownExamples: [bare], allExamples: [bare] }));
    expect(d).toMatchObject({ proof: null, reason: "no-handle" });
  });

  it("lexical-mismatch on the raw path when the line ignores the template", () => {
    const d = resolveAttribution(args({ line: LINE_FOREIGN }));
    expect(d).toMatchObject({ proof: null, reason: "lexical-mismatch" });
  });

  it("adapted path bypasses the lexical check", () => {
    const d = resolveAttribution(args({ line: LINE_FOREIGN, adapted: true }));
    expect(d.reason).toBe("kept");
    expect(d.proof?.handle).toBe(EX.handle);
  });

  it("diversity-capped after MAX_CITATIONS_PER_SOURCE admits of one source", () => {
    const cap = createSourceDiversityCap();
    expect(resolveAttribution(args({ admit: cap.admit })).reason).toBe("kept");
    expect(resolveAttribution(args({ admit: cap.admit })).reason).toBe("kept");
    expect(resolveAttribution(args({ admit: cap.admit })).reason).toBe("diversity-capped");
  });

  it("a lexical-mismatch does NOT consume a diversity slot (counter semantics preserved)", () => {
    const cap = createSourceDiversityCap();
    resolveAttribution(args({ line: LINE_FOREIGN, admit: cap.admit })); // stripped before admit
    expect(resolveAttribution(args({ admit: cap.admit })).reason).toBe("kept");
    expect(resolveAttribution(args({ admit: cap.admit })).reason).toBe("kept");
  });

  it("kept returns the example for instrumentation", () => {
    const d = resolveAttribution(args());
    expect(d.example?.teardownId).toBe(EX.teardownId);
  });
});
