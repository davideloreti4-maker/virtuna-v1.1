/** @vitest-environment happy-dom */
/**
 * /dev/home's states, rendered for real (the real HomeScreen, ThreadField and AudienceSheet on local
 * state). Under the field one of three (spec 2026-11-25 §2.5): nothing (`pending`), Recent (a creator
 * with chats), or the four cards (`empty`, and the picked states, where the cards stay). "Money made"
 * is the last part of the page in the state `money`, only above zero (§2.6). `fetch` (the one way
 * out) is a stand-in that refuses, so a request from any state would fail the test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

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
/** The audience line under the greeting (spec 2026-11-25 §2.3). */
const audienceLine = () => within(home()).getByRole("button", { name: /, change audience$/ });
/** The field's block with no row: 14 under the audience line on a phone, 22 from md up (spec §2.4). */
const FIELD_WITHOUT_THE_ROW = "mx-auto mt-3.5 w-full max-w-[720px] md:mt-[22px]";
const field = () => screen.getByTestId("thread-field");

const WITHOUT_THE_ROW: DevHomeState[] = ["empty", "chats", "plain", "pending", "picked", "simulate", "noname", "unlimited", "audience", "general"];
const CARDS = ["Simulate", "Hooks", "Script", "Remix"];
/** The cards: the buttons of those names outside the field (its own skill buttons share them). */
const cardsShown = () => CARDS.filter((name) => screen.queryAllByRole("button", { name }).some((b) => !b.closest('[data-testid="thread-field"]')));
const recentShown = () => screen.queryByRole("heading", { name: "Recent" }) !== null;

describe("/dev/home's states", () => {
  it.each(WITHOUT_THE_ROW)("%s: Home without the row and without a blank band under the greeting", (state) => {
    render(<DevHome state={state} earnedCents={0} />);
    expect(moneyPart()).toBeNull();
    expect(screen.queryByText("Money made")).toBeNull();
    expect(screen.queryByRole("link", { name: /^Money made/ })).toBeNull();
    // The audience line follows the greeting, and the field's block the line, at the approved gap.
    expect(greeting().nextElementSibling).toBe(audienceLine());
    expect(audienceLine().nextElementSibling).toBe(fieldBlock());
    expect(fieldBlock().className).toBe(FIELD_WITHOUT_THE_ROW);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("money at $0 (`&earned=0`, nothing earned): no row", () => {
    render(<DevHome state="money" earnedCents={0} />);
    expect(moneyPart()).toBeNull();
    expect(screen.queryByText("Money made")).toBeNull();
  });

  it("money above zero (the state's own amount, $58.80): the row last on the page, after Recent, a link to Earn", () => {
    render(<DevHome state="money" earnedCents={5880} />);
    expect(screen.getByRole("link", { name: "Money made: $58.80. Earn 50%" })).toHaveAttribute("href", "/earn");
    expect(greeting().parentElement!.lastElementChild).toBe(moneyPart());
  });

  it("money with a long amount (`&earned=124050`): Earn's money words, last on the page", () => {
    render(<DevHome state="money" earnedCents={124050} />);
    const link = screen.getByRole("link", { name: "Money made: $1,240.50. Earn 50%" });
    expect(link).toHaveAttribute("href", "/earn");
    expect(within(link).getByText("$1,240.50")).toBeInTheDocument();
    expect(greeting().parentElement!.lastElementChild).toBe(moneyPart());
    expect(screen.getByRole("heading", { name: "Recent" }).closest("section")!.nextElementSibling).toBe(moneyPart());
    expect(fieldBlock().className).toBe(FIELD_WITHOUT_THE_ROW);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("money with no amount (enrolled, the number could not be read): no row", () => {
    render(<DevHome state="money" earnedCents={null} />);
    expect(moneyPart()).toBeNull();
  });
});

describe("/dev/home: under the field (spec 2026-11-25 §2.5)", () => {
  it.each<DevHomeState>(["chats", "plain", "noname", "unlimited", "audience", "general", "money"])("%s: Recent, and no cards", (state) => {
    render(<DevHome state={state} earnedCents={0} />);
    expect(recentShown()).toBe(true);
    expect(cardsShown()).toEqual([]);
  });

  it("chats: five recent chats", () => {
    render(<DevHome state="chats" earnedCents={0} />);
    const section = screen.getByRole("heading", { name: "Recent" }).closest("section")!;
    expect(within(section).getAllByRole("listitem")).toHaveLength(5);
  });

  it.each<DevHomeState>(["empty", "picked", "simulate"])("%s: the four cards, and no Recent", (state) => {
    render(<DevHome state={state} earnedCents={0} />);
    expect(cardsShown()).toEqual(CARDS);
    expect(recentShown()).toBe(false);
  });

  it("pending (the chat list not answered yet): nothing under the field", () => {
    render(<DevHome state="pending" earnedCents={0} />);
    expect(cardsShown()).toEqual([]);
    expect(recentShown()).toBe(false);
    expect(fieldBlock().nextElementSibling).toBeNull();
  });

  it("empty: a card's tap picks its skill in the field and the cards stay", () => {
    render(<DevHome state="empty" earnedCents={0} />);
    const card = screen.getAllByRole("button", { name: "Script" }).find((b) => !b.closest('[data-testid="thread-field"]'))!;
    fireEvent.click(card);
    expect(within(field()).getByRole("button", { name: "Script" })).toHaveAttribute("aria-pressed", "true");
    expect(cardsShown()).toEqual(CARDS);
  });
});

describe("/dev/home: Home's field and the audience line (spec 2026-11-25 §2.3-2.4)", () => {
  it.each(WITHOUT_THE_ROW)("%s: the field is the thread's, a solid card with its skill buttons and More", (state) => {
    render(<DevHome state={state} earnedCents={0} />);
    for (const name of ["Simulate", "Hooks", "Script", "Remix", "More"]) {
      expect(within(field()).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(field().style.backdropFilter).toBe("");
    expect(field().querySelector('[data-part="picked-skill"]')).toBeNull();
    expect(within(field()).queryByRole("button", { name: /audience/i })).toBeNull();
  });

  it.each([
    ["picked", "Hooks", "Hooks · 1", "A topic for your hooks"],
    ["simulate", "Simulate", "Simulate · 10", "Add a video or paste a link"],
  ] as const)("%s: %s is the selected button with its price, the text asks as in a thread", (state, name, shown, words) => {
    render(<DevHome state={state} earnedCents={0} />);
    const selected = within(field()).getByRole("button", { name });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveTextContent(shown);
    expect(field().querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect((within(field()).getByRole("textbox") as HTMLTextAreaElement).placeholder).toBe(words);
  });

  it("chats: nothing picked, the text says Ask anything", () => {
    render(<DevHome state="chats" earnedCents={0} />);
    expect(field().querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect((within(field()).getByRole("textbox") as HTMLTextAreaElement).placeholder).toBe("Ask anything");
  });

  it("the audience line names the audience in use and opens the audience sheet", () => {
    render(<DevHome state="chats" earnedCents={0} />);
    expect(audienceLine()).toHaveAccessibleName("For @creator_one, change audience");
    expect(audienceLine()).toHaveTextContent(/^For @creator_one$/);
    expect(screen.queryByRole("dialog", { name: "Audience" })).toBeNull();
    fireEvent.click(audienceLine());
    expect(screen.getByRole("dialog", { name: "Audience" })).toBeInTheDocument();
    expect(audienceLine()).toHaveAttribute("aria-expanded", "true");
  });

  it("audience: the sheet open; another audience picked there renames the line", () => {
    render(<DevHome state="audience" earnedCents={0} />);
    const sheet = screen.getByRole("dialog", { name: "Audience" });
    fireEvent.click(within(sheet).getByRole("button", { name: "@creator_two" }));
    expect(audienceLine()).toHaveTextContent(/^For @creator_two$/);
  });

  it("general: the general audience, For a general audience", () => {
    render(<DevHome state="general" earnedCents={0} />);
    expect(audienceLine()).toHaveTextContent(/^For a general audience$/);
    expect(audienceLine()).toHaveAccessibleName("For a general audience, change audience");
  });
});
