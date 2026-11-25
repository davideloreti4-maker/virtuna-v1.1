/** @vitest-environment happy-dom */

/**
 * FilmSheet — "How to film it" (thread depth §3.2), opened for real in the look's sheet from the
 * filmed fixture through the real `filmNotesOf`. The card's side (the button, the focus) is in
 * `script-answer.test.tsx`; here, the rows as filmed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { filmNotesOf } from "@/lib/thread-next/film-notes";
import { foldLead } from "@/lib/thread-next/first-sentence";
import { remixBeatsOf, remixFilmOf, type RemixBeatRow } from "@/lib/thread-next/remix-film";
import { settleClock } from "../answer-sheet";
import { FilmSheet, RemixFilmSheet } from "../film-sheet";
import { BLUEPRINT_ANSWER, REMIX_DECODED, REMIX_FILMED, SCRIPT_FILMED, remix } from "./fixtures/answers";

afterEach(cleanup);

const NOTES = filmNotesOf(SCRIPT_FILMED.props)!;

function open() {
  render(<FilmSheet notes={NOTES} open onOpenChange={() => {}} returnFocus={null} />);
  return screen.getByRole("dialog", { name: "How to film it" });
}

describe("FilmSheet", () => {
  it("the beats' rows, then the plan's, in one list: a hairline between rows, none above the first", () => {
    const dialog = open();
    const rows = [...dialog.querySelectorAll<HTMLElement>("[data-sheet^='film-']")];
    expect(rows.map((r) => r.getAttribute("data-sheet"))).toEqual(["film-beat", "film-beat", "film-beat", "film-plan", "film-plan", "film-plan", "film-plan"]);
    // One parent, so `first:` takes the hairline off the first row only.
    expect(new Set(rows.map((r) => r.parentElement)).size).toBe(1);
    expect(rows[0]!.parentElement!.firstElementChild).toBe(rows[0]);
    for (const row of rows) expect(row).toHaveClass("border-t", "border-border", "first:border-t-0", "pt-2.5", "pb-[11px]");
  });

  it("a row: the name 13 / 18 at 640, the span 12 / 18 in the muted ink on its baseline, the cue 14 / 20 two under", () => {
    const dialog = open();
    const row = dialog.querySelector<HTMLElement>('[data-sheet="film-beat"]')!;
    expect(row.querySelector("h3")).toHaveClass("text-meta", "leading-[18px]", "font-[640]", "text-foreground");
    expect(row.querySelector('[data-part="film-span"]')).toHaveClass("text-label", "leading-[18px]", "text-foreground-muted");
    expect(row.querySelector("h3")!.parentElement).toHaveClass("flex", "items-baseline", "gap-2");
    expect(row.querySelector("p")).toHaveClass("mt-0.5", "text-reading", "leading-5", "text-foreground");
  });

  it("each row's name is a heading under the sheet's title", () => {
    open();
    expect(screen.getByRole("heading", { level: 2, name: "How to film it" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Hook",
      "Turn",
      "Call to action",
      "Shots",
      "Text on screen",
      "Setup",
      "Edit",
    ]);
  });

  it("has no axe violations", async () => {
    const dialog = open();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog)).toHaveNoViolations();
  });
});

// Thread depth, second part §4: a remix's sheet. Its rows through the real `remixFilmOf` and
// `remixBeatsOf`; the card's side (the button, the read, the focus) is in `remix-answer.test.tsx`.
describe("RemixFilmSheet", () => {
  // A sheet takes no click in its first moment (a double-tap's second tap; its own test is in
  // answer-sheet.test.tsx). Here its clock jumps a second at every read, so "More" pressed at once counts.
  let tick = 0;
  beforeEach(() => {
    tick = 0;
    settleClock.now = () => (tick += 1000);
  });
  afterEach(() => {
    settleClock.now = () => performance.now();
  });
  const FILM = remixFilmOf(REMIX_FILMED.props)!;
  const BEATS = remixBeatsOf(BLUEPRINT_ANSWER, 1);
  const DECODE = REMIX_FILMED.props.sourceDecode!;

  function openRemix(beats: "pending" | readonly RemixBeatRow[], film = FILM) {
    render(<RemixFilmSheet film={film} beats={beats} open onOpenChange={() => {}} returnFocus={null} />);
    return screen.getByRole("dialog", { name: "How to film it" });
  }
  const kinds = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>("[data-sheet^='film-'], [data-part='film-ghost']")].map((r) => r.getAttribute("data-sheet") ?? "ghost");

  it("why the original worked, then your beats, then the plan, in one list", () => {
    const dialog = openRemix(BEATS);
    expect(kinds(dialog)).toEqual(["film-why", "film-remix-beat", "film-remix-beat", "film-remix-beat", "film-remix-beat", "film-plan", "film-plan", "film-plan", "film-plan"]);
    const rows = [...dialog.querySelectorAll<HTMLElement>("[data-sheet^='film-']")];
    expect(new Set(rows.map((r) => r.parentElement)).size).toBe(1);
    expect(rows[0]!.parentElement!.firstElementChild).toBe(rows[0]);
    for (const row of rows) expect(row).toHaveClass("border-t", "border-border", "first:border-t-0", "pt-2.5", "pb-[11px]");
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Why the original worked",
      "Hook",
      "Setup",
      "Turn",
      "Close",
      "Shots",
      "Text on screen",
      "Setup",
      "Edit",
    ]);
  });

  it("why: the pattern in the ink, the turn under it in the secondary ink (short texts: whole, no 'More')", () => {
    const short = REMIX_DECODED.props.sourceDecode!;
    const dialog = openRemix([], remixFilmOf(REMIX_DECODED.props)!);
    const why = dialog.querySelector<HTMLElement>('[data-sheet="film-why"]')!;
    const [pattern, turn] = [...why.querySelectorAll("p")];
    expect(pattern).toHaveTextContent(short.hookPattern);
    expect(pattern).toHaveClass("mt-0.5", "text-reading", "leading-5", "text-foreground");
    expect(turn).toHaveTextContent(short.theTurn);
    expect(turn).toHaveClass("mt-0.5", "text-reading", "leading-5", "text-foreground-secondary");
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  // Fix round 2 (spec §4 point 1): real runs write several long sentences here. The fold is the hook
  // sheet's own rule (`foldLead`).
  it("a long why: each text shows its lead, one 'More' under both; 'More' opens both whole and takes the focus", () => {
    const dialog = openRemix([]);
    const why = dialog.querySelector<HTMLElement>('[data-sheet="film-why"]')!;
    const paragraphs = () => [...why.querySelectorAll("p")].map((p) => p.textContent);
    const leadPattern = foldLead(DECODE.hookPattern)!;
    const leadTurn = foldLead(DECODE.theTurn)!;
    expect(leadPattern).not.toBe(DECODE.hookPattern);
    expect(leadTurn).not.toBe(DECODE.theTurn);
    expect(paragraphs()).toEqual([leadPattern, leadTurn]);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(why.lastElementChild).toBe(more);
    expect(screen.getAllByRole("button", { name: "More" })).toHaveLength(1);

    fireEvent.click(more);
    expect(paragraphs()).toEqual([DECODE.hookPattern, DECODE.theTurn]);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    expect(document.activeElement).toBe(why.querySelector("p"));
  });

  it("one long text and one short: the long one folds, the short one shows whole, one 'More'", () => {
    const short = REMIX_DECODED.props.sourceDecode!;
    const film = remixFilmOf(remix("x", { sourceDecode: { ...DECODE, theTurn: short.theTurn } }).props)!;
    const dialog = openRemix([], film);
    const why = dialog.querySelector<HTMLElement>('[data-sheet="film-why"]')!;
    expect([...why.querySelectorAll("p")].map((p) => p.textContent)).toEqual([foldLead(DECODE.hookPattern), short.theTurn]);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect([...why.querySelectorAll("p")].map((p) => p.textContent)).toEqual([DECODE.hookPattern, short.theTurn]);
  });

  it("a beat: its name and span, the words in quotes in the ink, the paragraph under them in the secondary ink", () => {
    const dialog = openRemix(BEATS);
    const [hook, , turn, close] = [...dialog.querySelectorAll<HTMLElement>('[data-sheet="film-remix-beat"]')];
    expect(hook!.querySelector('[data-part="film-span"]')).toHaveTextContent("0 to 3 s");
    const [say, notes] = [...hook!.querySelectorAll("p")];
    expect(say).toHaveTextContent(/^“Sam, if you skip this, I’m eating your last ramen\.”$/);
    expect(say).toHaveClass("text-foreground");
    expect(notes).toHaveTextContent("Phone at arm’s length, walking into the kitchen. On screen: Day 1 of 5.");
    expect(notes).toHaveClass("text-foreground-secondary");
    // No words: the paragraph is the row's text. Words only: no paragraph.
    expect([...turn!.querySelectorAll("p")].map((p) => [p.textContent, p.classList.contains("text-foreground")])).toEqual([["Lift the lid on the steam.", true]]);
    expect([...close!.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["“Your move, Sam.”"]);
  });

  it("while the beats are read: two ghost rows where they will be, the list busy; the rest already there", () => {
    const dialog = openRemix("pending");
    expect(kinds(dialog)).toEqual(["film-why", "ghost", "ghost", "film-plan", "film-plan", "film-plan", "film-plan"]);
    const list = dialog.querySelector('[data-sheet="film-why"]')!.parentElement!;
    expect(list).toHaveAttribute("aria-busy", "true");
    const ghosts = [...dialog.querySelectorAll<HTMLElement>('[data-part="film-ghost"]')];
    for (const ghost of ghosts) {
      expect(ghost).toHaveAttribute("aria-hidden", "true");
      expect(ghost).toHaveClass("border-t", "border-border", "first:border-t-0");
      expect(ghost.querySelectorAll(".ghost-bar").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("no beats: no beat rows and no message; nothing busy", () => {
    const dialog = openRemix([]);
    expect(kinds(dialog)).toEqual(["film-why", "film-plan", "film-plan", "film-plan", "film-plan"]);
    expect(dialog.querySelector("[aria-busy]")).toBeNull();
    expect(dialog.querySelector('[data-sheet="film-why"]')!.parentElement!.textContent).not.toMatch(/timing|could not|couldn/i);
  });

  it("a decode only: the why row alone; a plan only: the plan alone, its first row with no hairline above", () => {
    const { unmount } = render(<RemixFilmSheet film={remixFilmOf(REMIX_DECODED.props)!} beats={[]} open onOpenChange={() => {}} returnFocus={null} />);
    expect(kinds(screen.getByRole("dialog"))).toEqual(["film-why"]);
    unmount();
    const dialog = openRemix([], remixFilmOf(remix("x", { production: REMIX_FILMED.props.production }).props)!);
    expect(kinds(dialog)).toEqual(["film-plan", "film-plan", "film-plan", "film-plan"]);
    const first = dialog.querySelector<HTMLElement>('[data-sheet="film-plan"]')!;
    expect(first.parentElement!.firstElementChild).toBe(first);
  });

  it("has no axe violations, read and while reading", async () => {
    const dialog = openRemix(BEATS);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog)).toHaveNoViolations();
    cleanup();
    const busy = openRemix("pending");
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(busy)).toHaveNoViolations();
  });
});
