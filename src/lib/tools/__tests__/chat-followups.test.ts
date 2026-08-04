/**
 * chat-followups — the context-aware chip registry (redesign of the retired chain-handoff CTAs).
 *
 * Locks the two properties the old system got wrong:
 *  1. The chips depend on WHAT RAN (a script turn never offers "turn this into hooks").
 *  2. A chip never duplicates the per-card forward CTA (idea→hooks, hook→script live on the cards).
 */
import { describe, it, expect } from "vitest";
import {
  classifyTurn,
  followupsForTurn,
  followupsForKind,
  blockTypesOf,
  type ChatTurnKind,
} from "../chat-followups";
import { SKILL_TOOLS } from "../skill-dispatch";

describe("classifyTurn — furthest-along card wins", () => {
  const cases: Array<[string[], ChatTurnKind]> = [
    [["idea-card"], "ideas"],
    [["hook-card"], "hooks"],
    [["script-card"], "script"],
    [["remix-card"], "remix"],
    [["markdown"], "chat"],
    [[], "chat"],
    // A mixed turn resolves to the furthest-along card the creator is looking at.
    [["idea-card", "hook-card", "script-card"], "script"],
    [["markdown", "idea-card"], "ideas"],
    // The analysis reads — each a distinct terminal output — and they WIN over a co-rendered card.
    [["video-test-card"], "test"],
    [["account-read"], "account"],
    [["outlier-grid"], "explore"],
    [["reaction-distribution"], "predict"],
    [["prediction-gauge"], "predict"],
    [["profile-read"], "profile"],
    [["video-test-card", "script-card"], "test"],
  ];
  it.each(cases)("%j → %s", (types, expected) => {
    expect(classifyTurn(types)).toBe(expected);
  });
});

describe("every skill kind has curated, non-empty, non-duplicating follow-ups", () => {
  const kinds: ChatTurnKind[] = [
    "chat", "ideas", "hooks", "script", "remix", "explore", "account", "test", "predict", "profile",
  ];
  // The single forward CTA each card already owns — a chip must never repeat it.
  const cardCta: Partial<Record<ChatTurnKind, string>> = {
    ideas: "write hooks for this",
    hooks: "write the script",
    script: "test this script",
    remix: "write hooks for this",
    account: "write to my strengths",
    test: "simulate with your audience",
    predict: "predict an outcome",
    profile: "test this message",
  };
  it.each(kinds)("%s → 2–3 chips, each labelled + prompted, none repeating the card CTA", (kind) => {
    const chips = followupsForKind(kind);
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips.length).toBeLessThanOrEqual(3);
    const cta = cardCta[kind];
    for (const c of chips) {
      expect(c.label.trim().length).toBeGreaterThan(0);
      expect(c.prompt.trim().length).toBeGreaterThan(0);
      if (cta) expect(c.label.toLowerCase()).not.toBe(cta);
    }
  });

  it("a Test turn offers CRAFT next-moves, not the generic chat set", () => {
    const labels = followupsForTurn(["video-test-card"]).map((c) => c.label.toLowerCase());
    expect(labels).not.toContain("give me ideas"); // the generic-fallthrough bug we fixed
    expect(labels.some((l) => l.includes("hook") || l.includes("pacing") || l.includes("cut"))).toBe(true);
  });
});

describe("followupsForTurn — never empty, always tappable", () => {
  // Wrapped as single-element tuples so it.each passes each block-type array as ONE arg (not spread).
  const kinds: Array<[string[]]> = [[["idea-card"]], [["hook-card"]], [["script-card"]], [["remix-card"]], [["markdown"]]];
  it.each(kinds)("%j yields 2–3 chips, each with a label and a prompt", (types) => {
    const chips = followupsForTurn(types);
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips.length).toBeLessThanOrEqual(3);
    for (const c of chips) {
      expect(c.label.trim().length).toBeGreaterThan(0);
      expect(c.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("a plain chat answer offers the generative entry points", () => {
    const labels = followupsForTurn(["markdown"]).map((c) => c.label.toLowerCase());
    expect(labels.some((l) => l.includes("idea"))).toBe(true);
    expect(labels.some((l) => l.includes("hook"))).toBe(true);
    expect(labels.some((l) => l.includes("script"))).toBe(true);
  });

  it("does NOT duplicate the per-card forward CTA", () => {
    // Idea cards own "Develop into hooks →"; the thread chips must not repeat a bare hooks step.
    const ideaLabels = followupsForTurn(["idea-card"]).map((c) => c.label.toLowerCase());
    expect(ideaLabels).not.toContain("develop into hooks");
    // Hook cards own "Write script →"; the thread's hooks chips push "more" + a compare, not a repeat.
    const hookLabels = followupsForTurn(["hook-card"]).map((c) => c.label.toLowerCase());
    expect(hookLabels).not.toContain("write script");
  });

  it("a script turn never suggests turning it into hooks (the old hardcoded bug)", () => {
    const prompts = followupsForTurn(["script-card"]).map((c) => c.prompt.toLowerCase());
    // "Hooks for this" is fine (deriving hooks FROM the script); "turn this into hooks" is the retired
    // idea-shaped CTA that must never appear after a script.
    expect(prompts.some((p) => p.includes("turn this into hooks"))).toBe(false);
  });
});

// ── The declared skill: a chip that promises an artefact must be able to reach a tool ────────────
//
// REGRESSION (measured 2026-08-04). "More hooks" and "Punch them up" dispatched 0/3: their sentences
// carry no subject read alone, so the agent classed them "too vague" and pushed back instead of
// running. The chip now declares WHICH generator it means and the loop pins tool_choice to it.
// These guards hold the two halves that can silently rot — the names must stay in the registry's
// namespace, and the conversational chips must stay unpinned.
describe("ChatFollowup.skill — the declared generator", () => {
  const ALL_KINDS: ChatTurnKind[] = [
    "chat", "ideas", "hooks", "script", "remix", "explore", "account", "test", "predict", "profile",
    "read",
  ];
  const everyChip = ALL_KINDS.flatMap((k) => followupsForKind(k));

  it("names only skills the agent loop actually BINDS", () => {
    // The chip speaks the DISPLAY namespace (ChatTurnKind — "ideas", plural), and the loop resolves
    // it against SkillTool.skillKey. A chip naming 'explore' or the singular 'idea' would resolve to
    // nothing and silently fall back to the unpinned turn that is the bug — so it is banned here
    // rather than discovered live. (The two namespaces differ in exactly one id; that is how F-017
    // shipped, and no cast between them can fail at compile time.)
    const bound = new Set(SKILL_TOOLS.map((s) => s.skillKey));
    // A deliberate snapshot of the registry, so growing it is a decision someone writes down.
    // `read` joined the three generators on 2026-08-04: the first non-generator bound to the loop,
    // and the only one of its neighbours that touches no Apify path (verified, not assumed).
    expect(bound).toEqual(new Set(["ideas", "hooks", "script", "read"]));
    for (const chip of everyChip) {
      if (chip.skill) expect(bound.has(chip.skill)).toBe(true);
    }
  });

  it("every chip that PROMISES an artefact declares the skill that makes it", () => {
    // The four the measurement caught, by label. A chip that says "rewrite"/"more" and reaches no
    // tool degrades to prose — which for a paid generator is the product delivered free.
    const byLabel = new Map(everyChip.map((c) => [c.label, c.skill]));
    expect(byLabel.get("More hooks")).toBe("hooks");
    expect(byLabel.get("Punch them up")).toBe("hooks");
    expect(byLabel.get("Make it punchier")).toBe("script");
    expect(byLabel.get("Different angle")).toBe("script");
    expect(byLabel.get("More ideas")).toBe("ideas");
    expect(byLabel.get("Script the best one")).toBe("script");
  });

  it("leaves every CONVERSATIONAL chip unpinned — the control the fix must not move", () => {
    // These ask for judgement, a diagnosis, or a skill the loop does not bind. Pinning one would turn
    // a question into a paid run, and would make this change a blanket "dispatch more" rather than a
    // targeting fix. They must stay exactly as they shipped.
    const byLabel = new Map(everyChip.map((c) => [c.label, c.skill]));
    for (const label of [
      "Which is strongest?", // judgement — the agent answers in prose
      "Where am I weakest?",
      "Fix the pacing",
      "Why this result?",
      "Improve the odds",
      "Predict another",
      "What do they want?",
      "Draft a message",
      "Test another",
      "More like this", // explore — no bound tool
      "Find more",
      "Remix the best one",
      // A Read turn's own chips. "Read another" is unpinned DELIBERATELY even though `read` is now
      // bound: a pin forces the tool on round 1, and a Read cannot run without the text to read —
      // so a subject-less pin would spend the turn tripping the loop's "no draft" guard. Unpinned,
      // the agent surfaces the read FIELD, which is the door that collects it.
      "Read another",
      "Why that reaction?",
    ]) {
      expect(byLabel.has(label)).toBe(true); // the label still exists (catches a silent rename)
      expect(byLabel.get(label)).toBeUndefined();
    }
  });
});

describe("blockTypesOf — defensive extraction", () => {
  it("pulls string `type` off each block, dropping junk", () => {
    const out = blockTypesOf([
      { type: "idea-card", props: {} },
      { type: "markdown", props: {} },
      null,
      42,
      { props: {} }, // no type
      { type: 7 }, // non-string type
    ]);
    expect(out).toEqual(["idea-card", "markdown"]);
  });
});
