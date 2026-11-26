import { describe, expect, it } from "vitest";

import { filmNotesOf, filmPlanOf } from "@/lib/thread-next/film-notes";
import { remixBeatsOf, remixFilmOf } from "@/lib/thread-next/remix-film";
import { BLUEPRINT_ANSWER, REMIX_DECODED, REMIX_FILMED, remix, script } from "@/components/thread-next/__tests__/fixtures/answers";

const DECODE = REMIX_FILMED.props.sourceDecode!;
const PLAN = REMIX_FILMED.props.production!;

/** A read's answer with one original beat and one adapted beat for it (variant 0). */
const answerWith = (adapted: Record<string, unknown>, original: Record<string, unknown> = {}) => ({
  script: [[{ index: 0, spoken: "", on_screen_text: "", shot: "", ...adapted }]],
  blueprint: {
    from_fixed_buckets: false,
    beats: [{ index: 0, role: "hook", t_start: 0, t_end: 3, ...original }],
  },
});
const notesOf = (adapted: Record<string, unknown>) => remixBeatsOf(answerWith(adapted), 0)[0]?.notes ?? null;

describe("remixFilmOf: what is known before a read", () => {
  it("a decode and a plan: the why row (the pattern, the turn under it), the plan's rows, the blueprint and its variant", () => {
    expect(remixFilmOf(REMIX_FILMED.props)).toEqual({
      why: { text: DECODE.hookPattern, sub: DECODE.theTurn },
      plan: [
        { label: "Shots", text: PLAN.shots },
        { label: "Text on screen", text: PLAN.onScreenText },
        { label: "Setup", text: PLAN.setup },
        { label: "Edit", text: PLAN.edit },
      ],
      blueprintId: "bp-fixture-01",
      variant: 1,
    });
  });

  it("the plan's rows are the script's own (one builder, `filmPlanOf`)", () => {
    const scripted = filmNotesOf(script(undefined, { production: PLAN }).props)!;
    expect(remixFilmOf(REMIX_FILMED.props)!.plan).toEqual(scripted.plan);
    expect(filmPlanOf(PLAN)).toEqual(scripted.plan);
    expect(filmPlanOf({ ...PLAN, edit: null })!.map((r) => r.label)).toEqual(["Shots", "Text on screen", "Setup"]);
    expect(filmPlanOf(null)).toEqual([]);
    expect(filmPlanOf(undefined)).toEqual([]);
  });

  it("a decode only: the why row, no plan, no blueprint, variant 0", () => {
    const short = REMIX_DECODED.props.sourceDecode!;
    expect(remixFilmOf(REMIX_DECODED.props)).toEqual({
      why: { text: short.hookPattern, sub: short.theTurn },
      plan: [],
      blueprintId: null,
      variant: 0,
    });
  });

  it("one of the two missing: the other alone, as the row's text", () => {
    const blank = (over: Partial<typeof DECODE>) => remix("x", { sourceDecode: { ...DECODE, ...over } }).props;
    expect(remixFilmOf(blank({ hookPattern: "  " }))!.why).toEqual({ text: DECODE.theTurn, sub: null });
    expect(remixFilmOf(blank({ theTurn: " " }))!.why).toEqual({ text: DECODE.hookPattern, sub: null });
  });

  it("a plain line (whyPlain, from the decode's WHY_PLAIN_RULE): shown alone, in place of the technical beats", () => {
    const plain = "A dog steals the sandwich in the first second. People stay to see if he gets caught.";
    const p = remix("x", { sourceDecode: { ...DECODE, whyPlain: `  ${plain}  ` } }).props;
    expect(remixFilmOf(p)!.why).toEqual({ text: plain, sub: null });
  });

  it("a stored remix without it, or a blank one: the old text, as before", () => {
    expect(remixFilmOf(remix("x", { sourceDecode: { ...DECODE, whyPlain: "  " } }).props)!.why).toEqual({ text: DECODE.hookPattern, sub: DECODE.theTurn });
  });

  it("a plan only: no why row", () => {
    expect(remixFilmOf(remix("x", { production: PLAN }).props)).toMatchObject({ why: null, plan: filmPlanOf(PLAN) });
  });

  it("neither: null, so no button; a blueprint alone is not enough (nothing is known before the read)", () => {
    expect(remixFilmOf(remix("x").props)).toBeNull();
    expect(remixFilmOf(remix("x", { blueprintId: "bp-fixture-01" }).props)).toBeNull();
    expect(remixFilmOf(remix("x", { production: { shots: " ", onScreenText: "", setup: "", edit: null } }).props)).toBeNull();
    expect(remixFilmOf(remix("x", { sourceDecode: { ...DECODE, hookPattern: " ", theTurn: " " } }).props)).toBeNull();
    expect(remixFilmOf(remix("x", { production: null }).props)).toBeNull();
  });
});

describe("remixBeatsOf: the beat rows from a read", () => {
  it("variant 1: a row per beat with something in it, named by the original's role, its span, the words, one paragraph", () => {
    expect(remixBeatsOf(BLUEPRINT_ANSWER, 1)).toEqual([
      {
        name: "Hook",
        span: "0 to 3 s",
        say: "Sam, if you skip this, I’m eating your last ramen.",
        notes: "Phone at arm’s length, walking into the kitchen. On screen: Day 1 of 5.",
      },
      {
        name: "Setup",
        span: "3 to 9 s",
        say: "Four dollars. One pot. Twenty minutes.",
        notes: "Top-down on the counter, ingredients in a row. On screen: $4. Cut a second earlier than the original, its middle drags.",
      },
      { name: "Turn", span: "9 to 14 s", say: null, notes: "Lift the lid on the steam." },
      { name: "Close", span: "20 to 24 s", say: "Your move, Sam.", notes: null },
    ]);
  });

  it("variant 0: the first script's beats", () => {
    expect(remixBeatsOf(BLUEPRINT_ANSWER, 0).map((r) => [r.name, r.say])).toEqual([
      ["Hook", "Variant zero opens here."],
      ["Setup", "Variant zero sets it up."],
    ]);
  });

  it("the paragraph: the shot only; the shot and what is on screen; all three", () => {
    expect(notesOf({ shot: "close on the pot" })).toBe("Close on the pot.");
    expect(notesOf({ shot: "close on the pot", on_screen_text: "$4" })).toBe("Close on the pot. On screen: $4.");
    expect(notesOf({ shot: "close on the pot", on_screen_text: "$4", repair: "hold it a beat longer" })).toBe(
      "Close on the pot. On screen: $4. Hold it a beat longer.",
    );
    expect(notesOf({ on_screen_text: "$4" })).toBe("On screen: $4.");
    expect(notesOf({ repair: "say the price first" })).toBe("Say the price first.");
  });

  it("a piece that already ends with its own stop gets no second one", () => {
    expect(notesOf({ shot: "Close on the pot.", on_screen_text: "Day one?", repair: "Hold it!" })).toBe("Close on the pot. On screen: Day one? Hold it!");
    expect(notesOf({ shot: "Say “go.”", on_screen_text: "Wait…" })).toBe("Say “go.” On screen: Wait…");
  });

  // Fix round 2 (review M2): a piece that ends on a comma, a semicolon, a colon or a dash loses it first.
  it("a piece ending in a comma, a semicolon, a colon or a dash loses that mark before its full stop", () => {
    expect(notesOf({ shot: "Hold it,", on_screen_text: "$4;", repair: "say the price:" })).toBe("Hold it. On screen: $4. Say the price.");
    expect(notesOf({ shot: "Close on the pot -", repair: "cut early –" })).toBe("Close on the pot. Cut early.");
    expect(notesOf({ shot: " - ", repair: "Cut early" })).toBe("Cut early.");
    expect(notesOf({ shot: "Close on the pot", on_screen_text: " - " })).toBe("Close on the pot.");
  });

  it("the words trimmed; none: no words", () => {
    expect(remixBeatsOf(answerWith({ spoken: "  Hi there.  ", shot: "x" }), 0)[0]?.say).toBe("Hi there.");
    expect(remixBeatsOf(answerWith({ spoken: "   ", shot: "x" }), 0)[0]?.say).toBeNull();
  });

  it("a beat with neither words nor a paragraph has no row", () => {
    expect(remixBeatsOf(answerWith({ spoken: " ", on_screen_text: " ", shot: " ", repair: " " }), 0)).toEqual([]);
  });

  it("the span: whole seconds, rounded; none when either end is missing or the end comes first", () => {
    const spanOf = (original: Record<string, unknown>) => remixBeatsOf(answerWith({ shot: "x" }, original), 0)[0]?.span;
    expect(spanOf({ t_start: 2.6, t_end: 9.4 })).toBe("3 to 9 s");
    expect(spanOf({ t_start: 0, t_end: 3.2 })).toBe("0 to 3 s");
    expect(spanOf({ t_start: 9, t_end: 3 })).toBeNull();
    expect(spanOf({ t_start: undefined })).toBeNull();
    expect(spanOf({ t_end: "3" })).toBeNull();
    expect(spanOf({ t_start: Number.NaN })).toBeNull();
  });

  // Fix round 2 (review M4, the spec's new wording): a beat shorter than a second reads "3 s".
  it("a span whose start and end round to the same second reads that second alone", () => {
    const spanOf = (original: Record<string, unknown>) => remixBeatsOf(answerWith({ shot: "x" }, original), 0)[0]?.span;
    expect(spanOf({ t_start: 3.1, t_end: 3.4 })).toBe("3 s");
    expect(spanOf({ t_start: 3, t_end: 3 })).toBe("3 s");
    expect(spanOf({ t_start: 2.6, t_end: 3.4 })).toBe("3 s");
    expect(spanOf({ t_start: 3.1, t_end: 3.6 })).toBe("3 to 4 s");
  });

  it("the names: Hook, Setup, Turn, Payoff, Close; another role capitalised; no original beat: no name and no span", () => {
    const nameOf = (role: unknown) => remixBeatsOf(answerWith({ shot: "x" }, { role }), 0)[0]?.name;
    expect(["hook", "setup", "turn", "payoff", "close"].map(nameOf)).toEqual(["Hook", "Setup", "Turn", "Payoff", "Close"]);
    expect(nameOf("cta")).toBe("Call to action");
    expect(nameOf("reveal")).toBe("Reveal");
    expect(nameOf(undefined)).toBeNull();
    const orphan = remixBeatsOf(answerWith({ index: 7, shot: "x" }), 0);
    expect(orphan).toEqual([{ name: null, span: null, say: null, notes: "X." }]);
  });

  // Fix round 2 (review M3): an adapted beat is matched to an original only when both indexes are numbers.
  it("no index on either side is no match: the row has no name and no span", () => {
    const unindexed = (adaptedIndex: unknown, originalIndex: unknown) =>
      remixBeatsOf(answerWith({ index: adaptedIndex, shot: "x" }, { index: originalIndex }), 0)[0];
    expect(unindexed(undefined, undefined)).toEqual({ name: null, span: null, say: null, notes: "X." });
    expect(unindexed(null, null)).toEqual({ name: null, span: null, say: null, notes: "X." });
    expect(unindexed("0", "0")).toEqual({ name: null, span: null, say: null, notes: "X." });
    expect(unindexed(0, 0)).toMatchObject({ name: "Hook", span: "0 to 3 s" });
  });

  it("no rows: a timing that could not be read, no beats for the variant, a variant past the end, no original beats", () => {
    expect(remixBeatsOf({ ...BLUEPRINT_ANSWER, blueprint: { ...BLUEPRINT_ANSWER.blueprint, from_fixed_buckets: true } }, 1)).toEqual([]);
    expect(remixBeatsOf({ ...BLUEPRINT_ANSWER, script: [[], []] }, 1)).toEqual([]);
    expect(remixBeatsOf(BLUEPRINT_ANSWER, 5)).toEqual([]);
    expect(remixBeatsOf({ ...BLUEPRINT_ANSWER, blueprint: { ...BLUEPRINT_ANSWER.blueprint, beats: [] } }, 1)).toEqual([]);
  });

  it("a malformed answer: no rows, nothing thrown", () => {
    for (const answer of [
      null,
      undefined,
      "x",
      42,
      [],
      {},
      { script: "x", blueprint: {} },
      { script: [[{ index: 0, shot: "x" }]] },
      { script: [[{ index: 0, shot: "x" }]], blueprint: null },
      { script: [[{ index: 0, shot: "x" }]], blueprint: { beats: "x" } },
      { script: [[null, 3, "x", { index: "0", shot: 5, spoken: {} }]], blueprint: { beats: [null, { index: 0 }] } },
    ]) {
      expect(() => remixBeatsOf(answer, 0)).not.toThrow();
      expect(remixBeatsOf(answer, 0)).toEqual([]);
    }
  });
});
