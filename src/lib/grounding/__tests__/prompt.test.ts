import { describe, it, expect } from "vitest";
import { buildCorpusBlock, CORPUS_CHAR_BUDGET } from "../prompt";
import type { RetrievedExample } from "../types";

const ex = (over: Partial<RetrievedExample> = {}): RetrievedExample => ({
  teardownId: "td-1",
  handle: "srenestrawberry",
  videoUrl: "https://tiktok.com/@srenestrawberry/video/1",
  coverUrl: null,
  platform: "tiktok",
  multiplier: 9.2,
  views: 14_700_000,
  baselineLabel: "vs followers",
  fitLabel: "adjacent",
  hookArchetype: "contrarian",
  format: "problem-solution",
  spokenHook: "Stop buying protein bars.",
  hookTemplate: "Stop buying [product category].",
  template: {
    name: "Myth-swap",
    slots: [],
    skeleton: ["call the myth", "reveal the swap"],
    guidance: "Use when the audience is spending money on a habit they never examined.",
    beats: [
      { name: "Call the myth", description: "Name the belief out loud.", startSec: 0, endSec: 3 },
      { name: "Reveal the swap", description: "Show the cheaper substitute.", startSec: 3, endSec: 12 },
    ],
    flavor: "supermarket myth-buster",
  },
  idea: {
    seed: "Protein bars are candy with a health label",
    angle: "Price out the macros side by side",
    belief: "Protein bars are a healthy convenient snack.",
    reality: "Most are confectionery with a protein dusting, at 4× the cost per gram.",
    evidence: "22g sugar in the best-seller · £2.40 vs £0.60 for the same macros",
    topic: "Protein bar economics",
  },
  whyItWorks: "pattern interrupt on a common purchase",
  sourcePool: "curated",
  trustWeight: 1.5,
  fromPersonal: false,
  ...over,
});

describe("buildCorpusBlock — the receipt rides on every slice", () => {
  it("returns undefined for an empty list (→ corpus stays a byte-identical no-op)", () => {
    expect(buildCorpusBlock([], "hooks").corpus).toBeUndefined();
  });

  it.each(["hooks", "ideas", "script"] as const)("%s carries the proof receipt", (skill) => {
    const out = buildCorpusBlock([ex()], skill).corpus!;
    expect(out).toContain("@srenestrawberry");
    expect(out).toContain("9.2× vs followers");
    expect(out).toContain("14.7M views");
  });

  it("numbers examples 1..N in array order (sourceIndex is resolved positionally)", () => {
    const { corpus, used } = buildCorpusBlock([ex({ handle: "a" }), ex({ handle: "b" })], "hooks");
    expect(corpus).toContain("1. ");
    expect(corpus).toContain("2. ");
    expect(corpus!.indexOf("@a")).toBeLessThan(corpus!.indexOf("@b"));
    expect(used).toHaveLength(2);
  });
});

describe("the receipt never asserts what it cannot show", () => {
  /** The example lines only — the header legitimately explains BOTH warrants by name. */
  const body = (multiplier: number | null): string => {
    const out = buildCorpusBlock([ex({ multiplier })], "hooks").corpus!;
    return out.split("\n\n").slice(1).join("\n\n");
  };

  it('calls a real outlier "proven by" and shows the number', () => {
    expect(body(9.2)).toContain("proven by @srenestrawberry · 9.2× vs followers · 14.7M views");
  });

  it('calls an UNSCORED row a "curated exemplar", never proven', () => {
    // Half the curated TikTok library has no score. A human picked it — that is a real warrant,
    // and it is why the row is admitted. It is NOT an outlier claim.
    expect(body(null)).toContain("curated exemplar — @srenestrawberry · 14.7M views");
    expect(body(null)).not.toContain("proven by");
  });

  it("NEVER prints a sub-1× multiplier — the video underperformed; the number refutes the line", () => {
    // 20 curated rows scored below 1×: fewer views than the account has followers.
    // "proven by @x · 0.5× vs followers" contradicts itself inside its own sentence.
    expect(body(0.5)).not.toContain("0.5×");
    expect(body(0.5)).not.toContain("proven by");
    expect(body(0.5)).toContain("curated exemplar");
    expect(body(0.5)).toContain("14.7M views"); // the honest part of the receipt still stands
  });

  it("states a real-but-modest result (1×–3×) without calling it proven", () => {
    expect(body(1.7)).toContain("curated exemplar — @srenestrawberry · 1.7× vs followers");
    expect(body(1.7)).not.toContain("proven by");
  });

  it("tells the MODEL the difference, not just the renderer", () => {
    // The model writes prose the creator reads. If the header claims everything is proven, it
    // will repeat that about a video that underperformed.
    const out = buildCorpusBlock([ex()], "hooks").corpus!;
    expect(out).toContain("NEVER call an exemplar proven");
  });

  it("omits the basis rather than inventing one when baselineLabel is absent", () => {
    const out = buildCorpusBlock([ex({ baselineLabel: null })], "hooks").corpus!;
    expect(out).toContain("9.2× · 14.7M views");
  });

  it("clips a bloated whyItWorks so one source cannot eat the whole block", () => {
    // Curated whyItWorks averages 578 chars. Unclipped, example 1 consumed the entire
    // 1500-char budget and examples 2-6 were never shown to the model at all.
    const windy = ex({ whyItWorks: "w".repeat(900) });
    const { used } = buildCorpusBlock([windy, ex({ handle: "second" })], "hooks");
    expect(used).toHaveLength(2); // the second proven outlier still makes it in
  });
});

describe("the hooks slice — the madlib is the deliverable", () => {
  it("leads with the MADLIB, which the old one-line block never showed the model", () => {
    const out = buildCorpusBlock([ex()], "hooks").corpus!;
    expect(out).toContain("MADLIB: Stop buying [product category].");
    expect(out).toContain("INSTANTIATE the madlib");
    expect(out).toContain('ran as: "Stop buying protein bars."');
    expect(out).toContain("works because: pattern interrupt");
  });

  it("says so honestly when no madlib was extracted, rather than passing a raw line off as one", () => {
    const out = buildCorpusBlock([ex({ hookTemplate: null })], "hooks").corpus!;
    expect(out).toContain("no madlib extracted");
    expect(out).toContain('"Stop buying protein bars."');
    expect(out).not.toContain("MADLIB:");
  });
});

describe("the ideas slice — belief ↔ reality", () => {
  it("renders the tension (zero readers existed for this field before 2026-07-14)", () => {
    const out = buildCorpusBlock([ex()], "ideas").corpus!;
    expect(out).toContain("audience believed: Protein bars are a healthy convenient snack.");
    expect(out).toContain("reality: Most are confectionery");
    expect(out).toContain("evidence:");
    expect(out).toContain("angle: Price out the macros");
    expect(out).toContain("Protein bar economics");
  });

  it("degrades to the why when the idea facet is absent", () => {
    const out = buildCorpusBlock([ex({ idea: null })], "ideas").corpus!;
    expect(out).toContain("works because: pattern interrupt");
    expect(out).not.toContain("audience believed:");
  });
});

describe("the script slice — timed named beats", () => {
  it("renders the real beats with their real timings", () => {
    const out = buildCorpusBlock([ex()], "script").corpus!;
    expect(out).toContain("Call the myth (0–3s) Name the belief out loud.");
    expect(out).toContain("Reveal the swap (3–12s)");
    expect(out).toContain("use when: Use when the audience is spending money");
    expect(out).toContain("supermarket myth-buster");
  });

  it("falls back to the UNTIMED skeleton when the source never saw the video clock", () => {
    const out = buildCorpusBlock(
      [ex({ template: { name: "Myth-swap", slots: [], skeleton: ["call the myth", "reveal the swap"], guidance: "" } })],
      "script",
    ).corpus!;
    expect(out).toContain("beats (untimed): call the myth → reveal the swap");
  });
});

describe("the budget — grounding must never evict the creator's own profile", () => {
  it("trims from the TAIL to stay inside CORPUS_CHAR_BUDGET", () => {
    // 20 rich examples would blow past the assembler's 4000-char bundle cap, which drops
    // PROFILE ROLES (voice, wins, flops) before it touches the corpus — i.e. someone else's
    // proven video would starve out the creator the output is supposed to fit.
    const many = Array.from({ length: 20 }, (_, i) => ex({ handle: `creator${i}` }));
    const { corpus, used } = buildCorpusBlock(many, "script");

    expect(corpus!.length).toBeLessThanOrEqual(CORPUS_CHAR_BUDGET);
    expect(used.length).toBeLessThan(many.length);
    expect(used.length).toBeGreaterThan(0);
  });

  it("keeps `used` in lockstep with what was rendered, so sourceIndex can never drift", () => {
    const many = Array.from({ length: 20 }, (_, i) => ex({ handle: `creator${i}` }));
    const { corpus, used } = buildCorpusBlock(many, "script");

    // every rendered example is in `used`, and nothing in `used` went unrendered
    used.forEach((e, i) => {
      expect(corpus).toContain(`${i + 1}. `);
      expect(corpus).toContain(`@${e.handle}`);
    });
    const firstDropped = many[used.length]!;
    expect(corpus).not.toContain(`@${firstDropped.handle}`);
  });

  it("keeps ONE example even if it alone exceeds the budget (grounded beats ungrounded)", () => {
    const monster = ex({
      template: {
        name: "x".repeat(3000),
        slots: [],
        skeleton: [],
        guidance: "y".repeat(3000),
        beats: [],
      },
    });
    const { used } = buildCorpusBlock([monster], "script");
    expect(used).toHaveLength(1);
  });
});
