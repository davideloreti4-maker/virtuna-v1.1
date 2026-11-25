/** @vitest-environment happy-dom */

/**
 * FilmSheet — "How to film it" (thread depth §3.2), opened for real in the look's sheet from the
 * filmed fixture through the real `filmNotesOf`. The card's side (the button, the focus) is in
 * `script-answer.test.tsx`; here, the rows as filmed.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { filmNotesOf } from "@/lib/thread-next/film-notes";
import { FilmSheet } from "../film-sheet";
import { SCRIPT_FILMED } from "./fixtures/answers";

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
