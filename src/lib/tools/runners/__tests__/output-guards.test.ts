/**
 * output-guards.test.ts — the cheap, checkable output validations Stage A added
 * (proposal §3.A, findings N-1/N-2/N-4/N-7 + the citation-integrity pair).
 *
 * Every "fails" fixture here is a REAL measured defect from the 2026-08-09 live-run
 * handoff — these are regression tests against observed engine output, not invented cases.
 */

import { describe, it, expect } from "vitest";
import {
  anchorHonored,
  plausibleSeedHook,
  templateInstantiated,
  requestedCount,
  trimExamplesToBundle,
} from "../output-guards";
import type { RetrievedExample } from "@/lib/grounding/types";

// ─── anchorHonored (N-7) ─────────────────────────────────────────────────────

const N7_ANCHOR =
  "Stop trying to wake up at 5 AM. It is literally destroying your dopamine receptors.";

describe("anchorHonored", () => {
  it("rejects the N-7 wrong-topic script opening (dance script from a morning-routine hook)", () => {
    const danceOpening =
      "You think this dance took me hours? Wrong. It took me three seconds to realize I was doing it completely wrong.";
    expect(anchorHonored(N7_ANCHOR, danceOpening)).toBe(false);
  });

  it("accepts an opening that adapts the anchor's subject", () => {
    const honest =
      "Your 5 AM alarm is quietly destroying your dopamine receptors — here's what to do instead.";
    expect(anchorHonored(N7_ANCHOR, honest)).toBe(true);
  });

  it("accepts a verbatim anchor as its own opening", () => {
    expect(anchorHonored(N7_ANCHOR, N7_ANCHOR)).toBe(true);
  });

  it("passes when the anchor is empty or trivial (nothing to check)", () => {
    expect(anchorHonored("", "anything")).toBe(true);
    expect(anchorHonored("Go!", "anything")).toBe(true);
  });

  it("passes when the opening is empty (a different guard's problem, not this one's)", () => {
    expect(anchorHonored(N7_ANCHOR, "")).toBe(true);
  });
});

// ─── plausibleSeedHook (N-2) ─────────────────────────────────────────────────

describe("plausibleSeedHook", () => {
  it("rejects the literal sourceIndex digits N-2 shipped ('0', '1', '3')", () => {
    expect(plausibleSeedHook("0")).toBe(false);
    expect(plausibleSeedHook("1")).toBe(false);
    expect(plausibleSeedHook("3")).toBe(false);
  });

  it("rejects empty / whitespace / letterless junk", () => {
    expect(plausibleSeedHook("")).toBe(false);
    expect(plausibleSeedHook("   ")).toBe(false);
    expect(plausibleSeedHook("12/10")).toBe(false);
    expect(plausibleSeedHook("!!!")).toBe(false);
  });

  it("accepts a real spoken seed line", () => {
    expect(plausibleSeedHook("Stop trying to wake up at 5 AM.")).toBe(true);
  });
});

// ─── templateInstantiated (N-1) ──────────────────────────────────────────────

describe("templateInstantiated", () => {
  it("rejects the N-1 pairs — cited template shares no skeleton with the line", () => {
    // Hook 2: cited madlib vs the shipped line — zero structural overlap.
    expect(
      templateInstantiated(
        "[Action] without a [System]? That's why you are [Negative Outcome].",
        "Your alarm didn't fail you. Your morning routine did.",
      ),
    ).toBe(false);
    // Hook 3: a Tutorial madlib decorating an unrelated conditional hook.
    expect(
      templateInstantiated(
        "Here's the #1 tip for [Goal] that [Audience] always ignore.",
        "If your morning routine looks like this, you're already losing.",
      ),
    ).toBe(false);
  });

  it("accepts a genuine instantiation (slots filled, skeleton kept)", () => {
    expect(
      templateInstantiated(
        "[Action] without a [System]? That's why you are [Negative Outcome].",
        "Scrolling without a wind-down system? That's why you are exhausted every morning.",
      ),
    ).toBe(true);
  });

  it("tolerates a template that is all slots (nothing checkable → not a false claim)", () => {
    expect(templateInstantiated("[X] [Y]", "anything at all")).toBe(true);
  });

  it("passes when there is no template (nothing cited)", () => {
    expect(templateInstantiated("", "line")).toBe(true);
    expect(templateInstantiated(null, "line")).toBe(true);
  });
});

// ─── requestedCount (N-4) ────────────────────────────────────────────────────

describe("requestedCount", () => {
  it("reads the count out of the N-4 ask", () => {
    expect(requestedCount("3 hooks for my new video were i didnt eat sugar for 30 days")).toBe(3);
  });

  it("reads 'give me 2 hooks' shapes", () => {
    expect(requestedCount("give me 2 hooks about meal prep")).toBe(2);
  });

  it("clamps an over-ask to the pipeline max (5)", () => {
    expect(requestedCount("10 hooks about coffee")).toBe(5);
  });

  it("ignores numbers that don't modify 'hooks' ('30 days')", () => {
    expect(requestedCount("hooks about not eating sugar for 30 days")).toBeNull();
  });

  it("ignores a zero-count ask", () => {
    expect(requestedCount("0 hooks please")).toBeNull();
  });

  it("returns null when no count was asked", () => {
    expect(requestedCount("hooks for my coffee video")).toBeNull();
  });
});

// ─── trimExamplesToBundle (citation integrity) ───────────────────────────────

function fakeExample(handle: string): RetrievedExample {
  return {
    handle,
    videoUrl: null,
    coverUrl: null,
    hookTemplate: null,
    spokenHook: null,
    hookArchetype: null,
    whyItWorks: null,
    multiplier: null,
    views: null,
    baselineLabel: null,
    fitLabel: "adjacent",
  } as unknown as RetrievedExample;
}

/** Build a corpus block the way prompt.ts does: header, then "\n\n"-joined numbered examples. */
const HEADER = "GROUNDING — real short-form hooks, torn down.";
const EX1 = `1. [Authority] MADLIB: The reason [X] works is [Y]\n   proven by @a · 1M views`;
const EX2 = `2. [Tutorial] MADLIB: Here's the #1 tip for [Goal]\n   proven by @b · 2M views`;
const EX3 = `3. [Contrarian] MADLIB: Stop doing [Common Action]\n   proven by @c · 3M views`;
const CORPUS = `${HEADER}\n\n${EX1}\n\n${EX2}\n\n${EX3}`;

function bundleWithCorpus(inner: string): string {
  return [
    "## Live Grounding Bundle\nMode: hooks | Platform: tiktok\n\n",
    "---",
    `Creator ask:\n<<<USER_CONTENT>>>\nmy ask\n<<<END_USER_CONTENT>>>\n\nGrounded examples:\n<<<USER_CONTENT>>>\n${inner}\n<<<END_USER_CONTENT>>>`,
  ].join("\n\n");
}

describe("trimExamplesToBundle", () => {
  const examples = [fakeExample("a"), fakeExample("b"), fakeExample("c")];

  it("keeps all examples when the corpus survived assembly intact", () => {
    expect(trimExamplesToBundle(bundleWithCorpus(CORPUS), CORPUS, examples)).toHaveLength(3);
  });

  it("drops examples whose rendering was cut by the assembler's final truncation", () => {
    // Truncated mid-example-3: example 3 is no longer fully shown to the model.
    const cut = CORPUS.slice(0, CORPUS.indexOf("3. [Contrarian]") + 20);
    const kept = trimExamplesToBundle(bundleWithCorpus(cut), CORPUS, examples);
    expect(kept.map((e) => e.handle)).toEqual(["a", "b"]);
  });

  it("drops everything when the whole corpus section was dropped from the bundle", () => {
    const noCorpus = "## Live Grounding Bundle\n\n---\n\nCreator ask:\n<<<USER_CONTENT>>>\nx\n<<<END_USER_CONTENT>>>";
    expect(trimExamplesToBundle(noCorpus, CORPUS, examples)).toHaveLength(0);
  });

  it("is a no-op with no corpus / no examples", () => {
    expect(trimExamplesToBundle("bundle", undefined, [])).toHaveLength(0);
    expect(trimExamplesToBundle("bundle", undefined, examples)).toHaveLength(3);
  });

  it("keeps a truncation-surviving example even when its own text was the last thing shown", () => {
    // Cut exactly at the end of example 2 (the "\n\n" join to example 3 is gone).
    const cut = CORPUS.slice(0, CORPUS.indexOf("\n\n3. "));
    const kept = trimExamplesToBundle(bundleWithCorpus(cut), CORPUS, examples);
    expect(kept.map((e) => e.handle)).toEqual(["a", "b"]);
  });

  it("parses the ADAPT BRIEF's numbering too — C0 flips the flag onto this format", () => {
    // adapt.ts renders "N. [dosage] fitted line" blocks joined by "\n\n" — the same
    // "\n\nN. " boundary this trim resolves. If the brief format ever changes shape,
    // this pins the contract: unresolvable numbering must DROP the tail, never keep it.
    const brief = [
      "GROUNDING — proven structures, ALREADY FITTED to your ask.",
      `1. [swap] Stop overpaying for your own time.\n   why it fits: pricing fits\n   proven by @a · 6.2× vs their usual views · 171K views`,
      `2. [angle] The 3 levels of freelance pricing.\n   why it fits: tiering maps\n   proven by @b · 5.1× vs their usual views · 92K views`,
    ].join("\n\n");
    const two = [fakeExample("a"), fakeExample("b")];

    // Intact brief → both survive.
    expect(trimExamplesToBundle(bundleWithCorpus(brief), brief, two)).toHaveLength(2);
    // Truncated mid-entry-2 → entry 2 drops, entry 1 survives.
    const cut = brief.slice(0, brief.indexOf("2. [angle]") + 12);
    const kept = trimExamplesToBundle(bundleWithCorpus(cut), brief, two);
    expect(kept.map((e) => e.handle)).toEqual(["a"]);
  });
});
