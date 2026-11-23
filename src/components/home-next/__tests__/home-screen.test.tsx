/** @vitest-environment happy-dom */

/**
 * HomeScreen — Home as drawn (spec 2026-11-23 §3), rendered for real. Every value comes in as a
 * prop, so nothing is stubbed; the field is a plain slot.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { HOME_SKILLS, HomeScreen, PICK_SETTLE_MS, pickClock, type HomeScreenProps } from "../home-screen";

afterEach(() => {
  cleanup();
  pickClock.now = () => performance.now();
});

const RECENT = [
  { id: "t1", title: "Meal prep for busy students", when: "2h ago" },
  { id: "t2", title: "Fake a $10M camera move", when: "1d ago" },
  { id: "t3", title: "Morning routine, no cuts", when: null },
];

function props(over: Partial<HomeScreenProps> = {}): HomeScreenProps {
  return {
    greeting: "Good morning, Nia.",
    avatar: null,
    initials: "NL",
    credits: 30,
    field: <div data-testid="slot" />,
    picked: false,
    onPickSkill: vi.fn(),
    recent: RECENT,
    onOpenThread: vi.fn(),
    recentOnDesktop: false,
    onMore: vi.fn(),
    ...over,
  };
}

const renderHome = (over: Partial<HomeScreenProps> = {}) => {
  const p = props(over);
  render(<HomeScreen {...p} />);
  return p;
};

const CARDS = ["Simulate", "Hooks", "Script", "Remix"];
const recentSection = () => screen.getByRole("heading", { name: "Recent" }).closest("section");

describe("HomeScreen — greeting and field", () => {
  it("the greeting is the page's only h1", () => {
    renderHome({ greeting: "Good evening." });
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Good evening.");
  });

  it("renders the field once, before the cards", () => {
    renderHome();
    expect(screen.getAllByTestId("slot")).toHaveLength(1);
    const slot = screen.getByTestId("slot");
    const firstCard = screen.getByRole("button", { name: "Simulate" });
    expect(slot.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("HomeScreen — the four skill cards", () => {
  it("lists Simulate, Hooks, Script, Remix in that order, each described by its line", () => {
    renderHome();
    const cards = CARDS.map((name) => screen.getByRole("button", { name }));
    for (let i = 1; i < cards.length; i += 1) {
      expect(cards[i - 1]!.compareDocumentPosition(cards[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Simulate" })).toHaveAccessibleDescription("See who keeps watching");
    expect(screen.getByRole("button", { name: "Hooks" })).toHaveAccessibleDescription("Openings for an idea");
    expect(screen.getByRole("button", { name: "Script" })).toHaveAccessibleDescription("A full script, timed");
    expect(screen.getByRole("button", { name: "Remix" })).toHaveAccessibleDescription("Rebuild a proven video");
  });

  it("the skill list is the four, with the ids the composer arms", () => {
    expect(HOME_SKILLS.map((s) => [s.id, s.label])).toEqual([
      ["test", "Simulate"],
      ["hooks", "Hooks"],
      ["script", "Script"],
      ["remix", "Remix"],
    ]);
  });

  it("a tap on a card picks its skill", () => {
    const p = renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Remix" }));
    expect(p.onPickSkill).toHaveBeenCalledWith("remix");
    fireEvent.click(screen.getByRole("button", { name: "Simulate" }));
    expect(p.onPickSkill).toHaveBeenLastCalledWith("test");
  });

  it("with a skill picked the cards are gone and Recent stays", () => {
    renderHome({ picked: true });
    for (const name of CARDS) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent", level: 2 })).toBeInTheDocument();
  });
});

describe("HomeScreen — Recent", () => {
  it("has a heading, a link to Library and one row per chat", () => {
    const p = renderHome();
    expect(screen.getByRole("heading", { name: "Recent", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");

    // Named for the title alone (so "tap Meal prep…" finds it); the time is inside, as its description.
    const row = screen.getByRole("button", { name: "Meal prep for busy students" });
    expect(row).toHaveTextContent("2h ago");
    expect(row).toHaveAccessibleDescription("2h ago");
    fireEvent.click(row);
    expect(p.onOpenThread).toHaveBeenCalledWith("t1");

    const list = within(recentSection()!).getAllByRole("listitem");
    expect(list).toHaveLength(3);
  });

  it("a row with no time shows only its title", () => {
    renderHome();
    const row = screen.getByRole("button", { name: "Morning routine, no cuts" });
    expect(row).toHaveTextContent(/^Morning routine, no cuts$/);
    expect(row).not.toHaveAttribute("aria-describedby");
  });

  it("with no chats there is no Recent and no Library link", () => {
    renderHome({ recent: [] });
    expect(screen.queryByRole("heading", { name: "Recent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Library" })).not.toBeInTheDocument();
  });

  it("is hidden from md up while the sidebar lists the same chats", () => {
    renderHome({ recentOnDesktop: false });
    expect(recentSection()).toHaveClass("md:hidden");
  });

  it("shows from md up while the sidebar is the rail", () => {
    renderHome({ recentOnDesktop: true });
    expect(recentSection()).not.toHaveClass("md:hidden");
  });
});

describe("HomeScreen — the phone's top row", () => {
  it("the avatar is a link to Settings named Account", () => {
    renderHome();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/settings");
  });

  it.each([
    [30, "30 credits"],
    [1, "1 credit"],
    [0, "0 credits"],
  ])("credits %i read %s", (credits, label) => {
    renderHome({ credits });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("an unlimited plan (or a balance still loading) shows no pill", () => {
    const { container } = render(<HomeScreen {...props({ credits: null })} />);
    expect(container.querySelector('[data-part="credits"]')).toBeNull();
    expect(screen.queryByText(/credits?$/)).not.toBeInTheDocument();
  });

  it("the row is the phone's only (the sidebar has the account from md up)", () => {
    renderHome();
    const row = screen.getByRole("link", { name: "Account" }).parentElement;
    expect(row).toHaveClass("md:hidden");
  });
});

describe("HomeScreen — More skills (final fix A1)", () => {
  it("is one button under the cards, named More skills, that opens a dialog", () => {
    const p = renderHome();
    const more = screen.getByRole("button", { name: "More skills" });
    expect(more).toHaveAttribute("aria-haspopup", "dialog");
    expect(more).toHaveClass("tap-44", "text-ui", "text-foreground-secondary", "hover:text-foreground", "mt-2");
    const lastCard = screen.getByRole("button", { name: "Remix" });
    expect(lastCard.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(more);
    expect(p.onMore).toHaveBeenCalledTimes(1);
  });

  it("is gone while a skill is picked, as the cards are", () => {
    renderHome({ picked: true });
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
  });
});

describe("HomeScreen — Recent is not stretched across a wide page (A9)", () => {
  it("from md up it is capped at the field's width and centred", () => {
    renderHome({ recentOnDesktop: true });
    expect(recentSection()).toHaveClass("md:mx-auto", "md:w-full", "md:max-w-[720px]");
  });
});

describe("HomeScreen — a double tap on a card does not open a chat (B6)", () => {
  // The cards go on a pick and Recent slides up into their place: the second tap lands on a row.
  function pickThenTap(gap: number, target: () => HTMLElement) {
    let now = 10_000;
    pickClock.now = () => now;
    const p = props();
    const { rerender } = render(<HomeScreen {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Hooks" }));
    expect(p.onPickSkill).toHaveBeenCalledWith("hooks");
    rerender(<HomeScreen {...p} picked />);
    now += gap;
    const el = target();
    const notCancelled = fireEvent.click(el);
    return { p, notCancelled };
  }
  const row = () => screen.getByRole("button", { name: "Meal prep for busy students" });
  const library = () => screen.getByRole("link", { name: "Library" });

  it("a tap on a Recent row inside the window after a pick is dropped", () => {
    const { p } = pickThenTap(PICK_SETTLE_MS - 1, row);
    expect(p.onOpenThread).not.toHaveBeenCalled();
  });

  it("a tap on Library inside the window is dropped too (it never reaches the link, no navigation)", () => {
    const reached = vi.fn();
    const { notCancelled } = pickThenTap(PICK_SETTLE_MS - 1, () => {
      const link = library();
      link.addEventListener("click", reached);
      return link;
    });
    expect(reached).not.toHaveBeenCalled();
    expect(notCancelled).toBe(false);
  });

  it("once the window has passed the row opens its chat", () => {
    const { p } = pickThenTap(PICK_SETTLE_MS, row);
    expect(p.onOpenThread).toHaveBeenCalledWith("t1");
  });

  it("with no pick at all a row opens at once", () => {
    pickClock.now = () => 0;
    const p = renderHome();
    fireEvent.click(row());
    expect(p.onOpenThread).toHaveBeenCalledWith("t1");
  });
});

describe("HomeScreen — order", () => {
  it("reads top row, greeting, field, cards, Recent", () => {
    renderHome();
    const order = [
      screen.getByRole("link", { name: "Account" }),
      screen.getByRole("heading", { level: 1 }),
      screen.getByTestId("slot"),
      screen.getByRole("button", { name: "Simulate" }),
      screen.getByRole("heading", { name: "Recent" }),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
