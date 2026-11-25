/** @vitest-environment happy-dom */

/**
 * HomeScreen — Home as drawn (spec 2026-11-23 §3), rendered for real. Every value comes in as a
 * prop, so nothing is stubbed; the field is a plain slot.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

import { MenuButton } from "@/components/shell/menu-button";

import { HOME_SKILLS, HomeScreen, PICK_SETTLE_MS, pickClock, type HomeMoney, type HomeRecentRow, type HomeScreenProps } from "../home-screen";

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
    // The drawer's opener as a container passes it; given a face, since a screen test has no shell.
    opener: <MenuButton variant="picture" face={{ picture: null, initials: "NL" }} />,
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

  it("is already in the summary row's shape: as tall, the plain chat mark as its tile, the time as its second line (fix round 1)", () => {
    renderHome();
    const row = screen.getByRole("button", { name: "Meal prep for busy students" });
    expect(row).toHaveClass("min-h-[72px]");
    const mark = row.querySelector('[data-part="mark"]');
    expect(mark).toHaveAttribute("data-kind", "chat");
    expect(mark).toHaveAttribute("aria-hidden");
    expect(mark).toHaveClass("w-[42px]", "h-14");
    expect(mark).not.toHaveClass("md:w-11");
    // The time under the title, not at the right.
    const time = screen.getByText("2h ago");
    expect(time).toHaveClass("text-meta", "text-foreground-secondary");
    expect(time.previousElementSibling).toHaveTextContent("Meal prep for busy students");
    expect(row.closest("li")?.querySelector("[data-gauge]")).toBeNull();
  });

  it("a row without a summary and one with it carry the same height class", () => {
    const summed: HomeRecentRow = {
      id: "t9",
      title: "Hook formats, the $400 test",
      when: null,
      summary: { tile: { lead: "hooks", frame: null, still: null }, line: "3 hooks · simulated 2h ago", gauge: null },
    };
    renderHome({ recent: [RECENT[0]!, summed] });
    const plain = screen.getByRole("button", { name: "Meal prep for busy students" });
    const withSummary = screen.getByRole("button", { name: "Hook formats, the $400 test" });
    expect(plain.className).toBe(withSummary.className);
    expect(plain.closest("li")!.className).toBe(withSummary.closest("li")!.className);
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

describe("HomeScreen — Recent from Library's summary (Library plan, Task 7)", () => {
  // As Library draws a chat (its tile, its line, its gauge), at Home's sizes.
  const SUMMED: HomeRecentRow[] = [
    {
      id: "t1",
      title: "Meal prep for busy students",
      when: null,
      summary: {
        tile: { lead: "hooks", frame: null, still: null },
        line: "3 hooks · simulated 2h ago",
        gauge: { number: 66, describes: "66% would stop to watch", href: "/simulation/hook/t1/k1" },
      },
    },
    {
      id: "t2",
      title: "Fake a $10M camera move",
      when: null,
      summary: {
        tile: { lead: "video", frame: "/frames/0.jpg", still: null },
        line: "Video · simulated 5h ago",
        gauge: { number: 38, describes: "38% watch to the end", href: "/simulation/a1" },
      },
    },
    {
      id: "t3",
      title: "Morning routine, no cuts",
      when: null,
      summary: { tile: { lead: "script", frame: null, still: null }, line: "Script · 1d ago", gauge: null },
    },
  ];
  const rowOf = (name: string) => screen.getByRole("button", { name });
  const itemOf = (name: string) => rowOf(name).closest("li")!;

  it("a row is one button named by the title and described by its line", () => {
    const p = renderHome({ recent: SUMMED });
    const row = rowOf("Meal prep for busy students");
    expect(row).toHaveAccessibleDescription("3 hooks · simulated 2h ago");
    expect(row).toHaveTextContent("3 hooks · simulated 2h ago");
    // No time at the right: the line carries it.
    expect(row).not.toHaveTextContent(/ago.*ago/);
    fireEvent.click(row);
    expect(p.onOpenThread).toHaveBeenCalledWith("t1");
    expect(within(recentSection()!).getAllByRole("listitem")).toHaveLength(3);
  });

  it("is at least 72 tall: the tile and two lines", () => {
    renderHome({ recent: SUMMED });
    expect(rowOf("Meal prep for busy students")).toHaveClass("min-h-[72px]");
  });

  it("the tile is the mark of what the chat holds, 42 × 56 at every width", () => {
    renderHome({ recent: SUMMED });
    const mark = itemOf("Meal prep for busy students").querySelector('[data-part="mark"]');
    expect(mark).toHaveAttribute("data-kind", "hooks");
    expect(mark).toHaveAttribute("aria-hidden");
    expect(mark).toHaveClass("w-[42px]", "h-14");
    // Not the Library table's 44 × 58.
    expect(mark).not.toHaveClass("md:w-11");
    expect(mark).not.toHaveClass("md:h-[58px]");
    expect(itemOf("Morning routine, no cuts").querySelector('[data-part="mark"]')).toHaveAttribute("data-kind", "script");
  });

  it("a video's tile is its picture, decorative", () => {
    renderHome({ recent: SUMMED });
    const thumb = itemOf("Fake a $10M camera move").querySelector('[data-part="thumb"]');
    expect(thumb).toHaveAttribute("aria-hidden");
    expect(thumb?.querySelector("img")).toHaveAttribute("src", "/frames/0.jpg");
    expect(thumb).toHaveClass("w-[42px]", "h-14");
    expect(thumb).not.toHaveClass("md:w-11");
  });

  it("a simulated chat has its gauge, 40 wide: a link to its result, outside the row's button", () => {
    const p = renderHome({ recent: SUMMED });
    const link = screen.getByRole("link", { name: "Open the result: Meal prep for busy students" });
    expect(link).toHaveAttribute("href", "/simulation/hook/t1/k1");
    expect(link).toHaveAccessibleDescription("66% would stop to watch");
    expect(link).toHaveTextContent("66");
    expect(link).toHaveStyle({ width: "40px", height: "40px" });
    expect(rowOf("Meal prep for busy students").contains(link)).toBe(false);
    expect(itemOf("Meal prep for busy students").contains(link)).toBe(true);
    fireEvent.click(link);
    expect(p.onOpenThread).not.toHaveBeenCalled();

    expect(screen.getByRole("link", { name: "Open the result: Fake a $10M camera move" })).toHaveAccessibleDescription(
      "38% watch to the end",
    );
  });

  it("a chat with nothing simulated has no gauge", () => {
    renderHome({ recent: SUMMED });
    expect(itemOf("Morning routine, no cuts").querySelector("[data-gauge]")).toBeNull();
    expect(within(itemOf("Morning routine, no cuts")).queryByRole("link")).toBeNull();
  });

  it("a tap on a gauge inside the window after a card pick is dropped too", () => {
    let now = 10_000;
    pickClock.now = () => now;
    const p = props({ recent: SUMMED });
    const { rerender } = render(<HomeScreen {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Hooks" }));
    rerender(<HomeScreen {...p} picked />);
    now += PICK_SETTLE_MS - 1;
    const link = screen.getByRole("link", { name: "Open the result: Meal prep for busy students" });
    const reached = vi.fn();
    link.addEventListener("click", reached);
    expect(fireEvent.click(link)).toBe(false);
    expect(reached).not.toHaveBeenCalled();
  });

  it("has no axe violations", async () => {
    const { container } = render(<HomeScreen {...props({ recent: SUMMED })} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("HomeScreen — the phone's top row", () => {
  const opener = () => screen.getByRole("button", { name: "Open menu" });
  const openerSlot = () => opener().closest<HTMLElement>('[data-part="opener"]')!;

  it("the opener is the phone row's first child: Open menu, not a link to You", () => {
    renderHome();
    expect(opener()).toHaveTextContent("NL");
    expect(openerSlot()).toHaveClass("flex", "shrink-0", "md:hidden");
    // First in the band's row, where the picture link to You was.
    expect(openerSlot().parentElement).toHaveClass("h-[var(--mobile-nav-band)]");
    expect(openerSlot().parentElement!.firstElementChild).toBe(openerSlot());
    // You is a row in the drawer now: no link to it on Home.
    expect(screen.queryByRole("link", { name: "You" })).toBeNull();
    expect(document.querySelector('a[href="/you"]')).toBeNull();
  });

  it("without an opener the credits stay at the right", () => {
    const { container } = render(<HomeScreen {...props({ opener: undefined })} />);
    expect(container.querySelector('[data-part="opener"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    const credits = container.querySelector<HTMLElement>('[data-part="credits"]')!;
    expect(credits).toHaveClass("ml-auto");
    // Alone in the row, and still pushed to its right end.
    expect(credits.parentElement!.children).toHaveLength(1);
    cleanup();
    // With the opener, the same badge: the opener at the left, the credits at the right.
    renderHome();
    const shown = document.querySelector<HTMLElement>('[data-part="credits"]')!;
    expect(shown).toHaveClass("ml-auto");
    expect(shown.previousElementSibling).toBe(openerSlot());
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
    const row = openerSlot().parentElement;
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

describe("HomeScreen — Money made (Earn, step C; rulings 18 and 24)", () => {
  const shown = (amount: string | null): HomeMoney => ({ state: "shown", amount, hint: "Earn 50%" });
  const MONEY = shown("$0");
  const LOADING: HomeMoney = { state: "loading" };
  /** Ruling 24a: the class that takes the rate away while Home (the container) is narrower than 360. */
  const DROPPED_UNDER_360 = "@max-[360px]:hidden";
  /** The field's block as it was before the row existed (HEAD `9478c611`): 12 under the greeting, 28 from md up. */
  const FIELD_BEFORE_THE_ROW = "mx-auto mt-3 w-full max-w-[720px] md:mt-7";
  const moneyLink = () => screen.getByRole("link", { name: "Money made: $0. Earn 50%" });
  const moneyPart = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="money"]');
  const fieldBlock = () => screen.getByTestId("slot").parentElement!;

  it("is one link to Earn, named Money made: $0. Earn 50%: the label, the amount, Earn 50% and a chevron", () => {
    renderHome({ money: MONEY });
    const link = moneyLink();
    expect(link).toHaveAttribute("href", "/earn");
    expect(link).toHaveTextContent(/^Money made\s*\$0\s*Earn 50%$/);
    expect(within(link).getByText("Money made")).toBeInTheDocument();
    expect(within(link).getByText("$0")).toBeInTheDocument();
    expect(within(link).getByText("Earn 50%")).toBeInTheDocument();
    const chevron = link.querySelector("svg");
    expect(chevron).toHaveAttribute("aria-hidden");
    // The last thing in the row, after the words.
    expect(within(link).getByText("Earn 50%").compareDocumentPosition(chevron!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // One link: nothing else in it to tap.
    expect(within(link).queryAllByRole("link")).toHaveLength(0);
    expect(within(link).queryAllByRole("button")).toHaveLength(0);
  });

  it("says the amount it is given", () => {
    renderHome({ money: shown("$1,240.50") });
    const link = screen.getByRole("link", { name: "Money made: $1,240.50. Earn 50%" });
    expect(within(link).getByText("$1,240.50")).toBeInTheDocument();
  });

  it("sits between the greeting and the field, in the field's bounds", () => {
    const { container } = render(<HomeScreen {...props({ money: MONEY })} />);
    const link = moneyLink();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.compareDocumentPosition(screen.getByTestId("slot")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // As wide as the field's card at every width: the same centred 720 column.
    const part = moneyPart(container)!;
    expect(part).toHaveClass("mx-auto", "w-full", "max-w-[720px]");
    expect(fieldBlock()).toHaveClass("mx-auto", "w-full", "max-w-[720px]");
    expect(link).toHaveClass("w-full");
  });

  it("is drawn as Home's cards: the surface, the skill card's radius, the resting shadow; the type of Home's rows; no colour", () => {
    renderHome({ money: MONEY });
    const link = moneyLink();
    expect(link).toHaveClass("bg-surface", "rounded-2xl", "shadow-[var(--shadow-rest)]", "hover:shadow-[var(--shadow-lift)]");
    expect(within(link).getByText("Money made")).toHaveClass("text-ui", "text-foreground-secondary");
    // The amount in Home's emphasis (the skill names' and Recent's weight), its digits in columns.
    expect(within(link).getByText("$0")).toHaveClass("text-ui", "font-[640]", "text-foreground", "tabular-nums");
    expect(within(link).getByText("Earn 50%")).toHaveClass("text-meta", "text-foreground-secondary");
    // Nothing coral or green: no accent, no tone colour, anywhere in the row.
    for (const el of [link, ...link.querySelectorAll("*")]) {
      expect(el.getAttribute("class") ?? "").not.toMatch(/accent|coral|green|emerald|above|below|success/);
    }
  });

  it("is a 48 tall target, one line: the words do not wrap, the label gives way first", () => {
    renderHome({ money: MONEY });
    const link = moneyLink();
    expect(link).toHaveClass("h-12", "items-center");
    expect(within(link).getByText("Money made")).toHaveClass("min-w-0", "truncate");
    expect(within(link).getByText("$0")).toHaveClass("shrink-0", "whitespace-nowrap");
    expect(within(link).getByText("Earn 50%")).toHaveClass("whitespace-nowrap");
  });

  // Ruling 24a. happy-dom lays nothing out: what is shown here is which rows carry the container rule.
  it.each(["$0", "$24", "$240"])(
    "under 360 wide Earn 50% stays beside an amount of four characters or fewer (%s)",
    (amount) => {
      renderHome({ money: shown(amount) });
      // The width the rule reads is Home's own.
      expect(screen.getByTestId("home-next")).toHaveClass("@container");
      const link = screen.getByRole("link", { name: `Money made: ${amount}. Earn 50%` });
      const rate = within(link).getByText("Earn 50%");
      expect(rate).not.toHaveClass(DROPPED_UNDER_360);
      // Nothing takes it away at any width.
      expect(rate.className).not.toMatch(/hidden|invisible|sr-only|opacity-0/);
    },
  );

  it.each(["$0.05", "$24.50", "$1,240", "$1,240.50", "$1,234,567.89"])(
    "under 360 wide Earn 50% gives way to an amount longer than four characters (%s); from 360 it is drawn; the name always holds it",
    (amount) => {
      renderHome({ money: shown(amount) });
      expect(screen.getByTestId("home-next")).toHaveClass("@container");
      // The name says the rate whether or not it is drawn.
      const link = screen.getByRole("link", { name: `Money made: ${amount}. Earn 50%` });
      const rate = within(link).getByText("Earn 50%");
      expect(rate).toHaveClass(DROPPED_UNDER_360);
      // Under 360 only: nothing else takes it away, so from 360 it is always drawn.
      expect(rate.className.replace(DROPPED_UNDER_360, "")).not.toMatch(/hidden|invisible|sr-only|opacity-0/);
      // The amount and the chevron stay at every width.
      expect(within(link).getByText(amount).className).not.toMatch(/hidden/);
      expect(link.querySelector("svg")).not.toHaveClass(DROPPED_UNDER_360);
    },
  );

  // Ruling 24c: an enrolled creator whose number could not be read is not told "$0".
  it("with no amount (it could not be read): Money made and Earn 50%, no amount; named Money made. Earn 50%", () => {
    renderHome({ money: shown(null) });
    const link = screen.getByRole("link", { name: "Money made. Earn 50%" });
    expect(link).toHaveAttribute("href", "/earn");
    expect(link).toHaveTextContent(/^Money made\s*Earn 50%$/);
    expect(link.textContent).not.toContain("$");
    // No place kept for an amount either: the label, then the rate and the chevron.
    expect(link.querySelector(".tabular-nums")).toBeNull();
    expect(link.children).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /^Money made:/ })).toBeNull();
    // The same row otherwise: as tall, the rate drawn at every width (there is no amount to make room for).
    expect(link).toHaveClass("h-12", "w-full", "bg-surface", "rounded-2xl");
    const rate = within(link).getByText("Earn 50%");
    expect(rate).not.toHaveClass(DROPPED_UNDER_360);
    expect(rate.className).not.toMatch(/hidden|invisible|sr-only|opacity-0/);
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden");
  });

  // Ruling 24b: the prop says what it means.
  it("loading: its space is kept, empty and silent, as tall as the row; the answer lands in the same element", () => {
    const { container, rerender } = render(<HomeScreen {...props({ money: LOADING })} />);
    const holding = moneyPart(container)!;
    expect(holding).not.toBeNull();
    expect(holding).toHaveAttribute("aria-hidden", "true");
    expect(holding.textContent).toBe("");
    expect(screen.queryByRole("link", { name: /^Money made/ })).toBeNull();
    const held = holding.firstElementChild!;
    expect(held).toHaveClass("h-12");
    const field = screen.getByTestId("slot");
    const fieldClassWhileHeld = fieldBlock().className;

    // The answer lands in the same place: the same element, the same margins, the same height.
    rerender(<HomeScreen {...props({ money: MONEY })} />);
    expect(moneyPart(container)).toBe(holding);
    expect(holding).not.toHaveAttribute("aria-hidden");
    expect(moneyLink()).toHaveClass("h-12");
    expect(holding.contains(moneyLink())).toBe(true);
    expect(fieldBlock().className).toBe(fieldClassWhileHeld);
    // The field is the element it was (its text and its focus stay).
    expect(screen.getByTestId("slot")).toBe(field);
  });

  it.each<[string, Partial<HomeScreenProps>]>([
    ["nothing passed", {}],
    ["undefined", { money: undefined }],
    ["null", { money: null }],
  ])("%s: no row and no kept space, Home as it was before the row", (_name, over) => {
    const { container } = render(<HomeScreen {...props(over)} />);
    expect(moneyPart(container)).toBeNull();
    expect(screen.queryByRole("link", { name: /^Money made/ })).toBeNull();
    expect(screen.queryByText("Money made")).toBeNull();
    // Nothing between the greeting and the field's block, and the block's gaps are the approved ones.
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling).toBe(fieldBlock());
    expect(fieldBlock().className).toBe(FIELD_BEFORE_THE_ROW);
  });

  it("loading, then nothing (a refusal): the space goes and the field stays the element it was", () => {
    const { container, rerender } = render(<HomeScreen {...props({ money: LOADING })} />);
    const field = screen.getByTestId("slot");
    const block = fieldBlock();
    rerender(<HomeScreen {...props({ money: null })} />);
    expect(moneyPart(container)).toBeNull();
    expect(screen.getByTestId("slot")).toBe(field);
    expect(fieldBlock()).toBe(block);
    expect(block.className).toBe(FIELD_BEFORE_THE_ROW);
  });

  it.each<[string, HomeMoney]>([
    ["shown", MONEY],
    ["shown with no amount", shown(null)],
    ["loading", LOADING],
  ])("%s, it takes the greeting's gap above it and the field sits closer below", (_name, money) => {
    const { container } = render(<HomeScreen {...props({ money })} />);
    expect(moneyPart(container)).toHaveClass("mt-3", "md:mt-7");
    expect(fieldBlock()).toHaveClass("mt-3", "md:mt-4");
    expect(fieldBlock()).not.toHaveClass("md:mt-7");
  });

  it("stays while a skill is picked (it is above the field, not among the cards)", () => {
    renderHome({ money: MONEY, picked: true });
    expect(moneyLink()).toBeInTheDocument();
  });

  it("has no axe violations: shown, with no amount, or loading", async () => {
    for (const money of [MONEY, shown(null), LOADING]) {
      const { container } = render(<HomeScreen {...props({ money, recent: [] })} />);
      // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
      expect(await axe(container)).toHaveNoViolations();
      cleanup();
    }
  });
});

describe("HomeScreen — order", () => {
  it("reads top row, greeting, field, cards, Recent", () => {
    renderHome();
    const order = [
      screen.getByRole("button", { name: "Open menu" }),
      screen.getByRole("heading", { level: 1 }),
      screen.getByTestId("slot"),
      screen.getByRole("button", { name: "Simulate" }),
      screen.getByRole("heading", { name: "Recent" }),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("with the row: top row, greeting, Money made, field, cards, Recent", () => {
    renderHome({ money: { state: "shown", amount: "$0", hint: "Earn 50%" } });
    const order = [
      screen.getByRole("button", { name: "Open menu" }),
      screen.getByRole("heading", { level: 1 }),
      screen.getByRole("link", { name: "Money made: $0. Earn 50%" }),
      screen.getByTestId("slot"),
      screen.getByRole("button", { name: "Simulate" }),
      screen.getByRole("heading", { name: "Recent" }),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
