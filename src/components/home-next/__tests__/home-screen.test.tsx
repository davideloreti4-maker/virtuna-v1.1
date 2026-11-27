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

  it("the skill list is the five, with the ids the composer arms (Edit shown only where the editor is open)", () => {
    expect(HOME_SKILLS.map((s) => [s.id, s.label])).toEqual([
      ["test", "Simulate"],
      ["edit", "Edit"],
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

describe("HomeScreen — Money made (Earn, step C; rulings 18 and 24; the goal, 2026-11-26)", () => {
  const shown = (amount: string | null): HomeMoney => ({ state: "shown", amount, goal: "$65k" });
  const MONEY = shown("$0");
  const LOADING: HomeMoney = { state: "loading" };
  /** The field's block as it was before the row existed (HEAD `9478c611`): 12 under the greeting, 28 from md up. */
  const FIELD_BEFORE_THE_ROW = "mx-auto mt-3 w-full max-w-[720px] md:mt-7";
  const moneyLink = () => screen.getByRole("link", { name: "Money made: $0 of $65k" });
  const moneyPart = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="money"]');
  const figures = (link: HTMLElement) => link.querySelector<HTMLElement>('[data-part="money-figures"]')!;
  const fieldBlock = () => screen.getByTestId("slot").parentElement!;

  it("is one link to Earn, named Money made: $0 of $65k: the label, then at the right $0 / $65k and a chevron; no rate", () => {
    renderHome({ money: MONEY });
    const link = moneyLink();
    expect(link).toHaveAttribute("href", "/earn");
    expect(link).toHaveTextContent(/^Money made\s*\$0 \/ \$65k$/);
    expect(link.textContent).not.toMatch(/Earn|%/);
    expect(within(link).getByText("Money made")).toBeInTheDocument();
    expect(within(link).getByText("$0")).toBeInTheDocument();
    // The amount and the goal sit together at the right, where the rate was; the chevron last.
    expect(figures(link)).toHaveTextContent(/^\$0 \/ \$65k$/);
    expect(figures(link)).toHaveClass("ml-auto");
    const chevron = link.querySelector("svg");
    expect(chevron).toHaveAttribute("aria-hidden");
    expect(figures(link).contains(chevron)).toBe(true);
    expect(within(link).getByText("$0").compareDocumentPosition(chevron!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // One link: nothing else in it to tap.
    expect(within(link).queryAllByRole("link")).toHaveLength(0);
    expect(within(link).queryAllByRole("button")).toHaveLength(0);
  });

  it("says the amount it is given, against the goal", () => {
    renderHome({ money: shown("$1,240.50") });
    const link = screen.getByRole("link", { name: "Money made: $1,240.50 of $65k" });
    expect(within(link).getByText("$1,240.50")).toBeInTheDocument();
    expect(figures(link)).toHaveTextContent(/^\$1,240\.50 \/ \$65k$/);
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

  it("is drawn as Home's cards: the surface, the card radius, the resting shadow; the type of Home's rows; no colour", () => {
    renderHome({ money: MONEY });
    const link = moneyLink();
    expect(link).toHaveClass("bg-surface", "rounded-2xl", "shadow-[var(--shadow-rest)]", "hover:shadow-[var(--shadow-lift)]");
    expect(within(link).getByText("Money made")).toHaveClass("text-ui", "text-foreground-secondary");
    // The amount in Home's emphasis; the goal in the secondary ink; the digits in columns.
    expect(within(link).getByText("$0")).toHaveClass("font-[640]", "text-foreground");
    expect(within(link).getByText("/ $65k", { exact: false })).toHaveClass("text-foreground-secondary");
    expect(within(link).getByText("$0").parentElement).toHaveClass("text-ui", "tabular-nums");
    // Nothing coral or green: no accent, no tone colour, anywhere in the row.
    for (const el of [link, ...link.querySelectorAll("*")]) {
      expect(el.getAttribute("class") ?? "").not.toMatch(/accent|coral|green|emerald|above|below|success/);
    }
  });

  it.each(["$0", "$24.50", "$1,240.50", "$1,234,567.89"])(
    "is a 48 tall target, one line, at every width: the label gives way, the figures (%s / $65k) never do",
    (amount) => {
      renderHome({ money: shown(amount) });
      const link = screen.getByRole("link", { name: `Money made: ${amount} of $65k` });
      expect(link).toHaveClass("h-12", "items-center");
      expect(within(link).getByText("Money made")).toHaveClass("min-w-0", "truncate");
      expect(figures(link)).toHaveClass("shrink-0");
      expect(within(link).getByText(amount).parentElement).toHaveClass("whitespace-nowrap");
      // Nothing takes the figures away at any width.
      for (const el of [figures(link), ...figures(link).querySelectorAll("*")]) {
        expect(el.getAttribute("class") ?? "").not.toMatch(/hidden|invisible|sr-only|opacity-0/);
      }
    },
  );

  // Ruling 24c: an enrolled creator whose number could not be read is not told "$0".
  it("with no amount (it could not be read): Money made and the goal alone; named Money made. Goal $65k", () => {
    renderHome({ money: shown(null) });
    const link = screen.getByRole("link", { name: "Money made. Goal $65k" });
    expect(link).toHaveAttribute("href", "/earn");
    expect(link).toHaveTextContent(/^Money made\s*Goal \$65k$/);
    expect(link.textContent).not.toContain("$0");
    expect(screen.queryByRole("link", { name: /^Money made:/ })).toBeNull();
    // The same row otherwise: as tall, the figures at the right with the chevron.
    expect(link).toHaveClass("h-12", "w-full", "bg-surface", "rounded-2xl");
    expect(figures(link)).toHaveTextContent(/^Goal \$65k$/);
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
    renderHome({ money: { state: "shown", amount: "$0", goal: "$65k" } });
    const order = [
      screen.getByRole("button", { name: "Open menu" }),
      screen.getByRole("heading", { level: 1 }),
      screen.getByRole("link", { name: "Money made: $0 of $65k" }),
      screen.getByTestId("slot"),
      screen.getByRole("button", { name: "Simulate" }),
      screen.getByRole("heading", { name: "Recent" }),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("HomeScreen — the skills sit in the field's column (owner 2026-11-26)", () => {
  it("from md up the skills row is as wide as the field (720), centred, not the page's 980", () => {
    renderHome();
    expect(screen.getByRole("list", { name: "Skills" })).toHaveClass("mx-auto", "w-full", "max-w-[720px]");
  });
});

describe("HomeScreen — the creator's face (owner 2026-11-26)", () => {
  it("draws the picture above the greeting with the platform's mark, and the handle with its logo", () => {
    const { container } = render(
      <HomeScreen {...props({ face: { picture: "https://example.test/nia.jpg", initials: "NL", platform: "tiktok", handle: "nia.cooks" } })} />,
    );
    expect(container.querySelector('[data-part="face"] [data-platform-badge="tiktok"]')).not.toBeNull();
    const handle = container.querySelector('[data-part="handle"]') as HTMLElement;
    expect(handle).toHaveTextContent("@nia.cooks");
    expect(handle.querySelector('[data-platform-logo="tiktok"]')).not.toBeNull();
  });

  it("no face: nothing of it", () => {
    const { container } = render(<HomeScreen {...props()} />);
    expect(container.querySelector('[data-part="face"]')).toBeNull();
    expect(container.querySelector('[data-part="handle"]')).toBeNull();
  });
});

describe("HomeScreen — New chat (owner 2026-11-26: an empty chat, not Home)", () => {
  const money: HomeMoney = { state: "shown", amount: "$0", goal: "$65k" };

  it("draws a heading, the field and the quick actions; no greeting, Money made, carousel or Recent", () => {
    const { container } = render(
      <HomeScreen {...props({ mode: "chat", money, remixes: <div data-testid="carousel" />, recentOnDesktop: true })} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "New chat" })).toBeInTheDocument();
    expect(screen.queryByText("Good morning, Nia.")).toBeNull();
    expect(container.querySelector('[data-part="money"]')).toBeNull();
    expect(screen.queryByTestId("carousel")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
    expect(screen.getByTestId("slot")).toBeInTheDocument();
    const actions = screen.getByRole("list", { name: "Quick actions" });
    expect(within(actions).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Simulate a video",
      "Write hooks",
      "Write a script",
      "Remix a proven video",
      "More",
    ]);
  });

  it("a quick action picks its skill; More opens the More sheet", () => {
    const p = renderHome({ mode: "chat" });
    fireEvent.click(screen.getByRole("button", { name: "Write hooks" }));
    expect(p.onPickSkill).toHaveBeenCalledWith("hooks");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(p.onMore).toHaveBeenCalledTimes(1);
  });

  it("Edit is a quick action only for an account the editor is open to", () => {
    renderHome({ mode: "chat", editOpen: true });
    expect(screen.getByRole("button", { name: "Edit a video" })).toBeInTheDocument();
  });

  it("with a skill picked the quick actions go", () => {
    renderHome({ mode: "chat", picked: true });
    expect(screen.queryByRole("list", { name: "Quick actions" })).toBeNull();
  });
});
