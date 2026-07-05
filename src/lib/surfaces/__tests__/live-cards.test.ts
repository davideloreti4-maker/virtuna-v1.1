import { describe, it, expect } from "vitest";
import { personasToCardFace } from "../live-cards";
import type { ReactionPersona } from "@/lib/tools/blocks";

/** Build N personas: `stops` stop-verdicts then the rest scroll, each with a distinct quote. */
function personas(stops: number, total: number): ReactionPersona[] {
  return Array.from({ length: total }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: i < stops ? `stop quote ${i}` : `scroll quote ${i}`,
  }));
}

describe("personasToCardFace", () => {
  it("all stop → 10/10, loved, leads with a stopper's real quote", () => {
    const face = personasToCardFace(personas(10, 10));
    expect(face.stop).toBe(10);
    expect(face.tone).toBe("loved");
    expect(face.fraction).toBe("10/10 stop");
    expect(face.lead).toBe("stop quote 0");
  });

  it("all scroll → 0/10, bounced, leads with a scroller's real quote (verdict agrees with tone)", () => {
    const face = personasToCardFace(personas(0, 10));
    expect(face.stop).toBe(0);
    expect(face.tone).toBe("bounced");
    expect(face.fraction).toBe("0/10 stop");
    expect(face.lead).toBe("scroll quote 0");
  });

  it("6/10 → stop 6, loved (the ≥6 band)", () => {
    const face = personasToCardFace(personas(6, 10));
    expect(face.stop).toBe(6);
    expect(face.tone).toBe("loved");
  });

  it("5/10 → stop 5, neutral (between the bands)", () => {
    const face = personasToCardFace(personas(5, 10));
    expect(face.stop).toBe(5);
    expect(face.tone).toBe("neutral");
    // neutral is not 'bounced' → prefers a stopper's quote
    expect(face.lead).toBe("stop quote 0");
  });

  it("4/10 → stop 4, bounced (the ≤4 band)", () => {
    const face = personasToCardFace(personas(4, 10));
    expect(face.stop).toBe(4);
    expect(face.tone).toBe("bounced");
    // bounced → leads with a scroller's words
    expect(face.lead).toBe("scroll quote 4");
  });

  it("normalizes to /10 when the cohort isn't 10 (3 of 6 stop → 5/10, neutral)", () => {
    const face = personasToCardFace(personas(3, 6));
    expect(face.stop).toBe(5);
    expect(face.tone).toBe("neutral");
    expect(face.fraction).toBe("3/6 stop");
  });

  it("empty cohort → 0/10, bounced, empty lead, '0/0 stop' (total, never throws)", () => {
    const face = personasToCardFace([]);
    expect(face.stop).toBe(0);
    expect(face.tone).toBe("bounced");
    expect(face.lead).toBe("");
    expect(face.fraction).toBe("0/0 stop");
  });

  it("never fabricates a lead — all quotes blank → '' (honesty spine)", () => {
    const blank: ReactionPersona[] = [
      { archetype: "a", verdict: "stop", quote: "   " },
      { archetype: "b", verdict: "scroll", quote: "" },
    ];
    expect(personasToCardFace(blank).lead).toBe("");
  });

  it("falls back to any real quote when none agrees with the tone", () => {
    // tone will be 'loved' (2/2 stop) but only the (later) personas carry words → still real, never blank
    const mixed: ReactionPersona[] = [
      { archetype: "a", verdict: "stop", quote: "" },
      { archetype: "b", verdict: "stop", quote: "the one with words" },
    ];
    expect(personasToCardFace(mixed).lead).toBe("the one with words");
  });
});
