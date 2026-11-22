import { describe, expect, it } from "vitest";
import { ideaLineOf } from "@/lib/thread-next/idea-line";

describe("ideaLineOf", () => {
  it("the first sentence of the take (the drawing's P12 line)", () => {
    expect(
      ideaLineOf({
        take: "Aesthetic routines are performative, not functional. They signal effort without delivering results.",
        angle: "For the loyalist, who trusts the creator's curation, this idea attacks the very genre they consume.",
      }),
    ).toBe("Aesthetic routines are performative, not functional.");
  });

  it("a take of one sentence stays whole, with or without a full stop", () => {
    expect(ideaLineOf({ take: "Protein-per-dollar beats 'clean' every time", angle: "x" })).toBe("Protein-per-dollar beats 'clean' every time");
    expect(ideaLineOf({ take: "Fix the biology, not the habit.", angle: "x" })).toBe("Fix the biology, not the habit.");
  });

  it("does not end a sentence inside an abbreviation or a number", () => {
    expect(ideaLineOf({ take: "Use a 'boot sequence' metaphor, e.g. a startup screen. Then cut.", angle: "" })).toBe(
      "Use a 'boot sequence' metaphor, e.g. a startup screen.",
    );
    expect(ideaLineOf({ take: "Wake at 5.30 and lose. Sleep wins.", angle: "" })).toBe("Wake at 5.30 and lose.");
  });

  it("does not end a sentence after a title, 'vs.', a list number, a single letter or 'U.S.'", () => {
    const cases: [string, string][] = [
      ["Dr. Huberman's light rule beats coffee. Then cut.", "Dr. Huberman's light rule beats coffee."],
      ["Meal prep vs. Takeout is the wrong fight. Here is why.", "Meal prep vs. Takeout is the wrong fight."],
      ["1. Open on the problem. Then show the fix.", "1. Open on the problem."],
      ["Step 2. Cut the intro. Then post.", "Step 2. Cut the intro."],
      ["No. 1 mistake: skipping breakfast. Fix it.", "No. 1 mistake: skipping breakfast."],
      ["Rent in the U.S. Feels impossible now. Here is why.", "Rent in the U.S. Feels impossible now."],
      ["Plan A. Works for most people. Plan B does not.", "Plan A. Works for most people."],
    ];
    for (const [take, line] of cases) expect(ideaLineOf({ take, angle: "" })).toBe(line);
  });

  it("a closing quote after the full stop still ends the sentence", () => {
    expect(ideaLineOf({ take: "They said “Stop.” Then I did it anyway.", angle: "" })).toBe("They said “Stop.”");
    expect(ideaLineOf({ take: "Call it a 'boot sequence.' Then explain.", angle: "" })).toBe("Call it a 'boot sequence.'");
  });

  it("ends at ? and !", () => {
    expect(ideaLineOf({ take: "Why does nobody test hooks? Because it was slow.", angle: "" })).toBe("Why does nobody test hooks?");
    expect(ideaLineOf({ take: "Stop journaling! Do this instead.", angle: "" })).toBe("Stop journaling!");
  });

  it("falls back to the angle's first sentence, then to nothing", () => {
    expect(ideaLineOf({ take: "  ", angle: "Rank cheap breakfasts by protein. Not by vibes." })).toBe("Rank cheap breakfasts by protein.");
    expect(ideaLineOf({ take: "", angle: "" })).toBeNull();
  });
});
