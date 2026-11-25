/** @vitest-environment happy-dom */
/**
 * home-screen-edit.test.tsx — Home's six cards for an account the editor is open to (plan 2026-11-24-editor-screens-a, Task 16;
 * E3, E11), on the Home of spec 2026-11-25 §2.5: the cards are there only for a creator with no chats, as wide as the field, all
 * one height; with the editor open they are six, More the sixth, which opens the field's More sheet.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { HomeScreen, type HomeScreenProps } from "../home-screen";

afterEach(cleanup);

const props = (more: Partial<HomeScreenProps> = {}): HomeScreenProps => ({
  greeting: "Good evening, Nia.",
  audience: { name: "@creator_one", general: false, open: false, onOpen: vi.fn() },
  credits: null,
  field: <div data-testid="slot" />,
  under: "cards",
  onPickSkill: vi.fn(),
  recent: [],
  onOpenThread: vi.fn(),
  onMore: vi.fn(),
  ...more,
});
const list = () => screen.getByRole("list", { name: "Skills" });
const cards = () => within(list()).getAllByRole("button");
const nameOf = (card: HTMLElement) => document.getElementById(card.getAttribute("aria-labelledby") ?? "")?.textContent;

describe("Home's cards", () => {
  it("are six where the editor is open: Simulate, Edit, Hooks, Script, Remix, More", () => {
    const shown = props({ editOpen: true });
    render(<HomeScreen {...shown} />);
    expect(cards().map(nameOf)).toEqual(["Simulate", "Edit", "Hooks", "Script", "Remix", "More"]);
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAccessibleDescription("A raw take to a finished video");
    // More is the sixth card; it opens the same sheet as the field's More.
    expect(screen.getByRole("button", { name: "More" })).toHaveAccessibleDescription("Ideas, Explore, your account");
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(shown.onPickSkill).toHaveBeenCalledWith("edit");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(shown.onMore).toHaveBeenCalledTimes(1);
    expect(shown.onPickSkill).toHaveBeenCalledTimes(1);
  });

  it("stand three by two on desktop where they are six, and four in a row where they are four", () => {
    const { unmount } = render(<HomeScreen {...props({ editOpen: true })} />);
    expect(list().className).toContain("@min-[760px]:grid-cols-3");
    expect(list().className).not.toContain("@min-[760px]:grid-cols-4");
    unmount();
    render(<HomeScreen {...props()} />);
    expect(list().className).toContain("@min-[760px]:grid-cols-4");
    expect(list().className).not.toContain("@min-[760px]:grid-cols-3");
  });

  // Rule E4: the four-card state has no "More skills" line, More is in the field.
  it("are the four where it is not, with no More card and no More skills line", () => {
    render(<HomeScreen {...props()} />);
    expect(cards().map(nameOf)).toEqual(["Simulate", "Hooks", "Script", "Remix"]);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
  });

  it("the six are only for a creator with no chats: with chats, or before the chat list answers, there are none", () => {
    for (const under of ["recent", "pending"] as const) {
      render(<HomeScreen {...props({ editOpen: true, under, recent: under === "recent" ? [{ id: "t1", title: "Meal prep for busy students", when: "2h ago" }] : [] })} />);
      expect(screen.queryByRole("list", { name: "Skills" })).toBeNull();
      for (const name of ["Simulate", "Edit", "More"]) expect(screen.queryByRole("button", { name })).toBeNull();
      cleanup();
    }
  });

  it("the six are as wide as the field and all one height: 720 at most, equal rows, each card filling its cell", () => {
    render(<HomeScreen {...props({ editOpen: true })} />);
    expect(list()).toHaveClass("mx-auto", "w-full", "max-w-[720px]", "grid", "grid-cols-2", "auto-rows-fr");
    expect(screen.getByTestId("slot").parentElement).toHaveClass("mx-auto", "w-full", "max-w-[720px]");
    for (const card of cards()) {
      expect(card.parentElement).toHaveClass("flex");
      expect(card).toHaveClass("w-full");
      expect(card.className).not.toMatch(/(^|\s)(h-|self-)/);
    }
  });

  it("a tap on a card picks its skill; nothing in HomeScreen takes the six away (the composer keeps them, see composer-edit)", () => {
    const shown = props({ editOpen: true });
    render(<HomeScreen {...shown} />);
    fireEvent.click(screen.getByRole("button", { name: "Script" }));
    expect(shown.onPickSkill).toHaveBeenCalledWith("script");
    expect(cards()).toHaveLength(6);
  });
});
