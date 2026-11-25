/** @vitest-environment happy-dom */
/**
 * /dev/home's states, rendered for real (the real HomeScreen, ThreadField and AudienceSheet on local
 * state). One state, `money`, shows the "Money made" row (Earn, rulings 18 and 24); every other state
 * is Home as it was before the row: no row and no blank band where it would be. `fetch` (the one way
 * out) is a stand-in that refuses, so a request from any state would fail the test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { DevHome, type DevHomeState } from "../dev-home";

const fetchSpy = vi.fn(() => Promise.reject(new Error("/dev/home sends nothing")));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchSpy.mockClear();
});

const home = () => screen.getByTestId("home-next");
const greeting = () => within(home()).getByRole("heading", { level: 1 });
const moneyPart = () => home().querySelector<HTMLElement>('[data-part="money"]');
/** The field's block: the one that holds the real field. */
const fieldBlock = () => greeting().parentElement!.querySelector<HTMLElement>(":scope > div:has([data-testid='thread-field'])")!;
/** The field's block as Home drew it before the row existed (HEAD `9478c611`). */
const FIELD_BEFORE_THE_ROW = "mx-auto mt-3 w-full max-w-[720px] md:mt-7";

const WITHOUT_THE_ROW: DevHomeState[] = ["empty", "chats", "plain", "picked", "simulate", "noname", "unlimited", "audience"];

describe("/dev/home's states", () => {
  it.each(WITHOUT_THE_ROW)("%s: Home without the row and without a blank band under the greeting", (state) => {
    render(<DevHome state={state} recentOnDesktop={false} earnedCents={0} />);
    expect(moneyPart()).toBeNull();
    expect(screen.queryByText("Money made")).toBeNull();
    expect(screen.queryByRole("link", { name: /^Money made/ })).toBeNull();
    // The field's block is what follows the greeting, at the approved gap.
    expect(greeting().nextElementSibling).toBe(fieldBlock());
    expect(fieldBlock().className).toBe(FIELD_BEFORE_THE_ROW);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("money: the row between the greeting and the field, a link to Earn, nothing earned", () => {
    render(<DevHome state="money" recentOnDesktop={false} earnedCents={0} />);
    const link = screen.getByRole("link", { name: "Money made: $0. Earn 50%" });
    expect(link).toHaveAttribute("href", "/earn");
    expect(moneyPart()!.contains(link)).toBe(true);
    expect(greeting().nextElementSibling).toBe(moneyPart());
    expect(moneyPart()!.nextElementSibling).toBe(fieldBlock());
    // Otherwise the default state: the cards and the three recent chats.
    expect(screen.getByRole("button", { name: "Simulate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meal prep for busy students" })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("money with an amount in cents: Earn's own money words (a long one, for the narrow widths)", () => {
    render(<DevHome state="money" recentOnDesktop={false} earnedCents={124050} />);
    const link = screen.getByRole("link", { name: "Money made: $1,240.50. Earn 50%" });
    expect(within(link).getByText("$1,240.50")).toBeInTheDocument();
  });

  it("money with no amount (enrolled, the number could not be read): Money made and Earn 50% only", () => {
    render(<DevHome state="money" recentOnDesktop={false} earnedCents={null} />);
    const link = screen.getByRole("link", { name: "Money made. Earn 50%" });
    expect(link.textContent).not.toContain("$");
  });
});
