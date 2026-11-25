import { describe, expect, it } from "vitest";
import { filmNotesOf, filmSpan } from "@/lib/thread-next/film-notes";

type Beat = { label: string; content: string; timing: string; retentionMarker: string; filming?: string | null };
const beat = (label: string, timing: string, filming?: string | null): Beat => ({
  label,
  content: `${label} words.`,
  timing,
  retentionMarker: "It keeps the promise moving.",
  ...(filming === undefined ? {} : { filming }),
});
const PLAN = { shots: "One talking head, two b-roll.", onScreenText: "The price on the hook.", setup: "Phone at eye level, window light." };

describe("filmSpan", () => {
  it.each<[string, string | null]>([
    ["0–3s", "0 to 3 s"],
    ["3-15s", "3 to 15 s"],
    ["0:20–0:35", "20 to 35 s"],
    ["20 to 24s", "20 to 24 s"],
    ["1.5–4s", "1.5 to 4 s"],
    ["1:00–1:15", "60 to 75 s"],
    // The end before the start is not a span (fix round 1); an end at the start still reads.
    ["8–3s", null],
    ["0:20–0:10", null],
    ["3–3s", "3 to 3 s"],
    // Either end unreadable: no span.
    ["15s", null],
    ["soon", null],
    ["", null],
  ])("%j reads %j", (timing, span) => {
    expect(filmSpan(timing)).toBe(span);
  });
});

describe("filmNotesOf", () => {
  it("null when no beat has a cue and there is no production", () => {
    expect(filmNotesOf({ beats: [beat("Hook", "0–3s"), beat("CTA", "3–6s", null)] })).toBeNull();
    expect(filmNotesOf({ beats: [beat("Hook", "0–3s", "   ")], production: null })).toBeNull();
    expect(filmNotesOf({ beats: [] })).toBeNull();
  });

  it("one row for each beat with a cue, in order: its name, its span, its cue; a beat without one has no row", () => {
    const notes = filmNotesOf({
      beats: [
        beat("Hook", "0–3s", "  Close-up, handheld. "),
        beat("Setup", "3–8s"),
        beat("Turn", "8–14s", null),
        beat("CTA", "the end", "Lean in, then cut."),
      ],
    });
    expect(notes).toEqual({
      beats: [
        { name: "Hook", span: "0 to 3 s", cue: "Close-up, handheld." },
        { name: "Call to action", span: null, cue: "Lean in, then cut." },
      ],
      plan: [],
    });
  });

  it("the plan's rows in order: Shots, Text on screen, Setup, then Edit when it is there", () => {
    const withEdit = filmNotesOf({ beats: [beat("Hook", "0–3s")], production: { ...PLAN, edit: "Hard cuts only." } });
    expect(withEdit).toEqual({
      beats: [],
      plan: [
        { label: "Shots", text: "One talking head, two b-roll." },
        { label: "Text on screen", text: "The price on the hook." },
        { label: "Setup", text: "Phone at eye level, window light." },
        { label: "Edit", text: "Hard cuts only." },
      ],
    });
    for (const edit of [undefined, null, "", "  "]) {
      const notes = filmNotesOf({ beats: [], production: { ...PLAN, edit } });
      expect(notes?.plan.map((r) => r.label)).toEqual(["Shots", "Text on screen", "Setup"]);
    }
  });

  it("cues and a plan together; an empty label gives a row with no name", () => {
    const notes = filmNotesOf({ beats: [beat(" ", "0–3s", "Top-down on the pot.")], production: PLAN });
    expect(notes?.beats).toEqual([{ name: null, span: "0 to 3 s", cue: "Top-down on the pot." }]);
    expect(notes?.plan).toHaveLength(3);
  });

  it("a plan row with nothing in it is left out (the runner never sends one; a stored turn might)", () => {
    const notes = filmNotesOf({ beats: [], production: { ...PLAN, onScreenText: "  " } });
    expect(notes?.plan.map((r) => r.label)).toEqual(["Shots", "Setup"]);
    expect(filmNotesOf({ beats: [], production: { shots: "", onScreenText: "", setup: "" } })).toBeNull();
  });
});
