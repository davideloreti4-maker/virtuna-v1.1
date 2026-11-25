import { describe, expect, it } from "vitest";
import { fallbackOf } from "@/lib/thread-next/fallback-lines";
import {
  broughtCard,
  composed,
  corpus,
  multiAudienceRead,
  personaChatTurn,
  predictionGauge,
  profileRead,
  reactionDistribution,
} from "@/components/thread-next/__tests__/fixtures/answers";

describe("fallbackOf", () => {
  it("composed card: deliverable text, then the body's lines in order", () => {
    expect(fallbackOf(composed()).title).toBe("Two hooks compared"); // fixture's deliverable.text
    expect(fallbackOf(composed())).toEqual({
      title: "Two hooks compared",
      lines: ["The $40 hook", "The 3-step hook", "Lead with the cost.", "Keep the fix in the same line.", "Both name finals week."],
    });
  });

  it("composed card: every listed slot kind gives lines; the others give none", () => {
    const block = composed({
      deliverable: { kind: "claim", text: "  A timed plan  " },
      body: [
        { kind: "script_timeline", lines: [{ t: "0:00", text: "Open on the receipt." }, { t: "0:03", text: "Show the $5 bowl." }] },
        { kind: "beats", items: [{ label: "Hook", text: "Name the cost." }, { label: "Payoff", text: "Show the fix." }] },
        { kind: "quote", text: "Not a line." },
        { kind: "label_values", rows: [{ label: "Length", value: "24s" }] },
        { kind: "chips", items: ["Not a line"] },
        { kind: "proof_strip", receiptRefs: ["row-1"] },
        { kind: "bullets", items: ["  ", "Film in one take."] },
        { kind: "note", text: "Post before 8pm." },
      ],
    });
    expect(fallbackOf(block)).toEqual({
      title: "A timed plan",
      lines: ["Open on the receipt.", "Show the $5 bowl.", "Name the cost.", "Show the fix.", "Film in one take.", "Post before 8pm."],
    });
  });

  it("profile read: the subject, its traits, how they react", () => {
    expect(fallbackOf(profileRead())).toEqual({
      title: "Late-night studiers",
      lines: ["Busy", "Budget-minded", "They stay for a clear payoff."],
    });
  });

  it("multi-audience read: the concept, then name · lever per audience", () => {
    expect(fallbackOf(multiAudienceRead())).toEqual({
      title: "The $5 meal prep",
      lines: ["Students · Lead with the price", "General · Show the food first"],
    });
  });

  it("multi-audience read without a concept: the plain title", () => {
    expect(fallbackOf(multiAudienceRead({ concept: undefined })).title).toBe("Answer");
  });

  it("sources: handle · views per source", () => {
    expect(fallbackOf(corpus())).toEqual({ title: "Sources", lines: ["@dij.arc · 21K views", "@lacapture · 154K views", "@nia.tests"] });
  });

  it("reaction distribution, a person: the verdict", () => {
    expect(fallbackOf(reactionDistribution("person"))).toEqual({ title: "Nia", lines: ["receptive"] });
  });

  it("reaction distribution, a panel: group · verdict per reaction", () => {
    expect(fallbackOf(reactionDistribution("panel"))).toEqual({ title: "Students", lines: ["Quiet watchers · stop", "Tough crowd · scroll"] });
  });

  it("prediction gauge: the scenario, then the drivers", () => {
    expect(fallbackOf(predictionGauge())).toEqual({
      title: "Posting at 8pm doubles saves",
      lines: ["Evening is when they plan meals", "Late posts sink under exam content"],
    });
  });

  it("persona chat turn: the group's name, then the text", () => {
    expect(fallbackOf(personaChatTurn())).toEqual({ title: "Quiet watchers", lines: ["I would stay if the price came first."] });
  });

  it("brought card: the stimulus, no quote (no scrollQuote on a new card)", () => {
    expect(fallbackOf(broughtCard())).toEqual({ title: "My own hook about cheap lunches", lines: [] });
  });

  it("band, personas and anything unknown: the plain title", () => {
    expect(fallbackOf({ type: "band", props: {} })).toEqual({ title: "Answer", lines: [] });
    expect(fallbackOf({ type: "band", props: { band: "Strong", fraction: "6/10 stop", model: "sim1-flash" } })).toEqual({ title: "Answer", lines: [] });
    expect(fallbackOf({ type: "personas", props: { personas: [] } })).toEqual({ title: "Answer", lines: [] });
    expect(fallbackOf({ type: "unknown", props: {} })).toEqual({ title: "Answer", lines: [] });
  });

  it("a known type with props that do not validate: the plain title", () => {
    expect(fallbackOf({ type: "profile-read", props: {} })).toEqual({ title: "Answer", lines: [] });
    expect(fallbackOf({ type: "composed-card", props: null })).toEqual({ title: "Answer", lines: [] });
  });

  it("a blank title becomes the plain title", () => {
    expect(fallbackOf(predictionGauge({ scenario: "   " })).title).toBe("Answer");
  });
});
