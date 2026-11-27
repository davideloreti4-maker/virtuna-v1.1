/** @vitest-environment happy-dom */
/**
 * AudienceScreen, rendered for real: the dev preview's fixtures (made-up audiences through the real model),
 * the real parts, the real shell store. The handlers are spies. Stood in for: the build-time flag (on), and
 * what happy-dom does not compute: the description's layout measures (`scrollHeight`, `clientHeight`) and an
 * image's load state (`complete`, `naturalWidth`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { DEV_NOW, DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";
import { audiencePageOf, type AudiencePage } from "@/lib/audience-next/audience-model";
import type { SignaturePersona } from "@/lib/audience/audience-types";
import { MenuButton } from "@/components/shell/menu-button";
import { useShellStore } from "@/stores/shell-store";

import { AudienceNextLoading, AudienceScreen, type AudienceScreenProps } from "../audience-screen";
import { Face } from "../face";

afterEach(() => {
  cleanup();
  useShellStore.setState({ pushedTitle: "" });
});

const OWN = DEV_PAGES.own.page;

/** The own page, its read's groups changed first (the real model counts them again). */
function withGroups(change: (groups: SignaturePersona[]) => SignaturePersona[]): AudiencePage {
  const input = DEV_PAGES.own.input;
  const signature = input.audience.signature!;
  const audience = { ...input.audience, signature: { ...signature, audience: { ...signature.audience, personas: change(signature.audience.personas) } } };
  return audiencePageOf({ ...input, audience }, DEV_NOW);
}

/** A class list holds every one of these classes. */
const hasClasses = (el: Element, ...names: string[]) => names.every((n) => el.classList.contains(n));

function props(over: Partial<AudienceScreenProps> = {}): AudienceScreenProps {
  return {
    state: { kind: "audience", page: OWN },
    pushed: false,
    focus: null,
    onPickGroup: vi.fn(),
    onSimulate: vi.fn(),
    onUseForNewChats: vi.fn(),
    onRetry: vi.fn(),
    ...over,
  };
}

const showing = (page: AudiencePage, over: Partial<AudienceScreenProps> = {}) =>
  render(<AudienceScreen {...props({ state: { kind: "audience", page }, ...over })} />);

const block = (name: string) => document.querySelector<HTMLElement>(`[data-block="${name}"]`);
const blockNames = () => Array.from(document.querySelectorAll("[data-block]")).map((b) => b.getAttribute("data-block"));
const groupRows = () => Array.from(document.querySelectorAll<HTMLButtonElement>("[data-group-row]"));
/** A click as a pointer gives it: the control takes the focus first. */
const press = (el: HTMLElement) => {
  el.focus();
  fireEvent.click(el);
};

describe("AudienceScreen: an audience, what it shows", () => {
  it("own: the heading, where it came from, the figures, the main button, the groups, the texts, the videos", () => {
    showing(OWN);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Audience"]);

    const source = within(block("source")!);
    expect(source.getByText("@nia.tests")).toBeTruthy();
    expect(source.getByText("TikTok · read 14 Aug · 12 videos")).toBeTruthy();

    const figures = block("figures")!;
    const terms = Array.from(figures.querySelectorAll("dt")).map((d) => d.textContent);
    const values = Array.from(figures.querySelectorAll("dd")).map((d) => d.textContent);
    expect(figures.querySelector("dl")).not.toBeNull();
    expect(terms).toEqual(["Followers", "Likes", "Posts", "Usual views"]);
    expect(values).toEqual(OWN.figures.map((f) => f.value));
    expect(values[3]).toBe("12.8K");

    expect(screen.getByRole("button", { name: /Simulate a video for them/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Use for new chats" })).toBeNull();

    const groups = within(block("groups")!);
    expect(groups.getByRole("heading", { name: "Groups" })).toBeTruthy();
    expect(groups.getByText("share of your viewers")).toBeTruthy();
    const first = OWN.groups[0]!;
    expect(groupRows()[0]!.textContent).toContain(first.name);
    expect(groupRows()[0]!.textContent).toContain(`“${first.line}”`);
    expect(groupRows()[0]!.textContent).toContain(`${first.percent}%`);

    const texts = within(block("texts")!);
    expect(texts.getByRole("heading", { name: "What works with them" })).toBeTruthy();
    expect(texts.getByRole("heading", { name: "What falls flat" })).toBeTruthy();
    expect(texts.getByText(OWN.texts.works!.first, { exact: false })).toBeTruthy();
    expect(texts.queryByText(OWN.texts.works!.rest!, { exact: false })).toBeNull();
    expect(texts.getAllByRole("button", { name: "More" })).toHaveLength(2);

    const videos = within(block("videos")!);
    expect(videos.getByRole("heading", { name: "Your videos Maven read" })).toBeTruthy();
    // No count beside the heading, shown or said: the archive can hold more than one read's posts, so its
    // number disagrees with the source line's "12 videos".
    expect(videos.getByRole("heading", { name: "Your videos Maven read" }).parentElement!.textContent).toBe("Your videos Maven read");
    expect(videos.queryByText(/^\d+( read)?$/)).toBeNull();
    const rows = videos.getAllByRole("listitem").filter((li) => li.hasAttribute("data-video"));
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain(OWN.videos!.rows[0]!.text);
    expect(within(rows[0]!).getByText("259K views")).toBeTruthy();
    expect(rows[0]!.textContent).toContain("20× your usual");
    expect(videos.getByText("Budget meal prep · 6")).toBeTruthy();
    expect(videos.getByRole("list", { name: "What you post about" }).textContent).toContain("Budget meal prep · 6");
    expect(videos.queryAllByRole("button")).toHaveLength(0); // the topics are chips, not buttons
  });

  it("a source with nothing known about it: no line under the title", () => {
    showing({ ...OWN, source: { ...OWN.source, line: "" } });
    const title = within(block("source")!).getByRole("heading", { name: "@nia.tests" });
    expect(title.nextElementSibling).toBeNull();
    expect(block("source")!.querySelectorAll("p")).toHaveLength(0);
  });

  it("a read video's text (up to 160 characters) is cut at two lines", () => {
    const long = "A made-up caption that goes on and on about a week of cheap dinners, the shopping list, the pans, the boxes and the fridge, until it runs out";
    showing({ ...OWN, videos: { ...OWN.videos!, rows: [{ ...OWN.videos!.rows[0]!, text: long }] } });
    const text = within(block("videos")!).getByText(long);
    expect(text.className).toMatch(/\bline-clamp-2\b/);
  });

  it("the figures: one row of as many tiles as figures; four go two by two in a body under 360", () => {
    showing(OWN);
    expect(block("figures")!.querySelector("dl")!.className).toMatch(/(^|\s)grid-cols-2(\s|$)/);
    expect(block("figures")!.querySelector("dl")!.className).toContain("@min-[360px]:grid-cols-4");
    expect(block("figures")!.querySelector("dl > div")!.classList.contains("px-2")).toBe(true);
    cleanup();
    showing(DEV_PAGES.few.page);
    expect(block("figures")!.querySelector("dl")!.className).toMatch(/(^|\s)grid-cols-3(\s|$)/);
  });

  it("the blocks follow the phone's order, each a direct child of the body", () => {
    showing(OWN);
    expect(blockNames()).toEqual(["ring", "source", "figures", "actions", "groups", "texts", "videos"]);
    const body = block("ring")!.parentElement!;
    expect(Array.from(body.children).map((c) => c.getAttribute("data-block"))).toEqual(blockNames());
  });

  it("another creator: their line, their viewers; no figures and no videos when none were read", () => {
    const page = DEV_PAGES.other.page;
    showing(page);
    expect(within(block("source")!).getByText("@leo.makes")).toBeTruthy();
    expect(within(block("source")!).getByText(page.source.line)).toBeTruthy();
    expect(page.source.line.startsWith("Another creator · TikTok")).toBe(true);
    expect(screen.getByText("share of their viewers")).toBeTruthy();
    expect(blockNames()).toEqual(["ring", "source", "actions", "groups", "texts"]);
  });

  it("described: the name, Described by you, the description; the viewers", () => {
    const page = DEV_PAGES.described.page;
    showing(page);
    const source = within(block("source")!);
    expect(source.getByText("Busy parents who meal-prep")).toBeTruthy();
    expect(source.getByText("Described by you")).toBeTruthy();
    expect(source.getByText(page.source.description!)).toBeTruthy();
    expect(screen.getByText("share of the viewers")).toBeTruthy();
    expect(block("figures")).toBeNull();
    expect(block("videos")).toBeNull();
  });

  it("few: no Usual views, and the read videos carry no multiple", () => {
    const page = DEV_PAGES.few.page;
    showing(page);
    expect(Array.from(block("figures")!.querySelectorAll("dt")).map((d) => d.textContent)).toEqual(["Followers", "Likes", "Posts"]);
    expect(block("videos")!.textContent).not.toMatch(/usual/);
    expect(block("videos")!.querySelectorAll("[data-video]")).toHaveLength(2);
    expect(within(block("videos")!).queryByText("2")).toBeNull(); // no count beside the heading
  });

  it("bare: a block with nothing to show is not drawn; the rows have no line", () => {
    showing(DEV_PAGES.bare.page);
    expect(blockNames()).toEqual(["ring", "source", "actions", "groups"]);
    expect(groupRows()[0]!.textContent).not.toMatch(/[“”]/);
  });

  it("an audience with no groups: the pale ring, no Groups card", () => {
    showing({ ...OWN, wedges: [], groups: [] });
    expect(blockNames()).not.toContain("groups");
    const ring = block("ring")!;
    expect(ring.querySelectorAll("[data-wedge]")).toHaveLength(10);
    expect(Array.from(ring.querySelectorAll("[data-wedge]")).every((w) => w.getAttribute("data-look") === "pale")).toBe(true);
    expect(ring.querySelectorAll("text")).toHaveLength(0);
  });

  it("the multiple's tone: green above the usual, coral below it, none around it", () => {
    const posts = [30_000, 10_000, 4_000].map((views, i) => ({ post_id: `p${i}`, caption: `Made-up post ${i}`, views, is_pinned: false }));
    const page = audiencePageOf({ ...DEV_PAGES.own.input, posts }, DEV_NOW);
    expect(page.videos!.rows.map((r) => r.times!.tone)).toEqual(["above", "around", "below"]);
    showing(page);
    const multiples = Array.from(block("videos")!.querySelectorAll<HTMLElement>("[data-times]"));
    expect(multiples.map((m) => m.textContent)).toEqual(page.videos!.rows.map((r) => r.times!.words));
    expect(multiples[0]!.className).toMatch(/\btext-above\b/);
    expect(multiples[1]!.className).not.toMatch(/\btext-above\b|\btext-below-text\b/);
    expect(multiples[2]!.className).toMatch(/\btext-below-text\b/);
  });
});

describe("AudienceScreen: the title", () => {
  it("on a phone the h1 is 24 (the opener, the pill and More share its row: it leaves the name room)", () => {
    showing(OWN);
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveClass("max-md:text-2xl");
    expect(title).not.toHaveClass("max-[374px]:text-2xl");
  });

  it("pushed: the shell's title is the audience's name, and the page's h1 is for a desk only", () => {
    const page = DEV_PAGES["not-default"].page;
    showing(page, { pushed: true });
    expect(useShellStore.getState().pushedTitle).toBe(page.name);
    expect(screen.getByRole("heading", { level: 1 }).className).toMatch(/\bmax-md:hidden\b/);
  });

  it("not pushed: no shell title, the h1 on every width, the phone's band taken back", () => {
    const { container } = showing(OWN);
    expect(useShellStore.getState().pushedTitle).toBe("");
    expect(screen.getByRole("heading", { level: 1 }).className).not.toMatch(/\bmax-md:hidden\b/);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/max-md:-mt-\[var\(--mobile-nav-band\)\]/);
  });

  it("pushed: the phone's band is not taken back (the shell's pushed header sits there)", () => {
    const { container } = showing(OWN, { pushed: true });
    expect((container.firstElementChild as HTMLElement).className).not.toMatch(/mobile-nav-band/);
  });

  it("the name goes on the way out", () => {
    const { unmount } = showing(OWN, { pushed: true });
    unmount();
    expect(useShellStore.getState().pushedTitle).toBe("");
  });

  it("the switcher, then More, at the heading's right", () => {
    showing(OWN, { switcher: <button type="button">pill</button>, menu: <button type="button">dots</button> });
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(within(header).getAllByRole("button").map((b) => b.textContent)).toEqual(["pill", "dots"]);
  });
});

describe("AudienceScreen: the drawer's opener", () => {
  // As a container passes it; given a face, since a screen test has no shell.
  const OPENER = <MenuButton variant="picture" face={{ picture: null, initials: "NL" }} />;
  const slot = () => document.querySelector<HTMLElement>('[data-part="opener"]');
  // The face the drawer's frame publishes, for the loading frame (it passes the opener without one).
  afterEach(() => useShellStore.setState({ drawerOpen: false, accountFace: null }));

  /** The header's row: the opener's slot first, then the h1. */
  function expectOpenerBeforeHeading() {
    const opener = screen.getByRole("button", { name: "Open menu" });
    expect(opener).toHaveTextContent("NL");
    const part = slot()!;
    expect(part.contains(opener)).toBe(true);
    expect(part).toHaveClass("flex", "shrink-0", "md:hidden");
    const header = part.parentElement!;
    expect(header.tagName).toBe("HEADER");
    expect(header.firstElementChild).toBe(part);
    expect(part.nextElementSibling).toBe(screen.getByRole("heading", { level: 1, name: "Audience" }));
  }

  it("the opener comes before the heading on /audience", () => {
    showing(OWN, { opener: OPENER, switcher: <button type="button">pill</button>, menu: <button type="button">dots</button> });
    expectOpenerBeforeHeading();
    // Then the switcher and More at the right, as before.
    const header = slot()!.parentElement!;
    expect(within(header).getAllByRole("button").map((b) => b.textContent)).toEqual(["NL", "pill", "dots"]);
    // Not a slot of an audience: none yet, a failed read and the outline carry it too.
    for (const state of [{ kind: "none" }, { kind: "failed" }, { kind: "loading" }] as const) {
      cleanup();
      render(<AudienceScreen {...props({ state, opener: OPENER })} />);
      expectOpenerBeforeHeading();
    }
  });

  it("a pushed audience draws no opener, even when one is given", () => {
    showing(DEV_PAGES["not-default"].page, { opener: OPENER, pushed: true, switcher: <button type="button">pill</button> });
    expect(slot()).toBeNull();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    cleanup();
    // Pushed with nothing at the right: still no row on the phone, and no opener in it.
    render(<AudienceScreen {...props({ state: { kind: "none" }, pushed: true, opener: OPENER })} />);
    expect(slot()).toBeNull();
    expect(document.querySelector("header")).toHaveClass("max-md:hidden");
  });

  it("AudienceNextLoading draws the opener on /audience, not when pushed", () => {
    useShellStore.setState({ accountFace: { picture: null, initials: "NL" } });
    render(<AudienceNextLoading pushed={false} />);
    expectOpenerBeforeHeading();
    cleanup();
    render(<AudienceNextLoading pushed />);
    expect(slot()).toBeNull();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
  });
});

describe("AudienceScreen: the groups", () => {
  it("four rows, then All 10, which opens the other six and puts the focus on the fifth row", () => {
    showing(OWN);
    expect(groupRows().map((r) => r.getAttribute("data-group-row"))).toEqual(OWN.groups.slice(0, 4).map((g) => g.group));
    const all = screen.getByRole("button", { name: "All 10" });
    expect(all.getAttribute("aria-expanded")).toBe("false");
    press(all);
    expect(groupRows().map((r) => r.getAttribute("data-group-row"))).toEqual(OWN.groups.map((g) => g.group));
    expect(screen.queryByRole("button", { name: "All 10" })).toBeNull();
    expect(document.activeElement).toBe(groupRows()[4]);
  });

  it("a row opens its group's sheet: onPickGroup with the group and the row's button", () => {
    const onPickGroup = vi.fn();
    showing(OWN, { onPickGroup });
    const row = groupRows()[1]!;
    expect(row.getAttribute("aria-haspopup")).toBe("dialog");
    press(row);
    expect(onPickGroup).toHaveBeenCalledTimes(1);
    expect(onPickGroup).toHaveBeenCalledWith(OWN.groups[1]!.group, row);
  });

  it("a wedge's tap area opens it too, with no row to return to", () => {
    const onPickGroup = vi.fn();
    showing(OWN, { onPickGroup });
    fireEvent.click(document.querySelector(`[data-wedge-area="${OWN.groups[6]!.group}"]`)!);
    expect(onPickGroup).toHaveBeenCalledWith(OWN.groups[6]!.group, null);
  });

  it("the focused group's wedge stays; the ring names it", () => {
    const focus = OWN.groups[2]!;
    showing(OWN, { focus: focus.group });
    expect(block("ring")!.querySelectorAll("[data-dimmed]")).toHaveLength(9);
    expect(block("ring")!.textContent).toContain(focus.name);
  });
});

describe("AudienceScreen: the texts", () => {
  it("a text's More shows the rest in place and moves the focus to it", () => {
    showing(OWN);
    const texts = within(block("texts")!);
    press(texts.getAllByRole("button", { name: "More" })[0]!);
    const rest = texts.getByText(OWN.texts.works!.rest!);
    expect(document.activeElement).toBe(rest);
    expect(texts.getAllByRole("button", { name: "More" })).toHaveLength(1);
    expect(texts.queryByText(OWN.texts.flat!.rest!)).toBeNull();
  });

  it("a missing text is left out; with both missing, no card", () => {
    showing({ ...OWN, texts: { works: { first: "Short and plain.", rest: null }, flat: null } });
    const texts = within(block("texts")!);
    expect(texts.getByRole("heading", { name: "What works with them" })).toBeTruthy();
    expect(texts.queryByRole("heading", { name: "What falls flat" })).toBeNull();
    expect(texts.queryByRole("button", { name: "More" })).toBeNull();
    cleanup();
    showing({ ...OWN, texts: { works: null, flat: null } });
    expect(block("texts")).toBeNull();
  });
});

describe("AudienceScreen: the description", () => {
  /** The description's box, as a browser would measure it: `full` tall inside a box `shown` tall. */
  function measured(full: number, shown: number) {
    const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => full });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => shown });
    return () => {
      if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scroll);
      if (client) Object.defineProperty(HTMLElement.prototype, "clientHeight", client);
    };
  }

  it("cut at three lines: More unclamps it in place and takes the focus to it", () => {
    const restore = measured(120, 60);
    try {
      const page = DEV_PAGES.described.page;
      showing(page);
      const source = within(block("source")!);
      const text = source.getByText(page.source.description!);
      expect(text.className).toMatch(/\bline-clamp-3\b/);
      press(source.getByRole("button", { name: "More" }));
      expect(text.className).not.toMatch(/\bline-clamp-3\b/);
      expect(source.queryByRole("button", { name: "More" })).toBeNull();
      expect(document.activeElement).toBe(text);
    } finally {
      restore();
    }
  });

  it("not cut: no More", () => {
    const restore = measured(60, 60);
    try {
      showing(DEV_PAGES.described.page);
      expect(within(block("source")!).queryByRole("button", { name: "More" })).toBeNull();
    } finally {
      restore();
    }
  });
});

describe("AudienceScreen: the buttons", () => {
  it("Use for new chats only when the audience is not the default, above the main button", () => {
    showing(DEV_PAGES["not-default"].page, { pushed: true });
    const use = screen.getByRole("button", { name: "Use for new chats" });
    const simulate = screen.getByRole("button", { name: /Simulate a video for them/ });
    expect(use.compareDocumentPosition(simulate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(block("actions")!).getAllByRole("button")).toEqual([use, simulate]);
  });

  it("each button calls its handler once", () => {
    const onSimulate = vi.fn();
    const onUseForNewChats = vi.fn();
    showing(DEV_PAGES["not-default"].page, { onSimulate, onUseForNewChats });
    press(screen.getByRole("button", { name: /Simulate a video for them/ }));
    press(screen.getByRole("button", { name: "Use for new chats" }));
    expect(onSimulate).toHaveBeenCalledTimes(1);
    expect(onUseForNewChats).toHaveBeenCalledTimes(1);
  });

  it("not while busy names it: busy, and a press does nothing", () => {
    const onSimulate = vi.fn();
    const onUseForNewChats = vi.fn();
    const { rerender } = showing(DEV_PAGES["not-default"].page, { onSimulate, onUseForNewChats, busy: "simulate" });
    const simulate = screen.getByRole("button", { name: /Simulate a video for them/ });
    expect(simulate.getAttribute("aria-busy")).toBe("true");
    press(simulate);
    expect(onSimulate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(simulate); // still in the tab order: the focus is not dropped

    rerender(
      <AudienceScreen
        {...props({ state: { kind: "audience", page: DEV_PAGES["not-default"].page }, onSimulate, onUseForNewChats, busy: "default" })}
      />,
    );
    const use = screen.getByRole("button", { name: "Use for new chats" });
    expect(use.getAttribute("aria-busy")).toBe("true");
    expect(simulate.getAttribute("aria-busy")).toBeNull();
    press(use);
    expect(onUseForNewChats).not.toHaveBeenCalled();
  });

  it("Read again: the source card's round button, only when given and the audience can be read again", () => {
    const onReadAgain = vi.fn();
    showing(OWN, { onReadAgain });
    const again = within(block("source")!).getByRole("button", { name: "Read again" });
    press(again);
    expect(onReadAgain).toHaveBeenCalledTimes(1);
    expect(onReadAgain).toHaveBeenCalledWith(again);
    cleanup();
    showing(OWN);
    expect(screen.queryByRole("button", { name: "Read again" })).toBeNull();
    cleanup();
    showing(DEV_PAGES.described.page, { onReadAgain });
    expect(screen.queryByRole("button", { name: "Read again" })).toBeNull();
  });
});

describe("AudienceScreen: no audience yet, failure, loading, building", () => {
  it("none: the pale ring with nothing in the middle, the invitation, its two links; no switcher, no menu", () => {
    render(
      <AudienceScreen
        {...props({ state: { kind: "none" } })}
        switcher={<button type="button">pill</button>}
        menu={<button type="button">dots</button>}
      />,
    );
    const ring = block("ring")!;
    expect(Array.from(ring.querySelectorAll("[data-wedge]")).every((w) => w.getAttribute("data-look") === "pale")).toBe(true);
    expect(ring.querySelectorAll("text")).toHaveLength(0);
    expect(screen.getByText("These are general viewers")).toBeTruthy();
    expect(
      screen.getByText("Read your TikTok account and Maven simulates for the people who watch you. About two minutes, free."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Build my audience" }).getAttribute("href")).toBe("/audience/new?door=connect");
    expect(screen.getByRole("link", { name: "Describe one instead" }).getAttribute("href")).toBe("/audience/new?door=describe");
    expect(screen.queryByRole("button", { name: "pill" })).toBeNull();
    expect(screen.queryByRole("button", { name: "dots" })).toBeNull();
    expect(useShellStore.getState().pushedTitle).toBe("");
  });

  it("none, pushed (/audience/general): the shell's title is Audience", () => {
    render(<AudienceScreen {...props({ state: { kind: "none" }, pushed: true })} />);
    expect(useShellStore.getState().pushedTitle).toBe("Audience");
  });

  it("failed: the heading, an alert, and Try again", () => {
    const onRetry = vi.fn();
    render(<AudienceScreen {...props({ state: { kind: "failed" }, onRetry })} switcher={<button type="button">pill</button>} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Audience");
    expect(screen.getByRole("alert").textContent).toBe("Couldn't load your audience.");
    press(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "pill" })).toBeNull();
  });

  it("loading: busy, a line for screen readers, the heading; no switcher, no menu", () => {
    const { container } = render(
      <AudienceScreen {...props({ state: { kind: "loading" } })} switcher={<button type="button">pill</button>} menu={<span>dots</span>} />,
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Loading your audience");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Audience");
    expect(screen.queryByRole("button", { name: "pill" })).toBeNull();
    expect(screen.queryByText("dots")).toBeNull();
  });

  it("AudienceNextLoading renders the loading state, pushed or not", () => {
    render(<AudienceNextLoading pushed />);
    expect(screen.getByRole("status").textContent).toBe("Loading your audience");
    expect(useShellStore.getState().pushedTitle).toBe("Audience");
    expect(screen.getByRole("heading", { level: 1 }).className).toMatch(/\bmax-md:hidden\b/);
    cleanup();
    render(<AudienceNextLoading pushed={false} />);
    expect(useShellStore.getState().pushedTitle).toBe("");
  });

  it("building replaces the body; the header stays", () => {
    showing(OWN, { building: <p>Reading the account</p> });
    expect(screen.getByText("Reading the account")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Audience");
    expect(blockNames()).toEqual([]);
  });
});

describe("Face", () => {
  it("the initial; a picture over it, which removes itself when it fails to load", () => {
    const { container, rerender } = render(<Face face={{ initial: "N", picture: null }} size={40} />);
    expect(container.textContent).toBe("N");
    expect(container.querySelector("img")).toBeNull();
    rerender(<Face face={{ initial: "N", picture: "https://example.com/a.jpg" }} size={40} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("N");
    rerender(<Face face={{ initial: "N", picture: "https://example.com/b.jpg" }} size={40} />);
    expect(container.querySelector("img")).not.toBeNull(); // a new address is tried
  });

  it("the source card shows the audience's initial", () => {
    showing(OWN);
    expect(block("source")!.querySelector("[data-face]")!.textContent).toBe("N");
  });

  it("a face with a platform carries its badge on the corner, outside the round clip; one with none carries none", () => {
    const { container, rerender } = render(<Face face={{ initial: "N", picture: null, platform: "instagram" }} size={40} />);
    const badge = container.querySelector("[data-platform-badge]")!;
    expect(badge.getAttribute("data-platform-badge")).toBe("instagram");
    expect(badge.closest("[data-face]")).toBeNull(); // not inside the clipped disc
    expect(container.querySelector("[data-face]")!.textContent).toBe("N");
    rerender(<Face face={{ initial: "N", picture: null, platform: null }} size={40} />);
    expect(container.querySelector("[data-platform-badge]")).toBeNull();
  });

  it("the source card: the platform's badge on the face, and its mark right before the platform's name in the line", () => {
    showing(OWN);
    const source = block("source")!;
    expect(source.querySelector("[data-platform-badge]")!.getAttribute("data-platform-badge")).toBe("tiktok");
    const line = within(source).getByText("TikTok · read 14 Aug · 12 videos");
    const logo = line.querySelector("[data-platform-logo]")!;
    expect(logo.getAttribute("data-platform-logo")).toBe("tiktok");
    expect(logo.nextSibling!.textContent).toBe("TikTok · read 14 Aug · 12 videos");
  });

  it("another creator's line: the mark sits before the platform's name, mid-line", () => {
    const other = { ...OWN, face: { ...OWN.face, platform: "tiktok" as const }, source: { ...OWN.source, line: "Another creator · TikTok · 8 videos" } };
    showing(other);
    const line = within(block("source")!).getByText("Another creator · TikTok · 8 videos");
    const logo = line.querySelector("[data-platform-logo]")!;
    expect(logo.previousSibling!.textContent).toBe("Another creator · ");
    expect(logo.nextSibling!.textContent).toBe("TikTok · 8 videos");
  });
});

describe("VideosCard: covers", () => {
  const COVER = "https://proj.supabase.co/storage/v1/object/public/covers/account/tiktok/1.jpg";
  const withCovers = (covers: (string | null)[]): AudiencePage => ({
    ...OWN,
    videos: { ...OWN.videos!, rows: OWN.videos!.rows.map((r, i) => ({ ...r, cover: covers[i] ?? null })) },
  });
  const thumbs = () => Array.from(block("videos")!.querySelectorAll<HTMLElement>("[data-video] [data-thumb]"));

  it("each row leads with a 9:16 tile; a stored cover is drawn in it, without a referrer", () => {
    showing(withCovers([COVER, null, null]));
    const tiles = thumbs();
    expect(tiles).toHaveLength(3);
    const img = tiles[0]!.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(COVER);
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(hasClasses(tiles[0]!, "h-[58px]", "w-[44px]", "rounded-lg")).toBe(true);
    // No cover: the blank tile alone, so the captions stay aligned.
    expect(tiles[1]!.querySelector("img")).toBeNull();
  });

  it("a cover that fails to load leaves the blank tile, never a broken image", () => {
    showing(withCovers([COVER]));
    const tile = thumbs()[0]!;
    fireEvent.error(tile.querySelector("img")!);
    expect(tile.querySelector("img")).toBeNull();
    expect(thumbs()).toHaveLength(3);
  });
});

describe("AudienceScreen: fewer groups, missing parts, long words", () => {
  it("two topics alike (a creator can name two the same) both show, with no clash of keys", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const topics = ["Meal prep · 2", "Meal prep · 2"];
    showing({ ...OWN, videos: { ...OWN.videos!, topics } });
    const list = within(block("videos")!).getByRole("list", { name: "What you post about" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(errors.mock.calls.some((c) => String(c[0]).includes("same key"))).toBe(false);
    errors.mockRestore();
  });

  it("four groups: four rows, no All", () => {
    showing(withGroups((g) => g.slice(0, 4)));
    expect(groupRows()).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /^All \d+$/ })).toBeNull();
  });

  it("seven groups: four rows, then All 7, which opens the other three", () => {
    showing(withGroups((g) => g.slice(0, 7)));
    expect(groupRows()).toHaveLength(4);
    press(screen.getByRole("button", { name: "All 7" }));
    expect(groupRows()).toHaveLength(7);
    expect(document.activeElement).toBe(groupRows()[4]);
  });

  it("a group with no line beside one with a line", () => {
    const page = withGroups((g) => g.map((p, i) => (i === 1 ? { ...p, blurb: "" } : p)));
    expect(page.groups[1]!.line).toBeNull();
    showing(page);
    expect(groupRows()[0]!.textContent).toMatch(/“.+”/);
    expect(groupRows()[1]!.textContent).not.toMatch(/[“”]/);
    expect(groupRows()[1]!.textContent).toContain(page.groups[1]!.name);
  });

  it("no first text: only What falls flat", () => {
    showing({ ...OWN, texts: { works: null, flat: OWN.texts.flat } });
    const texts = within(block("texts")!);
    expect(texts.getAllByRole("heading").map((h) => h.textContent)).toEqual(["What falls flat"]);
    expect(texts.getByText(OWN.texts.flat!.first, { exact: false })).toBeTruthy();
  });

  it("a long handle wraps onto two lines at most, inside the card", () => {
    const handle = `@${"made.up.handle.".repeat(4)}end`;
    showing({ ...OWN, source: { ...OWN.source, title: handle } });
    const title = within(block("source")!).getByRole("heading", { name: handle });
    expect(hasClasses(title, "line-clamp-2", "break-words")).toBe(true);
    expect(title.classList.contains("truncate")).toBe(false);
    expect(title.parentElement!.classList.contains("min-w-0")).toBe(true);
  });

  it("a long group line and a long group name break inside the row", () => {
    const long = `${"Averyveryverylongwordwithoutanyspace".repeat(3)} and more`;
    showing({ ...OWN, groups: OWN.groups.map((g, i) => (i === 0 ? { ...g, line: long } : g)) });
    const line = within(groupRows()[0]!).getByText(`“${long}”`);
    expect(line.classList.contains("break-words")).toBe(true);
    expect(line.parentElement!.classList.contains("min-w-0")).toBe(true);
    expect(within(groupRows()[0]!).getByText(OWN.groups[0]!.name).classList.contains("break-words")).toBe(true);
  });

  it("a long caption is cut at two lines and breaks inside the row", () => {
    const long = "Averyveryverylongcaptionwordwithoutanyspaceatallthatgoesonandon and a few more words after it";
    showing({ ...OWN, videos: { ...OWN.videos!, rows: [{ ...OWN.videos!.rows[0]!, text: long }] } });
    expect(hasClasses(within(block("videos")!).getByText(long), "line-clamp-2", "break-words", "min-w-0")).toBe(true);
  });

  it("a long topic is cut on its chip and never breaks its row", () => {
    const topic = `Made-up topic ${"x".repeat(46)}`;
    expect(topic.length).toBe(60);
    showing({ ...OWN, videos: { ...OWN.videos!, topics: [topic] } });
    const text = within(block("videos")!).getByText(topic);
    expect(text.classList.contains("truncate")).toBe(true);
    expect(hasClasses(text.closest("li")!, "max-w-full", "min-w-0")).toBe(true);
  });

  it("an opened description breaks a long word inside the card", () => {
    showing(DEV_PAGES.described.page);
    expect(within(block("source")!).getByText(DEV_PAGES.described.page.source.description!).classList.contains("break-words")).toBe(true);
  });
});

describe("AudienceScreen: what a screen reader hears", () => {
  it("the ring says its total; the pale ring says nothing", () => {
    showing(OWN);
    const total = within(block("ring")!).getByText("1,000 viewers");
    expect(total.className).toMatch(/\bsr-only\b/);
    cleanup();
    render(<AudienceScreen {...props({ state: { kind: "none" } })} />);
    expect(within(block("ring")!).queryByText("1,000 viewers")).toBeNull();
  });

  it("each More says it opens something closed, as All 10 does", () => {
    const restore = (() => {
      const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 999 });
      return () => {
        if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scroll);
      };
    })();
    try {
      showing(DEV_PAGES.described.page);
      const mores = screen.getAllByRole("button", { name: "More" });
      expect(mores).toHaveLength(3); // the description's and the two texts'
      for (const more of mores) expect(more.getAttribute("aria-expanded")).toBe("false");
    } finally {
      restore();
    }
  });
});

describe("Face: a picture that failed before the page woke up", () => {
  /** An image's load state, as the browser would report it. */
  function loaded(complete: boolean, naturalWidth: number) {
    const c = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const w = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => complete });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => naturalWidth });
    return () => {
      if (c) Object.defineProperty(HTMLImageElement.prototype, "complete", c);
      else delete (HTMLImageElement.prototype as { complete?: boolean }).complete;
      if (w) Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", w);
      else delete (HTMLImageElement.prototype as { naturalWidth?: number }).naturalWidth;
    };
  }

  it.each([
    ["finished and broken: the initial shows", true, 0, false],
    ["finished and drawn: the picture stays", true, 120, true],
    ["still loading: the picture stays, its own error decides", false, 0, true],
  ])("%s", (_name, complete, width, kept) => {
    const restore = loaded(complete, width);
    try {
      const { container } = render(<Face face={{ initial: "N", picture: "https://example.com/a.jpg" }} size={40} />);
      expect(container.querySelector("img") !== null).toBe(kept);
      expect(container.textContent).toBe("N");
    } finally {
      restore();
    }
  });
});

describe("AudienceScreen: axe", () => {
  it.each([
    ["own", () => showing(OWN, { onReadAgain: vi.fn() })],
    ["described", () => showing(DEV_PAGES.described.page)],
    ["none", () => render(<AudienceScreen {...props({ state: { kind: "none" } })} />)],
    ["failed", () => render(<AudienceScreen {...props({ state: { kind: "failed" } })} />)],
  ])("finds nothing in %s", async (_name, draw) => {
    const { container } = draw();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });

  it("finds nothing with every group open and a text's rest shown", async () => {
    const { container } = showing(OWN);
    press(screen.getByRole("button", { name: "All 10" }));
    await act(async () => {
      press(within(block("texts")!).getAllByRole("button", { name: "More" })[0]!);
    });
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
