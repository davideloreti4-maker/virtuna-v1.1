import { describe, it, expect } from "vitest";
import { formatCorpusForPrompt } from "../prompt";
import type { RetrievedExample } from "../types";

const ex = (over: Partial<RetrievedExample> = {}): RetrievedExample => ({
  teardownId: "td-1",
  handle: "srenestrawberry",
  videoUrl: "https://tiktok.com/@srenestrawberry/video/1",
  platform: "tiktok",
  multiplier: 9.2,
  views: 14_700_000,
  baselineLabel: "vs followers",
  fitLabel: "adjacent",
  hookArchetype: "contrarian",
  format: "problem-solution",
  spokenHook: "Stop buying protein bars.",
  template: { name: "Myth-swap", slots: [], skeleton: ["call the myth", "reveal the swap"], guidance: "" },
  idea: null,
  whyItWorks: "pattern interrupt on a common purchase",
  sourcePool: "scraped",
  trustWeight: 0.6,
  fromPersonal: false,
  ...over,
});

describe("formatCorpusForPrompt", () => {
  it("returns undefined for an empty list (→ corpus stays a no-op)", () => {
    expect(formatCorpusForPrompt([])).toBeUndefined();
  });

  it("renders header + numbered examples with archetype, structure, receipt, why", () => {
    const out = formatCorpusForPrompt([ex()])!;
    expect(out).toContain("ADAPT each proven STRUCTURE");
    expect(out).toContain("do NOT reuse the source's specific words");
    expect(out).toContain("1. [contrarian]");
    expect(out).toContain("call the myth → reveal the swap"); // skeleton join
    expect(out).toContain("@srenestrawberry");
    expect(out).toContain("9.2× vs followers");
    expect(out).toContain("14.7M views");
    expect(out).toContain("Why: pattern interrupt on a common purchase");
  });

  it("numbers multiple examples in order", () => {
    const out = formatCorpusForPrompt([ex({ handle: "a" }), ex({ handle: "b" })])!;
    expect(out).toContain("1. ");
    expect(out).toContain("2. ");
    expect(out.indexOf("@a")).toBeLessThan(out.indexOf("@b"));
  });

  it("degrades honestly when receipt fields are missing", () => {
    const out = formatCorpusForPrompt([
      ex({ handle: null, multiplier: null, views: null, whyItWorks: null, template: null, hookArchetype: null }),
    ])!;
    expect(out).toContain("Stop buying protein bars."); // falls back to spokenHook for structure
    expect(out).toContain("? views"); // honest unknown, never fabricated
    expect(out).not.toContain("Why:"); // omitted when absent
    expect(out).not.toContain("["); // no archetype tag
  });

  it("rounds a huge multiplier to an integer (178×, not 178.3×)", () => {
    const out = formatCorpusForPrompt([ex({ multiplier: 178.34 })])!;
    expect(out).toContain("178×");
  });
});
