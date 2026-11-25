/** @vitest-environment happy-dom */
/** home-screen-edit.test.tsx — Home's six cards for an account the editor is open to (plan 2026-11-24-editor-screens-a, Task 16; E3, E11). */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { HomeScreen, type HomeScreenProps } from "../home-screen";

afterEach(cleanup);

const props = (more: Partial<HomeScreenProps> = {}): HomeScreenProps => ({
  greeting: "Good evening, Nia.", credits: null, field: <div />, picked: false,
  onPickSkill: vi.fn(), recent: [], onOpenThread: vi.fn(), recentOnDesktop: false, onMore: vi.fn(), ...more,
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
    // More is the sixth card, so the line under the cards is gone; it opens the same sheet.
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

  it("are the four and More skills, as before, where it is not", () => {
    render(<HomeScreen {...props()} />);
    expect(cards().map(nameOf)).toEqual(["Simulate", "Hooks", "Script", "Remix"]);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    expect(screen.getByRole("button", { name: "More skills" })).toBeInTheDocument();
  });
});
