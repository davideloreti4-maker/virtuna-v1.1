/** @vitest-environment happy-dom */
/**
 * /dev/you's fixtures, rendered for real: each `?state=` shows what its line in `page.tsx` says, on
 * local state. `fetch` (the one way out) is a stand-in that refuses, so a request from any state
 * would fail the test; the saves answer from local state after 400 ms (fake timers). An account's
 * More takes `matchMedia` as a phone's, and the page's clock (`performance.now`: the confirming
 * Disconnect waits 500 ms).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { useShellStore } from "@/stores/shell-store";
import { DevYou } from "../dev-you";

const fetchSpy = vi.fn(() => Promise.reject(new Error("/dev/you sends nothing")));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchSpy.mockClear();
  useShellStore.setState({ pushedTitle: "" });
});

const words = () => within(screen.getByRole("heading", { name: "In your words" }).parentElement!).getAllByRole("button");
const accountRows = () => within(screen.getByRole("heading", { name: "Accounts" }).parentElement!).getAllByRole("listitem");
const who = () => screen.getByRole("button", { name: /^Edit name and photo: Nia Test/ });

describe("/dev/you's states", () => {
  it("full: everything told, two accounts, the read", () => {
    render(<DevYou state="full" />);
    expect(who()).toHaveTextContent("@nia.tests · 12.4K followers");
    expect(screen.getByRole("heading", { name: "From your account" }).parentElement).toHaveTextContent("Read from @nia.tests, 3 days ago");
    expect(words().some((b) => b.textContent!.endsWith(" Add"))).toBe(false);
    const rows = accountRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("@nia.testsPrimary");
    expect(within(rows[0]!).getByText("TikTok")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Instagram")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("empty: nothing told, no account, the connect card, and no Accounts section (the drawing's middle phone)", () => {
    render(<DevYou state="empty" />);
    expect(who()).toHaveTextContent("No account connected");
    expect(screen.getByText(/^Connect your account/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "From your account" })).toBeNull();
    expect(words().every((b) => b.textContent!.endsWith(" Add"))).toBe(true);
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Connect an account" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no-account: everything told, no account, no Accounts section", () => {
    render(<DevYou state="no-account" />);
    expect(who()).toHaveTextContent("No account connected");
    expect(screen.getByText(/^Connect your account/)).toBeInTheDocument();
    expect(words().some((b) => b.textContent!.endsWith(" Add"))).toBe(false);
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
  });

  it("read-no-account: everything told, a read, every account disconnected: one quiet Connect an account row", () => {
    render(<DevYou state="read-no-account" />);
    expect(who()).toHaveTextContent("No account connected");
    expect(screen.getByRole("heading", { name: "From your account" }).parentElement).toHaveTextContent("Read from @nia.tests, 3 days ago");
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
    expect(screen.queryByText(/^Connect your account/)).toBeNull();
    expect(screen.getByRole("button", { name: "Connect an account" })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("read: nothing told, one account with a read", () => {
    render(<DevYou state="read" />);
    expect(screen.getByRole("heading", { name: "From your account" }).parentElement).toHaveTextContent("Budget meal prep for students");
    expect(words().every((b) => b.textContent!.endsWith(" Add"))).toBe(true);
    expect(accountRows()).toHaveLength(2);
  });

  it("not-read: one account Maven has not read yet", () => {
    render(<DevYou state="not-read" />);
    const card = screen.getByRole("heading", { name: "From your account" }).parentElement!;
    expect(card).toHaveTextContent("Maven hasn't read @nia.tests yet. It reads an account when you set up its audience.");
    expect(within(card).getByRole("link", { name: "Set up audience" })).toHaveAttribute("href", "/audience/new");
    expect(accountRows()).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("open: the drawing's middle phone, How you sound open with its text", () => {
    render(<DevYou state="open" />);
    expect(screen.getByRole("textbox", { name: "How you sound" })).toHaveValue('Dry, short sentences, a bit of swearing. Never say "guys".');
    // 58 characters (the drawing's "57 / 200" was drawn by eye).
    expect(screen.getByText("58 / 200")).toBeInTheDocument();
    expect(screen.getByText(/^Connect your account/)).toBeInTheDocument();
  });

  it("failed: What you sell open after a refused save; a save there is refused again", async () => {
    vi.useFakeTimers();
    render(<DevYou state="failed" />);
    expect(screen.getByRole("textbox", { name: "What you sell" })).toHaveValue("A 12-week meal plan, $19. Two blender brands.");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.getByRole("textbox", { name: "What you sell" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a save in a state that takes them goes through on local state", async () => {
    vi.useFakeTimers();
    render(<DevYou state="empty" />);
    fireEvent.click(screen.getByRole("button", { name: /^Never\b/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Never" }), { target: { value: "No giveaways." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.getByRole("button", { name: /^Never\b/ })).toHaveTextContent("No giveaways.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a connect from the card adds the account on local state: Accounts appears with the focus on Connect an account, Maven has not read it", async () => {
    vi.useFakeTimers();
    render(<DevYou state="empty" />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    fireEvent.change(screen.getByRole("textbox", { name: "TikTok @handle" }), { target: { value: "@nia.tests" } });
    // The form's own Connect, in the card (the card's Connect gave way to it).
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(accountRows()[0]).toHaveTextContent("@nia.testsPrimary");
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
    expect(who()).toHaveTextContent("@nia.tests");
    expect(screen.getByRole("heading", { name: "From your account" }).parentElement).toHaveTextContent("Maven hasn't read @nia.tests yet.");
    expect(screen.queryByText(/^Connect your account/)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loading: the placeholders, busy", () => {
    render(<DevYou state="loading" />);
    expect(screen.getByTestId("you-next").querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("signup: the anonymous visitor's card, no control", () => {
    render(<DevYou state="signup" />);
    expect(screen.getByText("Create an account to tell Maven about you.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(useShellStore.getState().pushedTitle).toBe("You");
  });
});

/** `matchMedia` as a phone answers it (under 768): an account's More opens a bottom sheet. */
const phone = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const confirmingDisconnect = () => screen.getAllByRole("button", { name: "Disconnect" }).at(-1)!;

describe("/dev/you: an account's More, on local state", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation(phone);
  });
  afterEach(() => vi.restoreAllMocks());

  it("full: Make primary moves the mark and the row first; Disconnect, asked twice, takes the row away; nothing is sent", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    render(<DevYou state="full" />);
    fireEvent.click(screen.getByRole("button", { name: "More: @nia.tests.kitchen" }));
    fireEvent.click(screen.getByRole("button", { name: "Make primary" }));
    await settle();
    expect(accountRows()[0]).toHaveTextContent("@nia.tests.kitchenPrimary");
    expect(accountRows()[1]).not.toHaveTextContent("Primary");
    expect(who()).toHaveTextContent("@nia.tests.kitchen");
    fireEvent.click(screen.getByRole("button", { name: "More: @nia.tests.kitchen" }));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    vi.advanceTimersByTime(600);
    fireEvent.click(confirmingDisconnect());
    await settle();
    // The primary left: the other account takes the mark.
    expect(screen.queryByText("@nia.tests.kitchen")).toBeNull();
    expect(accountRows()[0]).toHaveTextContent("@nia.testsPrimary");
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("failed: an account action is refused after 400 ms; the change goes back and the line under Accounts says so", async () => {
    vi.useFakeTimers();
    render(<DevYou state="failed" />);
    fireEvent.click(screen.getByRole("button", { name: "More: @nia.tests.kitchen" }));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    // The confirming Disconnect waits 500 ms (the clock is stood in with the timers).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    fireEvent.click(confirmingDisconnect());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.queryByText("@nia.tests.kitchen")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(accountRows()[1]).toHaveTextContent("@nia.tests.kitchen");
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't save. Try again.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
