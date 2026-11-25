/** @vitest-environment happy-dom */

/**
 * HomeScreen — Home as drawn (spec 2026-11-23 §3, changed by 2026-11-25 §2), rendered for real. Every
 * value comes in as a prop, so nothing is stubbed; the field is a plain slot.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

import { MenuButton } from "@/components/shell/menu-button";

import {
  HOME_SKILLS,
  HomeScreen,
  type HomeAudience,
  type HomeMoney,
  type HomeRecentRow,
  type HomeScreenProps,
} from "../home-screen";

afterEach(() => {
  cleanup();
});

const RECENT = [
  { id: "t1", title: "Meal prep for busy students", when: "2h ago" },
  { id: "t2", title: "Fake a $10M camera move", when: "1d ago" },
  { id: "t3", title: "Morning routine, no cuts", when: null },
];

/** The audience line's values as the composer hands them in: the creator's own audience, closed. */
const audience = (over: Partial<HomeAudience> = {}): HomeAudience => ({
  name: "@creator_one",
  general: false,
  open: false,
  onOpen: vi.fn(),
  ...over,
});

function props(over: Partial<HomeScreenProps> = {}): HomeScreenProps {
  return {
    greeting: "Good morning, Nia.",
    audience: audience(),
    // The drawer's opener as a container passes it; given a face, since a screen test has no shell.
    opener: <MenuButton variant="picture" face={{ picture: null, initials: "NL" }} />,
    credits: 30,
    field: <div data-testid="slot" />,
    under: "recent",
    onPickSkill: vi.fn(),
    recent: RECENT,
    onOpenThread: vi.fn(),
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
/** The four cards' list (the grid). */
const cardGrid = () => screen.getByRole("button", { name: "Simulate" }).closest("ul")!;
/** The page's column: the greeting's parent, holding every part in order. */
const column = () => screen.getByRole("heading", { level: 1 }).parentElement!;
const fieldBlock = () => screen.getByTestId("slot").parentElement!;
const moneyPart = () => document.querySelector<HTMLElement>('[data-part="money"]');
const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
/** Money above zero, as `moneyOf` hands it in. */
const EARNED: HomeMoney = { amount: "$58.80", hint: "Earn 50%" };

describe("HomeScreen — greeting and field", () => {
  it("the greeting is the page's only h1", () => {
    renderHome({ greeting: "Good evening." });
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Good evening.");
  });

  it("renders the field once, before the cards", () => {
    renderHome({ under: "cards" });
    expect(screen.getAllByTestId("slot")).toHaveLength(1);
    const slot = screen.getByTestId("slot");
    const firstCard = screen.getByRole("button", { name: "Simulate" });
    expect(slot.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("HomeScreen — the audience line (spec 2026-11-25 §2.3)", () => {
  const line = () => screen.getByRole("button", { name: /, change audience$/ });

  it("says who the next run is for, For @creator_one, with a chevron pointing down", () => {
    renderHome();
    expect(line()).toHaveTextContent(/^For @creator_one$/);
    const chevron = line().querySelector("svg")!;
    expect(chevron).toHaveAttribute("aria-hidden");
    // The chevron is drawn pointing right: turned a quarter, it points down.
    expect(chevron).toHaveClass("rotate-90");
    expect(chevron).toHaveAttribute("width", "14");
    // After the words.
    expect(within(line()).getByText("@creator_one").compareDocumentPosition(chevron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("its name for a screen reader is its words, then what it does: For @creator_one, change audience", () => {
    renderHome();
    expect(line()).toHaveAccessibleName("For @creator_one, change audience");
    // The name holds what is on screen (WCAG 2.5.3): "click For @creator_one" finds it.
    expect(line().getAttribute("aria-label")!.startsWith(line().textContent!)).toBe(true);
  });

  it("the general audience reads For a general audience, and is named For a general audience, change audience", () => {
    renderHome({ audience: audience({ name: "General", general: true }) });
    expect(line()).toHaveTextContent(/^For a general audience$/);
    expect(line()).toHaveAccessibleName("For a general audience, change audience");
  });

  it("which audience is the general one is the composer's to say, not the word: one of the creator's own named General is named", () => {
    renderHome({ audience: audience({ name: "General", general: false }) });
    expect(line()).toHaveTextContent(/^For General$/);
    expect(line()).toHaveAccessibleName("For General, change audience");
  });

  it("sets no focus style of its own, as the cards and the Library link do: the app's ring is the one drawn", () => {
    const own = (el: HTMLElement) => el.className.split(/\s+/).filter((c) => /outline|focus|ring/.test(c));
    renderHome();
    expect(own(line())).toEqual([]);
    expect(own(screen.getByRole("link", { name: "Library" }))).toEqual([]);
    cleanup();
    renderHome({ under: "cards" });
    expect(own(screen.getByRole("button", { name: "Hooks" }))).toEqual([]);
  });

  it("is drawn 15 / 22 in the secondary ink, the name at 560 in the ink, 5 between the words and the chevron", () => {
    renderHome();
    expect(line()).toHaveClass("text-ui", "leading-[22px]", "text-foreground-secondary", "gap-[5px]");
    expect(within(line()).getByText("@creator_one")).toHaveClass("font-[560]", "text-foreground");
    renderHome({ audience: audience({ name: "General", general: true }) });
    expect(screen.getAllByText("a general audience")[0]).toHaveClass("font-[560]", "text-foreground");
  });

  it("sits right after the greeting and before the field: 5 under it on a phone, 8 on desktop; left, then centred as the greeting is", () => {
    renderHome();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.nextElementSibling).toBe(line());
    expect(line().compareDocumentPosition(screen.getByTestId("slot")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line()).toHaveClass("mt-[5px]", "md:mt-2", "self-start", "md:self-center");
    // In line with the greeting's text (its own 4 in).
    expect(heading).toHaveClass("px-1");
    expect(line()).toHaveClass("px-1");
  });

  it("is at least 44 to tap, and a long name gives way at the edge instead of widening the page", () => {
    renderHome({ audience: audience({ name: "@a_creator_with_a_very_long_handle_indeed" }) });
    expect(line()).toHaveClass("tap-44", "max-w-full");
    expect(within(line()).getByText("@a_creator_with_a_very_long_handle_indeed").parentElement).toHaveClass("min-w-0", "truncate");
  });

  it("a press opens the audience sheet, and the line says it opens a dialog and whether it is open", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<HomeScreen {...props({ audience: audience({ onOpen }) })} />);
    expect(line()).toHaveAttribute("aria-haspopup", "dialog");
    expect(line()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(line());
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender(<HomeScreen {...props({ audience: audience({ onOpen, open: true }) })} />);
    expect(line()).toHaveAttribute("aria-expanded", "true");
  });

  it("a pointer tap while its popover is open only closes it (the popover closes on that press); a keyboard press opens", () => {
    const onOpen = vi.fn();
    renderHome({ audience: audience({ onOpen, open: true }) });
    fireEvent.pointerDown(line());
    fireEvent.click(line(), { detail: 1 }); // the pointer's click
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(line(), { detail: 0 }); // the keyboard's
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("with its popover closed a pointer tap opens it", () => {
    const onOpen = vi.fn();
    renderHome({ audience: audience({ onOpen }) });
    fireEvent.pointerDown(line());
    fireEvent.click(line(), { detail: 1 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("hands the composer the line to stand the popover on", () => {
    const anchorRef = { current: null as HTMLButtonElement | null };
    renderHome({ audienceRef: anchorRef });
    expect(anchorRef.current).toBe(line());
  });

  it("the field sits 14 under the line on a phone, 22 on desktop", () => {
    renderHome();
    expect(line().nextElementSibling).toBe(screen.getByTestId("slot").parentElement);
    expect(screen.getByTestId("slot").parentElement!.className).toBe("mx-auto mt-3.5 w-full max-w-[720px] md:mt-[22px]");
  });

  it("has no axe violations, named or general", async () => {
    for (const a of [audience(), audience({ name: "General", general: true })]) {
      const { container } = render(<HomeScreen {...props({ audience: a, under: "cards", recent: [] })} />);
      // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
      expect(await axe(container)).toHaveNoViolations();
      cleanup();
    }
  });
});

describe("HomeScreen — under the field, one of three (spec 2026-11-25 §2.5)", () => {
  const nothingUnderTheField = () => {
    for (const name of CARDS) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Library" })).toBeNull();
  };

  it("not known yet: nothing under the field, no cards, no Recent, no space held", () => {
    renderHome({ under: "pending" });
    nothingUnderTheField();
    // The field is the column's last part: nothing after it, not even an empty block.
    expect(fieldBlock().nextElementSibling).toBeNull();
  });

  it("not known yet, even with rows to hand: still nothing (the composer's list decides, not the rows)", () => {
    renderHome({ under: "pending", recent: RECENT });
    nothingUnderTheField();
  });

  it("chats: Recent right after the field, and no cards", () => {
    renderHome({ under: "recent" });
    expect(fieldBlock().nextElementSibling).toBe(recentSection());
    for (const name of CARDS) expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("no chats: the four cards right after the field, and no Recent", () => {
    renderHome({ under: "cards", recent: [] });
    expect(fieldBlock().nextElementSibling).toBe(cardGrid());
    for (const name of CARDS) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
  });

  it("Recent draws every row it is handed (five at most come from Home's data)", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, title: `Chat number ${i + 1}`, when: "2h ago" }));
    renderHome({ recent: five });
    expect(within(recentSection()!).getAllByRole("listitem")).toHaveLength(5);
  });

  it("Recent shows on desktop too, whatever the sidebar does: nothing hides it from md up", () => {
    renderHome();
    expect(recentSection()!.className).not.toMatch(/(^|\s)md:hidden(\s|$)/);
    expect(recentSection()).toHaveClass("md:mx-auto", "md:w-full", "md:max-w-[720px]");
  });

  it("there is no More skills button in any state (More is in the field)", () => {
    for (const under of ["pending", "recent", "cards"] as const) {
      renderHome({ under });
      expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
      cleanup();
    }
  });
});

describe("HomeScreen — the four skill cards", () => {
  it("lists Simulate, Hooks, Script, Remix in that order, each described by its line", () => {
    renderHome({ under: "cards" });
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

  // That the cards stay on a pick is the composer's to keep (HomeScreen holds no state): pinned in
  // `composer-home.flag-on.test.tsx`, "a card picks its skill: ... the cards stay ...".
  it("a tap on a card calls the pick with that card's skill", () => {
    const p = renderHome({ under: "cards" });
    fireEvent.click(screen.getByRole("button", { name: "Remix" }));
    expect(p.onPickSkill).toHaveBeenCalledWith("remix");
    fireEvent.click(screen.getByRole("button", { name: "Simulate" }));
    expect(p.onPickSkill).toHaveBeenLastCalledWith("test");
  });

  it("the row is as wide as the field: 720 at most, centred", () => {
    renderHome({ under: "cards" });
    expect(cardGrid()).toHaveClass("mx-auto", "w-full", "max-w-[720px]");
    expect(fieldBlock()).toHaveClass("mx-auto", "w-full", "max-w-[720px]");
  });

  it("all four are the same height, two by two and four in a row: equal rows, each card filling its cell", () => {
    renderHome({ under: "cards" });
    // Every row of the grid as tall as the tallest (a wrapped caption makes all of them that tall).
    expect(cardGrid()).toHaveClass("grid", "grid-cols-2", "auto-rows-fr", "@min-[760px]:grid-cols-4");
    for (const name of CARDS) {
      const card = screen.getByRole("button", { name });
      // The cell stretches to its row and the card to its cell.
      expect(card.parentElement).toHaveClass("flex");
      expect(card).toHaveClass("w-full");
      expect(card.parentElement!.className).not.toMatch(/items-(start|center|end)|self-/);
      expect(card.className).not.toMatch(/(^|\s)(h-|self-)/);
    }
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

  it("with no chats (the cards) there is no Recent and no Library link", () => {
    renderHome({ under: "cards", recent: [] });
    expect(screen.queryByRole("heading", { name: "Recent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Library" })).not.toBeInTheDocument();
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

describe("HomeScreen — Recent is not stretched across a wide page (A9)", () => {
  it("from md up it is capped at the field's width and centred", () => {
    renderHome();
    expect(recentSection()).toHaveClass("md:mx-auto", "md:w-full", "md:max-w-[720px]");
  });
});

describe("HomeScreen — Money made, last (spec 2026-11-25 §2.6; Earn rulings 18 and 24)", () => {
  /** Ruling 24a: the class that takes the rate away while Home (the container) is narrower than 360. */
  const DROPPED_UNDER_360 = "@max-[360px]:hidden";
  /** The field's block, under the audience line: 14 on a phone, 22 from md up, with or without money. */
  const FIELD_BLOCK = "mx-auto mt-3.5 w-full max-w-[720px] md:mt-[22px]";
  const shown = (amount: string): HomeMoney => ({ amount, hint: "Earn 50%" });
  const moneyLink = () => screen.getByRole("link", { name: "Money made: $58.80. Earn 50%" });

  it("is one link to Earn, named Money made: $58.80. Earn 50%: the label, the amount, Earn 50% and a chevron", () => {
    renderHome({ money: EARNED });
    const link = moneyLink();
    expect(link).toHaveAttribute("href", "/earn");
    expect(link).toHaveTextContent(/^Money made\s*\$58\.80\s*Earn 50%$/);
    const chevron = link.querySelector("svg");
    expect(chevron).toHaveAttribute("aria-hidden");
    // The last thing in the row, after the words.
    expect(follows(within(link).getByText("Earn 50%"), chevron!)).toBe(true);
    // One link: nothing else in it to tap.
    expect(within(link).queryAllByRole("link")).toHaveLength(0);
    expect(within(link).queryAllByRole("button")).toHaveLength(0);
  });

  it.each([
    ["chats", "recent" as const, () => recentSection()!],
    ["no chats", "cards" as const, () => cardGrid()],
  ])("with %s it is the page's last part, after what is under the field, 12 above it, as wide as the field", (_name, under, before) => {
    renderHome({ under, money: EARNED });
    expect(column().lastElementChild).toBe(moneyPart());
    expect(before().nextElementSibling).toBe(moneyPart());
    expect(moneyPart()).toHaveClass("mx-auto", "mt-3", "w-full", "max-w-[720px]");
    expect(moneyLink()).toHaveClass("w-full");
  });

  it("not known yet: it is the only thing under the field", () => {
    renderHome({ under: "pending", money: EARNED });
    expect(fieldBlock().nextElementSibling).toBe(moneyPart());
    expect(column().lastElementChild).toBe(moneyPart());
  });

  it.each<[string, Partial<HomeScreenProps>]>([
    ["nothing passed", {}],
    ["undefined", { money: undefined }],
    ["null (nothing earned, no amount, loading, refused)", { money: null }],
  ])("%s: no row and no space kept", (_name, over) => {
    renderHome({ ...over, under: "cards" });
    expect(moneyPart()).toBeNull();
    expect(screen.queryByText("Money made")).toBeNull();
    expect(column().lastElementChild).toBe(cardGrid());
  });

  it("the field's place does not depend on it: the same block and gaps with and without the row, and the same element", () => {
    const p = props({ money: null });
    const { rerender } = render(<HomeScreen {...p} />);
    const block = fieldBlock();
    const field = screen.getByTestId("slot");
    expect(block.className).toBe(FIELD_BLOCK);
    expect(screen.getByRole("button", { name: "For @creator_one, change audience" }).nextElementSibling).toBe(block);
    rerender(<HomeScreen {...p} money={EARNED} />);
    expect(fieldBlock()).toBe(block);
    expect(screen.getByTestId("slot")).toBe(field);
    expect(block.className).toBe(FIELD_BLOCK);
  });

  it("is drawn as Home's cards: the surface, the skill card's radius, the resting shadow; the type of Home's rows; no colour", () => {
    renderHome({ money: EARNED });
    const link = moneyLink();
    expect(link).toHaveClass("bg-surface", "rounded-2xl", "shadow-[var(--shadow-rest)]", "hover:shadow-[var(--shadow-lift)]");
    expect(within(link).getByText("Money made")).toHaveClass("text-ui", "text-foreground-secondary");
    // The amount in Home's emphasis (the skill names' and Recent's weight), its digits in columns.
    expect(within(link).getByText("$58.80")).toHaveClass("text-ui", "font-[640]", "text-foreground", "tabular-nums");
    expect(within(link).getByText("Earn 50%")).toHaveClass("text-meta", "text-foreground-secondary");
    // Nothing coral or green: no accent, no tone colour, anywhere in the row.
    for (const el of [link, ...link.querySelectorAll("*")]) {
      expect(el.getAttribute("class") ?? "").not.toMatch(/accent|coral|green|emerald|above|below|success/);
    }
  });

  it("is a 48 tall target, one line: the words do not wrap, the label gives way first", () => {
    renderHome({ money: EARNED });
    const link = moneyLink();
    expect(link).toHaveClass("h-12", "items-center");
    expect(within(link).getByText("Money made")).toHaveClass("min-w-0", "truncate");
    expect(within(link).getByText("$58.80")).toHaveClass("shrink-0", "whitespace-nowrap");
    expect(within(link).getByText("Earn 50%")).toHaveClass("whitespace-nowrap");
  });

  // Ruling 24a. happy-dom lays nothing out: what is shown here is which rows carry the container rule.
  it.each(["$1", "$24", "$240"])("under 360 wide Earn 50% stays beside an amount of four characters or fewer (%s)", (amount) => {
    renderHome({ money: shown(amount) });
    expect(screen.getByTestId("home-next")).toHaveClass("@container");
    const rate = within(screen.getByRole("link", { name: `Money made: ${amount}. Earn 50%` })).getByText("Earn 50%");
    expect(rate).not.toHaveClass(DROPPED_UNDER_360);
    expect(rate.className).not.toMatch(/hidden|invisible|sr-only|opacity-0/);
  });

  it.each(["$0.05", "$24.50", "$1,240", "$1,240.50", "$1,234,567.89"])(
    "under 360 wide Earn 50% gives way to an amount longer than four characters (%s); from 360 it is drawn; the name always holds it",
    (amount) => {
      renderHome({ money: shown(amount) });
      expect(screen.getByTestId("home-next")).toHaveClass("@container");
      const link = screen.getByRole("link", { name: `Money made: ${amount}. Earn 50%` });
      const rate = within(link).getByText("Earn 50%");
      expect(rate).toHaveClass(DROPPED_UNDER_360);
      expect(rate.className.replace(DROPPED_UNDER_360, "")).not.toMatch(/hidden|invisible|sr-only|opacity-0/);
      expect(within(link).getByText(amount).className).not.toMatch(/hidden/);
      expect(link.querySelector("svg")).not.toHaveClass(DROPPED_UNDER_360);
    },
  );

  it("has no axe violations, after Recent and after the cards", async () => {
    for (const under of ["recent", "cards"] as const) {
      const { container } = render(<HomeScreen {...props({ under, money: EARNED })} />);
      // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
      expect(await axe(container)).toHaveNoViolations();
      cleanup();
    }
  });
});

describe("HomeScreen — order (spec 2026-11-25 §2)", () => {
  const inOrder = (parts: Element[]) => {
    for (let i = 1; i < parts.length; i += 1) expect(follows(parts[i - 1]!, parts[i]!)).toBe(true);
  };
  const top = () => [
    screen.getByRole("button", { name: "Open menu" }),
    screen.getByRole("heading", { level: 1 }),
    screen.getByRole("button", { name: "For @creator_one, change audience" }),
    screen.getByTestId("slot"),
  ];

  it("chats: top row, greeting, the audience, field, Recent, Money made", () => {
    renderHome({ under: "recent", money: EARNED });
    inOrder([...top(), screen.getByRole("heading", { name: "Recent" }), screen.getByRole("link", { name: /^Money made/ })]);
  });

  it("no chats: top row, greeting, the audience, field, the cards, Money made", () => {
    renderHome({ under: "cards", money: EARNED });
    inOrder([...top(), screen.getByRole("button", { name: "Simulate" }), screen.getByRole("link", { name: /^Money made/ })]);
  });

  it("not known yet: top row, greeting, the audience, field, Money made", () => {
    renderHome({ under: "pending", money: EARNED });
    inOrder([...top(), screen.getByRole("link", { name: /^Money made/ })]);
  });
});
