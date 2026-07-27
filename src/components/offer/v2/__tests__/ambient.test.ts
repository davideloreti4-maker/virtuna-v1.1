import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ambientLoop, ambientNode, CONSTELLATION_NODES } from "../ambient";

/**
 * The two laws of the /go-v2 motion system, pinned.
 *
 * Both are the kind of rule that is trivially true the day it is written and quietly false six
 * commits later, because both are violated by ADDING something rather than by changing
 * something — a new keyframe class that nobody adds to the reduce block, or a new loop that
 * happens to pick a period another loop already uses.
 *
 *   1. DESYNCHRONISATION. Attio runs the same animation at 3.8s AND 4.15s so its loops never
 *      phase-lock. A page whose loops pulse in unison reads cheap, which is the exact defect
 *      this rebuild exists to fix — so no two ambient periods may be equal.
 *   2. REDUCED MOTION. Every ambient class must appear in the collective reduce block. That is
 *      what makes the acceptance criterion ("≈0 animations under prefers-reduced-motion")
 *      structural rather than a thing someone has to remember.
 */

const CSS = readFileSync(resolve(__dirname, "../../../../app/(offer)/marketing.css"), "utf8");

/** Everything after the `prefers-reduced-motion: reduce` at-rule. */
const REDUCE_BLOCK = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));

/** `.mk-foo { … animation: name 1.23s … }` → the class names that declare an animation. */
function animatedClasses(css: string): { name: string; duration: number }[] {
  const out: { name: string; duration: number }[] = [];
  // Rule bodies, simple-selector only — every ambient utility in this file is a single class.
  const RULE = /\.(mk-[a-z0-9-]+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = RULE.exec(css))) {
    const [, name, body] = m;
    const decl = /animation:\s*([^;]+);/.exec(body!);
    if (!decl || decl[1]!.trim() === "none") continue;
    const dur = /(\d+(?:\.\d+)?)s/.exec(decl[1]!);
    out.push({ name: name!, duration: dur ? parseFloat(dur[1]!) : NaN });
  }
  return out;
}

// Parse only the part BEFORE the reduce block, or every class would appear twice (once with a
// real animation, once with `animation: none`).
const DECLARED = animatedClasses(CSS.slice(0, CSS.indexOf("@media (prefers-reduced-motion: reduce)")));

describe("marketing.css — the reduced-motion guarantee", () => {
  it("declares at least the loops the page is built from", () => {
    // A sanity floor: if the parse silently stops matching, every other assertion here becomes
    // vacuously true.
    expect(DECLARED.length).toBeGreaterThanOrEqual(15);
  });

  it("lists EVERY animated class in the reduce block", () => {
    const missing = DECLARED.map((c) => c.name).filter(
      (name) => !new RegExp(`\\.${name}\\b`).test(REDUCE_BLOCK),
    );
    expect(
      missing,
      "add these to the @media (prefers-reduced-motion: reduce) block in marketing.css",
    ).toEqual([]);
  });

  it("kills the animation rather than merely slowing it", () => {
    // `animation-duration: 0.01ms` would still report a non-`none` animationName to the probe,
    // and would still be motion. The block must actually clear it.
    expect(REDUCE_BLOCK).toMatch(/animation:\s*none/);
    expect(REDUCE_BLOCK).not.toMatch(/animation-duration/);
  });
});

describe("marketing.css — no two loops share a period", () => {
  it("gives every base keyframe utility its own duration", () => {
    // `mk-orbit-slow/mid/fast` intentionally share a KEYFRAME (`mk-orbit`) but must not share a
    // period — that trio is the most likely place for a copy-paste to introduce a lockstep.
    const byDuration = new Map<number, string[]>();
    for (const { name, duration } of DECLARED) {
      expect(Number.isNaN(duration), `${name} declares no duration`).toBe(false);
      byDuration.set(duration, [...(byDuration.get(duration) ?? []), name]);
    }
    const collisions = [...byDuration.entries()].filter(([, names]) => names.length > 1);
    expect(collisions, "these classes would phase-lock").toEqual([]);
  });

  it("uses non-round durations, which is what keeps them mutually prime-ish", () => {
    // Whole-second periods are the ones that align: 2s, 4s and 8s share a beat every 8s.
    const round = DECLARED.filter((c) => Number.isInteger(c.duration));
    expect(round.map((c) => `${c.name} ${c.duration}s`)).toEqual([]);
  });
});

describe("section seams — the loop that repeats ACROSS sections", () => {
  // The one place the desync rule is easy to break, because every other repeated loop is
  // indexed within a single component and this one spans eight files. The motion probe caught
  // exactly this: eight seams sharing 14.23s, a ripple rolling down the page in lockstep.
  const SECTIONS = resolve(__dirname, "../sections");

  it("gives every seam a distinct index", () => {
    const files = readdirSync(SECTIONS).filter((f) => f.endsWith(".tsx"));
    const used: { file: string; index: number }[] = [];
    for (const file of files) {
      const src = readFileSync(resolve(SECTIONS, file), "utf8");
      const m = /seamIndex=\{(\d+)\}/.exec(src);
      if (/<MarketingSection[^>]*\bseam\b/.test(src)) {
        expect(m, `${file} sets \`seam\` but no \`seamIndex\``).not.toBeNull();
        used.push({ file, index: Number(m![1]) });
      }
    }
    expect(used.length, "no seamed sections found — has the parse broken?").toBeGreaterThan(4);
    const dupes = used.filter((a, _, all) => all.filter((b) => b.index === a.index).length > 1);
    expect(dupes, "these sections would ripple in lockstep").toEqual([]);
  });
});

describe("ambientLoop — deterministic, and spread", () => {
  it("returns identical values for identical input (SSR must match the client)", () => {
    // `Math.random()` here would be a hydration mismatch on the one page we pay for traffic to.
    for (const i of [0, 1, 7, 33]) {
      expect(ambientLoop(i)).toEqual(ambientLoop(i));
      expect(ambientNode(i)).toEqual(ambientNode(i));
    }
  });

  it("gives every constellation node a distinct period", () => {
    const periods = Array.from({ length: CONSTELLATION_NODES }, (_, i) =>
      ambientNode(i).animationDuration,
    );
    expect(new Set(periods).size).toBe(CONSTELLATION_NODES);
  });

  it("decorrelates period from starting PHASE", () => {
    // If period and phase came off the same sequence, the slowest node would always also be
    // the latest, and the field would visibly sweep rather than breathe.
    //
    // ⚠️ Measure phase as a FRACTION of each instance's own period, not in seconds. `delay` is
    // deliberately `−phase × duration`, so in absolute seconds a longer period MUST produce a
    // more negative delay — that coupling is the design (a node scattered across its own cycle,
    // not across some global clock), and correlating raw seconds just re-measures it. r ≈ 0.54
    // on raw seconds is the expected value, and asserting against it would pin the wrong thing.
    const n = 24;
    const durations = Array.from({ length: n }, (_, i) =>
      parseFloat(String(ambientLoop(i).animationDuration)),
    );
    const phases = Array.from({ length: n }, (_, i) => {
      const d = parseFloat(String(ambientLoop(i).animationDuration));
      return -parseFloat(String(ambientLoop(i).animationDelay)) / d;
    });
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const [md, mp] = [mean(durations), mean(phases)];
    const cov = mean(durations.map((d, i) => (d - md) * (phases[i]! - mp)));
    const sd = (xs: number[], m: number) => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
    const r = cov / (sd(durations, md) * sd(phases, mp));
    expect(Math.abs(r)).toBeLessThan(0.35);
  });

  it("scatters phase across the whole cycle, not just the first half", () => {
    // A sequence clustered near 0 would leave most loops starting together anyway.
    const phases = Array.from({ length: 34 }, (_, i) => {
      const d = parseFloat(String(ambientLoop(i).animationDuration));
      return -parseFloat(String(ambientLoop(i).animationDelay)) / d;
    });
    const quartiles = [0, 0, 0, 0];
    phases.forEach((p) => quartiles[Math.min(3, Math.floor(p * 4))]!++);
    // Every quarter of the cycle gets used — the whole point of a low-discrepancy sequence.
    expect(quartiles.every((q) => q > 0), `quartile occupancy ${quartiles}`).toBe(true);
  });

  it("starts loops mid-cycle, so a fresh page is desynchronised on frame one", () => {
    // A positive delay would mean every loop starts at 0% together and only diverges later.
    for (const i of [1, 5, 12, 29]) {
      expect(parseFloat(String(ambientLoop(i).animationDelay))).toBeLessThan(0);
    }
  });

  it("keeps every period inside the band it was asked for", () => {
    for (let i = 0; i < 40; i++) {
      const d = parseFloat(String(ambientLoop(i, { base: 3.7, spread: 4.6 }).animationDuration));
      expect(d).toBeGreaterThanOrEqual(3.7);
      expect(d).toBeLessThanOrEqual(8.3);
    }
  });
});
