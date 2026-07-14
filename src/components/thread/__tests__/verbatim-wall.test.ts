import { describe, it, expect } from "vitest";
import { collectQuotes } from "@/components/thread/verbatim-wall";
import type { MultiAudienceReadBlock } from "@/lib/tools/blocks";

type Audiences = MultiAudienceReadBlock["props"]["audiences"];

/**
 * The verbatim wall is the surface that has to LOOK real.
 *
 * Its whole job is to convince you these are reactions from distinct simulated people. Run two
 * audiences over one concept and the same archetype can land on the same line in both — the
 * wall then printed that line twice, verbatim, one row tagged "Bootstrapped Founders · The Busy
 * Pro" and an identical one tagged "General · The Busy Pro". A focus group that repeats itself
 * word-for-word doesn't read as agreement, it reads as fabricated — which destroys exactly the
 * credibility this surface exists to build.
 */

function audience(name: string, personas: Array<{ archetype: string; verdict: "stop" | "scroll"; quote: string }>) {
  return {
    name,
    band: "Strong" as const,
    fraction: "7/10 stop",
    interpretation: "x",
    lever: "x",
    whoNotFor: "",
    personas,
  };
}

describe("collectQuotes — the wall must not repeat itself", () => {
  it("merges an identical line from the same archetype across audiences into ONE row", () => {
    const audiences = [
      audience("Bootstrapped Founders", [
        { archetype: "the_busy_pro", verdict: "stop", quote: "Fast and to the point — I'll give it 10 seconds." },
      ]),
      audience("General", [
        { archetype: "the_busy_pro", verdict: "stop", quote: "Fast and to the point — I'll give it 10 seconds." },
      ]),
    ] as unknown as Audiences;

    const quotes = collectQuotes(audiences, "stop");

    expect(quotes).toHaveLength(1);
    // Merged, not dropped — that BOTH audiences produced it is a real finding, so both are named.
    expect(quotes[0]!.audienceNames).toEqual(["Bootstrapped Founders", "General"]);
  });

  it("keeps two DIFFERENT archetypes who happen to say the same thing — they are two people", () => {
    const audiences = [
      audience("General", [
        { archetype: "the_busy_pro", verdict: "stop", quote: "Tell me more." },
        { archetype: "the_newcomer", verdict: "stop", quote: "Tell me more." },
      ]),
    ] as unknown as Audiences;

    const quotes = collectQuotes(audiences, "stop");

    expect(quotes).toHaveLength(2);
    expect(quotes.map((q) => q.archetype).sort()).toEqual(["the_busy_pro", "the_newcomer"]);
  });

  it("merges case/whitespace variants of the same line, but displays the text as emitted", () => {
    const audiences = [
      audience("A", [{ archetype: "the_sharer", verdict: "stop", quote: "My group chat needs this." }]),
      audience("B", [{ archetype: "the_sharer", verdict: "stop", quote: "  my group chat needs this.  " }]),
    ] as unknown as Audiences;

    const quotes = collectQuotes(audiences, "stop");

    expect(quotes).toHaveLength(1);
    expect(quotes[0]!.audienceNames).toEqual(["A", "B"]);
    // The FIRST emitted spelling survives verbatim — normalization is for the key only.
    expect(quotes[0]!.quote).toBe("My group chat needs this.");
  });

  it("does not merge across verdicts — a stop and a scroll are different reactions", () => {
    const audiences = [
      audience("A", [
        { archetype: "the_skeptic", verdict: "stop", quote: "Hm." },
        { archetype: "the_skeptic", verdict: "scroll", quote: "Hm." },
      ]),
    ] as unknown as Audiences;

    expect(collectQuotes(audiences, "stop")).toHaveLength(1);
    expect(collectQuotes(audiences, "scroll")).toHaveLength(1);
  });

  it("still leads with the most substantive quote", () => {
    const audiences = [
      audience("A", [
        { archetype: "a", verdict: "stop", quote: "Short." },
        { archetype: "b", verdict: "stop", quote: "A considerably longer and more substantive reaction." },
      ]),
    ] as unknown as Audiences;

    expect(collectQuotes(audiences, "stop")[0]!.quote).toBe(
      "A considerably longer and more substantive reaction.",
    );
  });
});
