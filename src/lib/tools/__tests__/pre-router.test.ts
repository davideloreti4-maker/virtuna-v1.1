/**
 * pre-router.test.ts — the cheap guess that labels the router's dead zone (Stage B, B3).
 *
 * What is actually at stake here is HONESTY, not accuracy. The guess is streamed before the agent
 * has committed to anything, and the creator reads it as the app saying what it is about to do. So
 * the two rules that matter are: a question must never be guessed as a run (the app would announce
 * work that never starts), and when a run IS named it must be the artefact the creator asked for
 * (naming the wrong one is worse than the bare "Thinking…" it replaced — it looks like the router
 * misheard). Every case below is one of those two rules; the null cases are not "misses".
 */

import { describe, it, expect } from "vitest";
import { guessSkill } from "@/lib/tools/pre-router";

describe("guessSkill — a run is named only when one was asked for", () => {
  it.each([
    ["write me 5 hooks about meal prep", "hooks"],
    ["give me some ideas for next week", "ideas"],
    ["turn that into a script", "script"],
    ["I need an outline for a 60s video", "script"],
    ["gimme punchier openers", "hooks"],
    ["draft a few angles on the pricing thing", "ideas"],
    ["rewrite the hook", "hooks"],
    ["make a concept for a series", "ideas"],
  ] as const)("%s → %s", (ask, expected) => {
    expect(guessSkill(ask)).toBe(expected);
  });

  it("is case-insensitive — creators type in whatever case they type in", () => {
    expect(guessSkill("WRITE ME HOOKS ABOUT SLEEP")).toBe("hooks");
  });
});

describe("guessSkill — a question is not a run", () => {
  // THE RULE THAT COSTS MOST TO BREAK. Each of these names an artefact, which is exactly why a
  // noun-only heuristic would guess a run on all of them and the thread would promise work that
  // never starts. The generation verb is what separates "make me one" from "tell me about mine".
  it.each([
    "how do my hooks compare to the ones that went viral?",
    "which of these ideas is strongest?",
    "what makes a script work on tiktok?",
    "why did that hook flop?",
    "is my opener too long?",
    // Carries BOTH a generation verb and an artefact noun, and is still a strategy question —
    // the case the verb rule alone cannot see, and the reason the opener is checked first.
    "what should I write, hooks or a script?",
  ])("%s → no guess", (ask) => {
    expect(guessSkill(ask)).toBeNull();
  });

  it("still guesses on a POLITE request — 'can you' is not an interrogative opener", () => {
    // The question guard must not swallow the most common phrasing there is.
    expect(guessSkill("can you write me a few hooks about sleep")).toBe("hooks");
    expect(guessSkill("could you draft a script for this")).toBe("script");
  });

  it("stays silent on a generation verb with no artefact — the honest default", () => {
    // "Write" alone does not say what. A guess here would be a coin flip dressed as a plan.
    expect(guessSkill("can you write something for me")).toBeNull();
    expect(guessSkill("make it better")).toBeNull();
  });

  it("stays silent on plain conversation", () => {
    expect(guessSkill("hey, how's it going")).toBeNull();
    expect(guessSkill("")).toBeNull();
  });
});

describe("guessSkill — the FIRST artefact named is the one being asked for", () => {
  it("'write hooks for this script' is a HOOKS ask that happens to mention a script", () => {
    // Position, not precedence: the artefact right after the verb is what the creator wants made;
    // the later noun is context. Ranking by a fixed skill order instead would label this a script
    // run — the exact thing the creator did NOT ask for, since the script already exists.
    expect(guessSkill("write hooks for this script")).toBe("hooks");
  });

  it("'turn the best idea into a script' is a SCRIPT ask — 'into' names the destination", () => {
    // The exception to position, and it is not a corner case: the product's own follow-up chip
    // says "Turn the strongest idea into a full script." Position alone reads this as an ideas
    // run, which is the one artefact the creator did NOT ask for — the idea already exists.
    expect(guessSkill("turn the best idea into a script")).toBe("script");
    expect(guessSkill("turn these hooks into an outline")).toBe("script");
    expect(guessSkill("make that script into a few hooks")).toBe("hooks");
  });

  it("'make a script from these hooks' → script", () => {
    expect(guessSkill("make a script from these hooks")).toBe("script");
  });
});

describe("guessSkill — an ask that OPENS with the artefact needs no verb", () => {
  // Measured against the app's own message history: creators routinely name the thing and the
  // count and skip the verb. This shape was 6 of the 10 asks the verb rule alone missed over 82
  // real messages.
  it.each([
    ["3 hooks for gym myths", "hooks"],
    ["ideas for a video about why most side projects die before launch", "ideas"],
    ["hooks for my audience that have high viral potential", "hooks"],
    ["/hooks for my creator tool startup app", "hooks"],
    ["3 ideas for documenting my startup journey", "ideas"],
    ["a few hooks for my budgeting app", "hooks"],
    ["script for a tiktok about saving money at uni", "script"],
  ] as const)("%s → %s", (ask, expected) => {
    expect(guessSkill(ask)).toBe(expected);
  });

  it("only fires at the START — the same noun mid-sentence is discussion", () => {
    // This is what makes the rule safe without a verb: "what are these hooks grounded on?" names
    // the artefact too, and must stay quiet.
    expect(guessSkill("what are these hooks grounded on?")).toBeNull();
    expect(guessSkill("one quick hook tip")).toBeNull();
  });
});

describe("guessSkill — word boundaries, so a substring cannot mint a run", () => {
  it("does not fire on words that merely contain an artefact noun", () => {
    // "hooked", "idealistic", "scripture" are not asks for hooks, ideas or scripts.
    expect(guessSkill("write about how I got hooked on running")).toBeNull();
    expect(guessSkill("make my writing less idealistic")).toBeNull();
  });

  it("matches the plural and the singular alike", () => {
    expect(guessSkill("write a hook")).toBe("hooks");
    expect(guessSkill("write some hooks")).toBe("hooks");
  });
});
