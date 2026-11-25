/** @vitest-environment happy-dom */
/**
 * YouScreen (plan 2026-11-24-you, Task 4), rendered for real: the rows, their editors, the cards and
 * the shell store's title. The handlers are the container's seam (promises the test resolves); no
 * module of ours is stood in for. The flag is on (the new look's Card).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { YouFactKey } from "@/lib/you/facts";
import { useShellStore } from "@/stores/shell-store";
import { YouScreen, type YouAccountRow, type YouScreenProps } from "../you-screen";

const NONE = { about: null, sells: null, writing_voice_description: null, can_film: null, never_do: null };
const TOLD = {
  about: "Nursing student, cooks for four flatmates.",
  sells: "A 12-week meal plan, $19.",
  writing_voice_description: "Dry, short sentences.",
  can_film: "Phone only, my kitchen.",
  never_do: "No giveaways.",
};
// An account row's second line is the platform's name alone (rulings 4 and 10).
const TIKTOK: YouAccountRow = { id: "a1", platform: "tiktok", handle: "nia.tests", primary: true, line: "TikTok" };
const INSTAGRAM: YouAccountRow = { id: "a2", platform: "instagram", handle: "nia.tests.kitchen", primary: false, line: "Instagram" };

/** A promise the test settles by hand. */
function later<T>() {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (settle = resolve));
  return { promise, settle };
}

function props(over: Partial<YouScreenProps> = {}): YouScreenProps {
  return {
    state: "ready",
    onRetry: vi.fn(),
    who: { name: "Nia Test", initials: "NT", avatar: null, line: "@nia.tests · 12.4K followers" },
    read: { what: "Budget meal prep for students.", how: "Fast, friendly, talks to camera.", foot: "Read from @nia.tests, 3 days ago" },
    facts: TOLD,
    niche: { primary: "food-cooking", sub: "meal-prep" },
    goal: "conversion",
    accounts: [TIKTOK, INSTAGRAM],
    accountsState: "ready",
    accountsNotice: null,
    onRetryAccounts: vi.fn(),
    onSaveFact: vi.fn(async () => true),
    onSaveNiche: vi.fn(async () => true),
    onSaveGoal: vi.fn(async () => true),
    onSaveName: vi.fn(async () => true),
    onPhoto: vi.fn(async () => null),
    onConnect: vi.fn(async () => null),
    ...over,
  };
}

const rowButton = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\b`) });
const field = (name: string) => screen.getByRole("textbox", { name });
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const readSection = () => screen.getByRole("heading", { name: "From your account" }).parentElement!;
/** A click as a pointer gives it: the control takes the focus first. */
const press = (el: HTMLElement) => {
  el.focus();
  fireEvent.click(el);
};

afterEach(() => {
  cleanup();
  useShellStore.setState({ pushedTitle: "" });
});

describe("YouScreen: what it shows", () => {
  it("names the screen in the phone's header, and once on the page; the name goes on the way out", () => {
    const { unmount } = render(<YouScreen {...props()} />);
    expect(useShellStore.getState().pushedTitle).toBe("You");
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["You"]);
    unmount();
    expect(useShellStore.getState().pushedTitle).toBe("");
  });

  it("the sections in the spec's order", () => {
    render(<YouScreen {...props()} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["From your account", "In your words", "Accounts"]);
  });

  it("who: the name and the primary account's line, one button that opens name and photo", () => {
    render(<YouScreen {...props()} />);
    const who = screen.getByRole("button", { name: /^Edit name and photo: Nia Test/ });
    expect(who).toHaveTextContent("@nia.tests · 12.4K followers");
    // The initials are drawn, not read: they would come before the button's name.
    expect(who).toHaveAccessibleName("Edit name and photo: Nia Test @nia.tests · 12.4K followers");
  });

  it("what Maven read: the sentence, the line, the foot, and the line under the card", () => {
    render(<YouScreen {...props()} />);
    const card = readSection();
    expect(card).toHaveTextContent("Budget meal prep for students.");
    expect(card).toHaveTextContent("Fast, friendly, talks to camera.");
    expect(card).toHaveTextContent("Read from @nia.tests, 3 days ago");
    expect(card).toHaveTextContent("Something off? Say it below. Your words win.");
    expect(within(card).queryByRole("link")).toBeNull();
  });

  it("a read whose account is no longer listed: the read card as it is, with its own handle, and no connect card", () => {
    const read = { what: "Budget meal prep for students.", how: null, foot: "Read from @nia.tests.old, 2 weeks ago" };
    render(<YouScreen {...props({ read, accounts: [] })} />);
    expect(readSection()).toHaveTextContent("Read from @nia.tests.old, 2 weeks ago");
    expect(screen.queryByText(/^Connect your account/)).toBeNull();
  });

  it("no account: one line and Connect, no Accounts section; Connect opens the form in that card, focus in the handle", () => {
    render(<YouScreen {...props({ read: null, accounts: [] })} />);
    expect(screen.queryByRole("heading", { name: "From your account" })).toBeNull();
    // The drawing's middle phone: no Accounts heading and no "Connect an account" row.
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Connect an account" })).toBeNull();
    expect(screen.getByText("Connect your account. Maven reads what you make and writes like it.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(field("TikTok @handle")).toHaveFocus();
    // In place, in the top card: above "In your words".
    const words = screen.getByRole("heading", { name: "In your words" });
    expect(field("TikTok @handle").compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("group", { name: "Platform" })).toBeInTheDocument();
    // One control named "Connect": the form's own.
    expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(1);
  });

  it("no account: Cancel and Escape close the card's form and give the focus back to its Connect", () => {
    render(<YouScreen {...props({ read: null, accounts: [] })} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    type("TikTok @handle", "nia");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "TikTok @handle" })).toBeNull();
    expect(screen.getByText(/^Connect your account/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(field("TikTok @handle")).toHaveValue("");
    fireEvent.keyDown(field("TikTok @handle"), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Connect" })).toHaveFocus();
  });

  it("no account: a connect that went through, and the first account arriving after, hands the focus to the new Accounts' Connect an account", async () => {
    const p = props({ read: null, accounts: [] });
    const { rerender } = render(<YouScreen {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    type("TikTok @handle", "@nia.tests");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect" })));
    expect(p.onConnect).toHaveBeenCalledWith("tiktok", "nia.tests");
    // The list has not answered yet: the card is back, closed, with the focus on its Connect.
    expect(screen.getByRole("button", { name: "Connect" })).toHaveFocus();
    rerender(<YouScreen {...p} accounts={[TIKTOK]} />);
    expect(screen.queryByText(/^Connect your account/)).toBeNull();
    expect(screen.getByRole("heading", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
  });

  it("the last account leaving, nothing read: the focus goes to the card's Connect", () => {
    const p = props({ read: null, accounts: [TIKTOK] });
    const { rerender } = render(<YouScreen {...p} />);
    (document.activeElement as HTMLElement | null)?.blur();
    rerender(<YouScreen {...p} accounts={[]} />);
    expect(screen.getByRole("button", { name: "Connect" })).toHaveFocus();
  });

  it("a read and no account: the read card, no Accounts section, and one quiet row Connect an account that opens the form in place", () => {
    render(<YouScreen {...props({ accounts: [] })} />);
    expect(readSection()).toHaveTextContent("Read from @nia.tests, 3 days ago");
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
    // Never together with the card's Connect.
    expect(screen.queryByText(/^Connect your account/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
    const row = screen.getByRole("button", { name: "Connect an account" });
    // Under the cards: after "In your words", before Settings.
    expect(screen.getByRole("heading", { name: "In your words" }).compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.compareDocumentPosition(screen.getByRole("link", { name: "Settings" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(row);
    expect(field("TikTok @handle")).toHaveFocus();
    expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
  });

  it.each<[string, Partial<YouScreenProps>]>([
    ["accounts and a read", {}],
    ["accounts, nothing read", { read: null }],
    ["no account, nothing read", { read: null, accounts: [] }],
    ["a read, no account", { accounts: [] }],
  ])("one control named Connect at most, closed and open: %s", (_, over) => {
    const { unmount } = render(<YouScreen {...props(over)} />);
    expect(screen.queryAllByRole("button", { name: "Connect" }).length).toBeLessThanOrEqual(1);
    unmount();
    render(<YouScreen {...props({ ...over, initial: { open: "connect" } })} />);
    expect(field("TikTok @handle")).toHaveFocus();
    expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(1);
  });

  it("an account Maven has not read yet: the line with the primary account's handle and one link, Set up audience", () => {
    // The primary is listed second here: the line names it, not the first row.
    render(<YouScreen {...props({ read: null, accounts: [INSTAGRAM, TIKTOK] })} />);
    const card = readSection();
    expect(card).toHaveTextContent("Maven hasn't read @nia.tests yet. It reads an account when you set up its audience.");
    expect(within(card).getAllByRole("link")).toHaveLength(1);
    expect(within(card).getByRole("link", { name: "Set up audience" })).toHaveAttribute("href", "/audience/new");
    // Nothing was read, so nothing to correct below, and nothing to connect.
    expect(card).not.toHaveTextContent("Something off?");
    expect(screen.queryByText(/^Connect your account/)).toBeNull();
  });

  it("in your words: the seven rows in order, saved values or Add", () => {
    const { rerender } = render(<YouScreen {...props()} />);
    const list = within(screen.getByRole("heading", { name: "In your words" }).parentElement!).getAllByRole("button");
    expect(list.map((b) => b.textContent)).toEqual([
      "Niche Food & Cooking · Meal Prep",
      `About you ${TOLD.about}`,
      `What you sell ${TOLD.sells}`,
      `How you sound ${TOLD.writing_voice_description}`,
      `What you can film ${TOLD.can_film}`,
      `Never ${TOLD.never_do}`,
      "Goal Sell",
    ]);
    rerender(<YouScreen {...props({ facts: NONE, niche: { primary: null, sub: null }, goal: null })} />);
    const empty = within(screen.getByRole("heading", { name: "In your words" }).parentElement!).getAllByRole("button");
    expect(empty.every((b) => b.textContent!.endsWith(" Add"))).toBe(true);
    // No banner, no meter (spec §3.3).
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("accounts: a row each, Primary on the primary only, the platform's name, then Connect an account; Settings at the foot", () => {
    render(<YouScreen {...props({ renderAccountMenu: (a) => <button type="button">{`More: @${a.handle}`}</button> })} />);
    const section = screen.getByRole("heading", { name: "Accounts" }).parentElement!;
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("@nia.testsPrimary");
    // The second line is the platform's name, whole (no "synced …").
    expect(within(items[0]!).getByText("TikTok")).toBeInTheDocument();
    expect(items[0]).not.toHaveTextContent("synced");
    expect(within(items[0]!).getByRole("button", { name: "More: @nia.tests" })).toBeInTheDocument();
    expect(items[1]).not.toHaveTextContent("Primary");
    expect(within(items[1]!).getByText("Instagram")).toBeInTheDocument();
    expect(within(items[2]!).getByRole("button", { name: "Connect an account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  // Plan 2026-11-24-earn (ruling 10): the last card holds Earn, then Settings; Earn says its name alone.
  it("the last card: Earn above Settings, the page's last links", () => {
    render(<YouScreen {...props()} />);
    const links = screen.getAllByRole("link");
    expect(links.slice(-2).map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Earn", "/earn"],
      ["Settings", "/settings"],
    ]);
    expect(links.at(-2)!.closest("ul")).toBe(links.at(-1)!.closest("ul"));
  });

  it("without renderAccountMenu an account row has no More", () => {
    render(<YouScreen {...props()} />);
    const items = within(screen.getByRole("heading", { name: "Accounts" }).parentElement!).getAllByRole("listitem");
    expect(within(items[0]!).queryByRole("button")).toBeNull();
  });

  it("accounts that did not load: the line and Try again; no connect card and no not-read card is offered blind", () => {
    const p = props({ accountsState: "error", accounts: [], read: null });
    render(<YouScreen {...p} />);
    expect(screen.getByText("Couldn't load your accounts.")).toBeInTheDocument();
    expect(screen.queryByText(/^Connect your account/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "From your account" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(p.onRetryAccounts).toHaveBeenCalledTimes(1);
  });

  it("accounts that load on Try again: the focus goes to Connect an account, not to the page", () => {
    const p = props({ accountsState: "error", accounts: [], read: null });
    const { rerender } = render(<YouScreen {...p} />);
    press(screen.getByRole("button", { name: "Try again" }));
    rerender(<YouScreen {...p} accountsState="ready" accounts={[TIKTOK]} />);
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
  });

  it("a notice under Accounts is announced", () => {
    render(<YouScreen {...props({ accountsNotice: "Couldn't save. Try again." })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't save. Try again.");
  });

  it("loading: the header and quiet placeholders, busy, no rows", () => {
    render(<YouScreen {...props({ state: "loading" })} />);
    expect(screen.getByRole("heading", { level: 1, name: "You" })).toBeInTheDocument();
    expect(screen.getByTestId("you-next").querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a page that did not load says so and tries again", () => {
    const p = props({ state: "error" });
    render(<YouScreen {...p} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this page.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(p.onRetry).toHaveBeenCalledTimes(1);
  });

  it("a page that loads on Try again puts the focus on its first control, not the page", () => {
    const p = props({ state: "error" });
    const { rerender } = render(<YouScreen {...p} />);
    press(screen.getByRole("button", { name: "Try again" }));
    rerender(<YouScreen {...p} state="loading" />);
    rerender(<YouScreen {...p} state="ready" />);
    expect(screen.getByRole("button", { name: /^Edit name and photo/ })).toHaveFocus();
  });

  it("has no axe violations: closed, with a row open, the editors, and each card", async () => {
    const { container, rerender } = render(<YouScreen {...props()} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    rerender(<YouScreen {...props({ initial: { open: "sells", draft: "A plan", failed: true } })} key="open" />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    rerender(<YouScreen {...props({ initial: { open: "who", failed: true } })} key="who" />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    rerender(<YouScreen {...props({ read: null, accounts: [], initial: { open: "connect" } })} key="connect" />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    rerender(<YouScreen {...props({ read: null })} key="not-read" />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    rerender(<YouScreen {...props({ accounts: [], initial: { open: "connect" } })} key="read-no-account" />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("YouScreen: rows open in place, one at a time", () => {
  it("opening a row closes the open one and keeps its draft; reopening shows it", () => {
    render(<YouScreen {...props({ facts: NONE })} />);
    fireEvent.click(rowButton("About you"));
    type("About you", "Nurse");
    fireEvent.click(rowButton("Never"));
    expect(screen.queryByRole("textbox", { name: "About you" })).toBeNull();
    expect(field("Never")).toHaveFocus();
    fireEvent.click(rowButton("About you"));
    expect(field("About you")).toHaveValue("Nurse");
  });

  it("Cancel and Escape drop the draft, close, and give the focus back to the row", () => {
    render(<YouScreen {...props()} />);
    fireEvent.click(rowButton("About you"));
    type("About you", "Something else");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(rowButton("About you")).toHaveFocus();
    fireEvent.click(rowButton("About you"));
    expect(field("About you")).toHaveValue(TOLD.about);
    fireEvent.keyDown(field("About you"), { key: "Escape" });
    expect(rowButton("About you")).toHaveFocus();
  });

  it("leaving the page drops the drafts", () => {
    const { unmount } = render(<YouScreen {...props()} />);
    fireEvent.click(rowButton("About you"));
    type("About you", "Draft that goes");
    unmount();
    render(<YouScreen {...props()} />);
    fireEvent.click(rowButton("About you"));
    expect(field("About you")).toHaveValue(TOLD.about);
  });

  it("name and photo: Escape anywhere in it closes it, and the focus goes back to Who", () => {
    render(<YouScreen {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    type("Name", "Someone else");
    fireEvent.keyDown(screen.getByRole("button", { name: "Change photo" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    const who = screen.getByRole("button", { name: /^Edit name and photo/ });
    expect(who).toHaveFocus();
    fireEvent.click(who);
    expect(field("Name")).toHaveValue("Nia Test");
  });

  it("connect: Escape drops the handle and the platform, and the focus goes back to Connect an account", () => {
    render(<YouScreen {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    fireEvent.click(screen.getByRole("button", { name: "YouTube" }));
    type("YouTube @handle", "nia");
    fireEvent.keyDown(field("YouTube @handle"), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    expect(field("TikTok @handle")).toHaveValue("");
  });
});

describe("YouScreen: saving", () => {
  it("Save sends the one key, trimmed; the row stays open while it is out, then closes on the new text", async () => {
    const pending = later<boolean>();
    const onSaveFact = vi.fn(() => pending.promise);
    render(<YouScreen {...props({ facts: NONE, onSaveFact })} />);
    fireEvent.click(rowButton("What you sell"));
    type("What you sell", "  A 12-week meal plan.  ");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveFact).toHaveBeenCalledWith("sells", "A 12-week meal plan.");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-busy", "true");
    // Nothing else opens while a save is out.
    fireEvent.click(rowButton("Never"));
    expect(screen.queryByRole("textbox", { name: "Never" })).toBeNull();
    await act(async () => pending.settle(true));
    expect(screen.queryByRole("textbox", { name: "What you sell" })).toBeNull();
    expect(rowButton("What you sell")).toHaveFocus();
  });

  it("a refused save: the row stays open, the text kept, the line shown; Save again tries again", async () => {
    const onSaveFact = vi.fn(async () => false);
    render(<YouScreen {...props({ facts: NONE, onSaveFact })} />);
    fireEvent.click(rowButton("Never"));
    type("Never", "No giveaways.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(field("Never")).toHaveValue("No giveaways.");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(onSaveFact).toHaveBeenCalledTimes(2);
  });

  it("a blank text saves null; an unchanged one sends nothing", async () => {
    const onSaveFact = vi.fn(async () => true);
    render(<YouScreen {...props({ onSaveFact })} />);
    fireEvent.click(rowButton("About you"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveFact).not.toHaveBeenCalled();
    expect(rowButton("About you")).toHaveFocus();
    fireEvent.click(rowButton("About you"));
    type("About you", "   ");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(onSaveFact).toHaveBeenCalledWith("about", null);
  });

  it("niche: a tap saves both columns and closes; the saved one only closes", async () => {
    const onSaveNiche = vi.fn(async () => true);
    render(<YouScreen {...props({ onSaveNiche })} />);
    fireEvent.click(rowButton("Niche"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Beauty · Makeup" })));
    expect(onSaveNiche).toHaveBeenCalledWith("beauty", "makeup");
    expect(rowButton("Niche")).toHaveFocus();
    fireEvent.click(rowButton("Niche"));
    fireEvent.click(screen.getByRole("button", { name: "Food & Cooking · Meal Prep" }));
    expect(onSaveNiche).toHaveBeenCalledTimes(1);
  });

  it("goal: a chip saves it", async () => {
    const onSaveGoal = vi.fn(async () => true);
    render(<YouScreen {...props({ onSaveGoal })} />);
    fireEvent.click(rowButton("Goal"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Grow" })));
    expect(onSaveGoal).toHaveBeenCalledWith("growth");
    expect(rowButton("Goal")).toHaveFocus();
  });

  it("name: saved trimmed; an empty name is not sent", async () => {
    const onSaveName = vi.fn(async () => true);
    render(<YouScreen {...props({ onSaveName })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    expect(field("Name")).toHaveValue("Nia Test");
    type("Name", "   ");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveName).not.toHaveBeenCalled();
    type("Name", " Nia T ");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(onSaveName).toHaveBeenCalledWith("Nia T");
  });

  it("name: with no saved name the heading shows the stand-in, and the field opens empty with it as the placeholder", async () => {
    const onSaveName = vi.fn(async () => true);
    const who = { name: "nia@example.com", unnamed: true, initials: "N", avatar: null, line: "@nia.tests · 12.4K followers" };
    render(<YouScreen {...props({ who, onSaveName })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo: nia@example\.com @nia\.tests/ }));
    expect(field("Name")).toHaveValue("");
    expect(field("Name")).toHaveAttribute("placeholder", "nia@example.com");
    expect(field("Name")).toHaveFocus();
    // Empty: nothing is sent, by Save or by Enter.
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.keyDown(field("Name"), { key: "Enter" });
    expect(onSaveName).not.toHaveBeenCalled();
    // The stand-in typed as it is is a name the creator chose: sent.
    type("Name", "nia@example.com");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(onSaveName).toHaveBeenCalledWith("nia@example.com");
  });

  it("name: a saved name has no placeholder", () => {
    render(<YouScreen {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    expect(field("Name")).toHaveValue("Nia Test");
    expect(field("Name")).not.toHaveAttribute("placeholder");
  });

  it("name: the field is read-only while its save is out, as a fact's is", async () => {
    const pending = later<boolean>();
    render(<YouScreen {...props({ onSaveName: vi.fn(() => pending.promise) })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    type("Name", "Nia T");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(field("Name")).toHaveAttribute("readonly");
    await act(async () => pending.settle(false));
    expect(field("Name")).not.toHaveAttribute("readonly");
  });

  it("photo: a chosen file is sent at once; a refusal is shown", async () => {
    const onPhoto = vi.fn(async () => "File too large. Maximum size is 2MB.");
    const { container } = render(<YouScreen {...props({ onPhoto })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    const file = new File(["x"], "me.png", { type: "image/png" });
    await act(async () => fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } }));
    expect(onPhoto).toHaveBeenCalledWith(file);
    expect(screen.getByRole("alert")).toHaveTextContent("File too large. Maximum size is 2MB.");
  });

  it("connect: platform, handle without its @, Reading while it is out; a refusal is shown, success closes", async () => {
    const pending = later<string | null>();
    const onConnect = vi.fn(() => pending.promise);
    render(<YouScreen {...props({ onConnect })} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    type("Instagram @handle", "@nia.tests.kitchen");
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(onConnect).toHaveBeenCalledWith("instagram", "nia.tests.kitchen");
    expect(screen.getByRole("button", { name: "Reading @nia.tests.kitchen…" })).toHaveAttribute("aria-busy", "true");
    await act(async () => pending.settle("We couldn't read that account. Check the handle and try again."));
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't read that account. Check the handle and try again.");
    onConnect.mockResolvedValueOnce(null);
    await act(async () => fireEvent.keyDown(field("Instagram @handle"), { key: "Enter" }));
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
  });

  it("an account that leaves hands the focus on to Connect an account", () => {
    const p = props();
    const { rerender } = render(<YouScreen {...p} />);
    (document.activeElement as HTMLElement | null)?.blur();
    rerender(<YouScreen {...p} accounts={p.accounts.slice(0, 1)} />);
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
  });

  it("opens as /dev/you asks: a row open with its draft and a failed save's line", () => {
    render(<YouScreen {...props({ initial: { open: "writing_voice_description", draft: "Dry.", failed: true } })} />);
    expect(field("How you sound")).toHaveValue("Dry.");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });
});

describe("YouScreen: a handler that rejects (a dropped request) does not hold the page", () => {
  const dropped = () => Promise.reject(new TypeError("Failed to fetch"));

  it("a save that rejects: the row stays open with its text and the failure line, and the page is free again", async () => {
    const onSaveFact = vi.fn(dropped);
    render(<YouScreen {...props({ facts: NONE, onSaveFact })} />);
    fireEvent.click(rowButton("What you sell"));
    type("What you sell", "A plan.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(field("What you sell")).toHaveValue("A plan.");
    expect(field("What you sell")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    fireEvent.click(rowButton("Never"));
    expect(field("Never")).toHaveFocus();
  });

  it("a connect that rejects: the dropped-request sentence, the handle kept, and the page is free again", async () => {
    const onConnect = vi.fn(dropped);
    render(<YouScreen {...props({ onConnect })} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    type("TikTok @handle", "nia.tests");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't connect. Check your connection and try again.");
    expect(screen.getByRole("button", { name: "Connect" })).not.toHaveAttribute("aria-busy");
    expect(field("TikTok @handle")).toHaveValue("nia.tests");
    fireEvent.click(rowButton("Never"));
    expect(field("Never")).toHaveFocus();
  });

  it("a photo that rejects: the failure line, Change photo works again, and the line stays with Who while another row is open", async () => {
    const onPhoto = vi.fn(dropped);
    const { container } = render(<YouScreen {...props({ onPhoto })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    const file = new File(["x"], "me.png", { type: "image/png" });
    const picker = () => container.querySelector('input[type="file"]')!;
    await act(async () => fireEvent.change(picker(), { target: { files: [file] } }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    expect(screen.getByRole("button", { name: "Change photo" })).not.toHaveAttribute("aria-busy");
    await act(async () => fireEvent.change(picker(), { target: { files: [file] } }));
    expect(onPhoto).toHaveBeenCalledTimes(2);
    fireEvent.click(rowButton("Never"));
    expect(field("Never")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });
});

describe("YouScreen: while a save is out, and after it", () => {
  it("a second Save, Cancel and Escape while a save is out are ignored, and the field is held", async () => {
    const pending = later<boolean>();
    const onSaveFact = vi.fn(() => pending.promise);
    render(<YouScreen {...props({ facts: NONE, onSaveFact })} />);
    fireEvent.click(rowButton("Never"));
    type("Never", "No giveaways.");
    press(screen.getByRole("button", { name: "Save" }));
    press(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(field("Never"), { key: "Escape" });
    expect(onSaveFact).toHaveBeenCalledTimes(1);
    expect(field("Never")).toHaveValue("No giveaways.");
    expect(field("Never")).toHaveAttribute("readonly");
    await act(async () => pending.settle(true));
    expect(onSaveFact).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox", { name: "Never" })).toBeNull();
  });

  it("after a save that went through the draft is gone: reopened, the row shows what the parent now holds", async () => {
    // As the container will: the saved value comes back down as the prop.
    function Parent() {
      const [facts, setFacts] = useState<Record<YouFactKey, string | null>>(NONE);
      const onSaveFact = async (key: YouFactKey, value: string | null) => {
        setFacts((f) => ({ ...f, [key]: value }));
        return true;
      };
      return <YouScreen {...props({ facts, onSaveFact })} />;
    }
    render(<Parent />);
    fireEvent.click(rowButton("About you"));
    type("About you", "  Nurse, two kids.  ");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(rowButton("About you")).toHaveTextContent("Nurse, two kids.");
    fireEvent.click(rowButton("About you"));
    // The saved, trimmed value: not the draft as typed.
    expect(field("About you")).toHaveValue("Nurse, two kids.");
  });

  it("no leak between rows: what is typed in one row is not in the next one opened", () => {
    const { unmount } = render(<YouScreen {...props({ facts: NONE })} />);
    fireEvent.click(rowButton("About you"));
    type("About you", "Nurse");
    fireEvent.click(rowButton("What you sell"));
    expect(field("What you sell")).toHaveValue("");
    fireEvent.click(rowButton("Never"));
    expect(field("Never")).toHaveValue("");
    unmount();
    render(<YouScreen {...props()} />);
    fireEvent.click(rowButton("About you"));
    type("About you", "Nurse");
    fireEvent.click(rowButton("What you sell"));
    expect(field("What you sell")).toHaveValue(TOLD.sells);
  });

  it("after a refused save pressed on Save, the focus stays on Save, with the line", async () => {
    const onSaveFact = vi.fn(async () => false);
    render(<YouScreen {...props({ facts: NONE, onSaveFact })} />);
    fireEvent.click(rowButton("Never"));
    type("Never", "No giveaways.");
    const save = screen.getByRole("button", { name: "Save" });
    await act(async () => press(save));
    expect(save).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });

  it("after a refused save sent with Enter, the focus stays in the name field", async () => {
    render(<YouScreen {...props({ onSaveName: vi.fn(async () => false) })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    type("Name", "Nia T");
    await act(async () => fireEvent.keyDown(field("Name"), { key: "Enter" }));
    expect(field("Name")).toHaveFocus();
    expect(field("Name")).toHaveValue("Nia T");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });

  it("after a refused goal pressed on its chip, the focus stays on the chip, with the line", async () => {
    render(<YouScreen {...props({ onSaveGoal: vi.fn(async () => false) })} />);
    fireEvent.click(rowButton("Goal"));
    const grow = screen.getByRole("button", { name: "Grow" });
    await act(async () => press(grow));
    expect(grow).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });
});

describe("YouScreen: a connect in flight holds only its own form", () => {
  /** Opens the connect form, types a handle and sends it; the connect stays out until `settle`. */
  function startConnect(over: Partial<YouScreenProps> = {}) {
    const pending = later<string | null>();
    const onConnect = vi.fn(() => pending.promise);
    const onSaveFact = vi.fn(async () => true);
    render(<YouScreen {...props({ facts: NONE, onConnect, onSaveFact, ...over })} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    type("TikTok @handle", "nia.tests");
    press(screen.getByRole("button", { name: "Connect" }));
    return { pending, onConnect, onSaveFact };
  }

  it("the connect form's field and buttons wait: Cancel, Escape, a platform and a second Connect do nothing", () => {
    const { onConnect } = startConnect();
    const reading = screen.getByRole("button", { name: "Reading @nia.tests…" });
    expect(reading).toHaveAttribute("aria-busy", "true");
    expect(field("TikTok @handle")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(field("TikTok @handle"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    press(reading);
    fireEvent.keyDown(field("TikTok @handle"), { key: "Enter" });
    expect(field("TikTok @handle")).toHaveValue("nia.tests");
    expect(screen.getByRole("button", { name: "TikTok" })).toHaveAttribute("aria-pressed", "true");
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("every other row opens, saves and cancels as usual meanwhile", async () => {
    const { onSaveFact } = startConnect();
    fireEvent.click(rowButton("Never"));
    expect(field("Never")).toHaveFocus();
    expect(field("Never")).not.toHaveAttribute("readonly");
    type("Never", "No giveaways.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(onSaveFact).toHaveBeenCalledWith("never_do", "No giveaways.");
    expect(screen.queryByRole("textbox", { name: "Never" })).toBeNull();
    fireEvent.click(rowButton("About you"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "About you" })).toBeNull();
    expect(rowButton("About you")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    expect(field("Name")).toHaveFocus();
  });

  it("a second connect cannot start: reopened, the form is still reading, with its handle", () => {
    const { onConnect } = startConnect();
    fireEvent.click(rowButton("Goal"));
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    expect(field("TikTok @handle")).toHaveValue("nia.tests");
    expect(field("TikTok @handle")).toHaveAttribute("readonly");
    press(screen.getByRole("button", { name: "Reading @nia.tests…" }));
    fireEvent.keyDown(field("TikTok @handle"), { key: "Enter" });
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("a connect that goes through while another row is open leaves that row open; the connect's handle is gone", async () => {
    const { pending } = startConnect();
    fireEvent.click(rowButton("Never"));
    type("Never", "No give");
    await act(async () => pending.settle(null));
    expect(field("Never")).toHaveValue("No give");
    expect(field("Never")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    expect(field("TikTok @handle")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Connect" })).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a connect refused while another row is open: that row stays open; reopened, the form has its handle and the message", async () => {
    const line = "We couldn't read that account. Check the handle and try again.";
    const { pending, onConnect } = startConnect();
    fireEvent.click(rowButton("About you"));
    await act(async () => pending.settle(line));
    expect(field("About you")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    expect(field("TikTok @handle")).toHaveValue("nia.tests");
    expect(field("TikTok @handle")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("alert")).toHaveTextContent(line);
    onConnect.mockResolvedValueOnce(null);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect" })));
    expect(onConnect).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
  });

  it("with no account, the card's form waits the same way, and the rows open", () => {
    const pending = later<string | null>();
    render(<YouScreen {...props({ accounts: [], read: null, onConnect: vi.fn(() => pending.promise) })} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    type("TikTok @handle", "nia.tests");
    press(screen.getByRole("button", { name: "Connect" }));
    expect(screen.getByRole("button", { name: "Reading @nia.tests…" })).toHaveAttribute("aria-busy", "true");
    fireEvent.click(rowButton("What you sell"));
    expect(field("What you sell")).toHaveFocus();
  });
});

describe("YouScreen: a failure stays with its row", () => {
  it("a refused row keeps its line while another row is open: reopened, its text and the line; Cancel drops both", async () => {
    render(<YouScreen {...props({ facts: NONE, onSaveFact: vi.fn(async () => false) })} />);
    fireEvent.click(rowButton("Never"));
    type("Never", "No giveaways.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    fireEvent.click(rowButton("About you"));
    // The other row's own state: no line there.
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(rowButton("Never"));
    expect(field("Never")).toHaveValue("No giveaways.");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(rowButton("Never"));
    expect(field("Never")).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a refused connect keeps its message while another row is open", async () => {
    const line = "We couldn't read that account. Check the handle and try again.";
    render(<YouScreen {...props({ onConnect: vi.fn(async () => line) })} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    type("Instagram @handle", "nia.tests.kitchen");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect" })));
    fireEvent.click(rowButton("Never"));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    expect(field("Instagram @handle")).toHaveValue("nia.tests.kitchen");
    expect(screen.getByRole("alert")).toHaveTextContent(line);
  });
});
