/** @vitest-environment happy-dom */
/**
 * /dev/discover exists in the new look only. The flag is a build-time constant, so each case loads
 * the page fresh with the flag set the way that build would have it (as /dev/library's test does).
 * Each state is rendered for real and shows what it is named for.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.setConfig({ testTimeout: 30_000 });

// A video's page carries its own Back on a desk (the router's); the rest of the module is Next's own,
// so `notFound()` still throws what Next throws.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../page")).default;
}

const search = (params: Record<string, string> = {}) => ({ searchParams: Promise.resolve(params) });

/** What Next throws for notFound(): an error whose digest names the outcome. */
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

type Props = { state: string };

/** The page in a state, rendered. */
async function shown(state?: string) {
  const Page = await load(true);
  const element = (await Page(search(state ? { state } : {}))) as ReactElement<Props>;
  expect(isValidElement(element)).toBe(true);
  render(element);
  return element;
}

const countLine = () => document.querySelector('[data-part="count"]')?.textContent ?? null;
const cards = () => within(screen.getByRole("list", { name: "Videos" })).queryAllByRole("link");

describe("/dev/discover", () => {
  it("is not found with the flag off", async () => {
    const Page = await load(false);
    expect(await thrown(() => Page(search({ state: "videos" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("an unknown state is not found", async () => {
    const Page = await load(true);
    expect(await thrown(() => Page(search({ state: "nope" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("opens on the Videos grid by default: thirty proven videos, 24 shown, Show more", async () => {
    const element = await shown();
    expect(element.props.state).toBe("videos");
    expect(countLine()).toBe("30 proven videos");
    expect(cards()).toHaveLength(24);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
    // Five cards show no line: they are named by their creator.
    expect(cards().filter((card) => card.getAttribute("aria-label")?.startsWith("Video by @"))).toHaveLength(5);
  });

  it("loading: the outline, busy, no count", async () => {
    await shown("loading");
    expect(screen.getByRole("list", { name: "Videos" })).toHaveAttribute("aria-busy", "true");
    expect(countLine()).toBeNull();
  });

  it("error: the failure and Try again", async () => {
    await shown("error");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the videos.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("filtered: the filter's names and Clear", async () => {
    await shown("filtered");
    expect(countLine()).toMatch(/^Comedy · TikTok · \d+ videos?$/);
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("search: the field holds the words and the grid answers them", async () => {
    await shown("search");
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("bread");
    expect(cards()).toHaveLength(1);
  });

  it("nomatch: the sentence and Clear", async () => {
    await shown("nomatch");
    expect(screen.getByRole("status")).toHaveTextContent("No video matches that.");
  });

  it("video: a proven video with its line, the multiple, why it works with More, timed beats, Save, the watch link and Remix", async () => {
    await shown("video");
    expect(screen.getByRole("heading", { level: 1, name: "Video" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "I tried to build a desk with no tools" })).toBeInTheDocument();
    expect(screen.getByText("27× their average")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(document.querySelector('[data-part="bar"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: "Watch on TikTok, opens in a new tab" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remix this · 10 credits" })).toBeInTheDocument();
  });

  it("video-plain: no line, no multiple, beats without times, no original to open or remix", async () => {
    await shown("video-plain");
    expect(screen.getByRole("heading", { level: 2, name: "Video by @sam.bakes" })).toBeInTheDocument();
    expect(screen.queryByText(/×/)).toBeNull();
    expect(screen.getByText("How it's built")).toBeInTheDocument();
    expect(document.querySelector('[data-part="bar"]')).toBeNull();
    expect(screen.queryByRole("link", { name: /^Watch/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remix this · 10 credits" })).toBeNull();
  });

  it("video-shaky: past 100, the quiet line, no beats", async () => {
    await shown("video-shaky");
    expect(screen.getByText("more than 100× their average")).toBeInTheDocument();
    expect(screen.getByText("A small account makes this number shaky.")).toBeInTheDocument();
    expect(screen.queryByText("How it's built")).toBeNull();
  });

  it("video-gone: the sentence and Back to Discover", async () => {
    await shown("video-gone");
    expect(screen.getByText("This video isn't in the library any more.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Discover" })).toHaveAttribute("href", "/feed");
  });

  it("collections: the four shelves in order, four cards at most on each, See all where a shelf holds more", async () => {
    await shown("collections");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Formats",
      "Visual hooks",
      "Editing styles",
      "Signature series",
    ]);
    const formats = screen.getByRole("list", { name: "Formats" });
    expect(within(formats).getAllByRole("link")).toHaveLength(4);
    expect(within(formats).getByRole("link", { name: "Ranking/Rating/Tier List" })).toHaveAttribute(
      "href",
      "/feed/collection/ranking-rating-tier-list?shelf=formats",
    );
    expect(screen.getByRole("button", { name: "See all 6" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
  });

  it("collection-search: the field holds the words and the shelves answer them by name", async () => {
    await shown("collection-search");
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("skit");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Formats", "Visual hooks"]);
    expect(screen.getAllByRole("link").map((card) => card.getAttribute("aria-label"))).toEqual(["Skit/Humor", "Skit cold open"]);
  });

  it("collection: a collection's page, its name, its count, 24 cards, Show more, a card without a badge", async () => {
    await shown("collection");
    expect(screen.getByRole("heading", { level: 1, name: "Ranking/Rating/Tier List" })).toBeInTheDocument();
    expect(countLine()).toBe("26 videos");
    expect(cards()).toHaveLength(24);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
    expect(cards().filter((card) => card.querySelector('[data-part="badge"]') === null).length).toBeGreaterThan(0);
  });

  it("collection-gone: the sentence and Back to Discover, to the Collections chip", async () => {
    await shown("collection-gone");
    expect(screen.getByText("This collection isn't in the library any more.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Discover" })).toHaveAttribute("href", "/feed?tab=collections");
  });

  it("watchlist: the Watchlist chip, one card of rows (one that could not be read, one a link to the creator's page), the Follow row last", async () => {
    await shown("watchlist");
    expect(within(screen.getByRole("group", { name: "Discover" })).getByRole("button", { name: "Watchlist" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(screen.getByRole("list", { name: "Watchlist" })).getByRole("link", { name: "@nia.cooks" })).toHaveAttribute(
      "href",
      "/competitors/nia.cooks",
    );
    const rows = within(screen.getByRole("list", { name: "Watchlist" })).getAllByRole("button");
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.at(-1)).toHaveAccessibleName("Follow a creator");
    expect(screen.getByRole("button", { name: "@jay.makes" })).toHaveAccessibleDescription(/followers · \d+ proven$/);
    expect(screen.getByText("Couldn't be read")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-part="covers"] img').length).toBeGreaterThan(0);
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
  });

  it("watchlist-empty: nobody yet, Follow a creator, and the library's count", async () => {
    await shown("watchlist-empty");
    expect(screen.getByText("Nobody on your watchlist yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow a creator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 proven videos are in the library" })).toBeInTheDocument();
  });

  it("watchlist-error: the watchlist's failure and Try again", async () => {
    await shown("watchlist-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the watchlist.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  const pullOffer = () => document.querySelector<HTMLElement>('[data-part="pull-offer"]');

  it("offer: a @handle the library holds nothing from: the pull row above the library's sentence", async () => {
    await shown("offer");
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("@kai.wanders");
    expect(pullOffer()).toHaveTextContent("Pull @kai.wanders's best videos");
    expect(pullOffer()).toHaveTextContent("Ranked against their own average. 5 credits.");
    expect(within(pullOffer()!).getByRole("button", { name: "Pull" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Nothing from @kai.wanders in the library yet.");
  });

  it("offer-words: words the library has no video for: Pull videos about them", async () => {
    await shown("offer-words");
    expect(pullOffer()).toHaveTextContent("Pull videos about “sourdough starter”");
    expect(pullOffer()).toHaveTextContent("5 credits");
  });

  it("offer-link: a link that is not TikTok: the sentence, no Pull", async () => {
    await shown("offer-link");
    expect(pullOffer()).toHaveTextContent("Only TikTok can be read right now.");
    expect(screen.queryByRole("button", { name: "Pull" })).toBeNull();
  });

  it("pull-offer: the pull page by its address: the title, the offer row, Follow", async () => {
    await shown("pull-offer");
    expect(screen.getByRole("heading", { level: 1, name: "@kai.wanders" })).toBeInTheDocument();
    expect(pullOffer()).toHaveTextContent("Pull @kai.wanders's best videos");
    expect(screen.getByRole("button", { name: "Pull" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("pull-running: the sentence and twelve outlines", async () => {
    await shown("pull-running");
    expect(screen.getByRole("status")).toHaveTextContent("Reading @kai.wanders's videos. This can take a few minutes.");
    expect(screen.getByRole("list", { name: "Videos" })).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll('[data-part="outline"]')).toHaveLength(12);
  });

  it("pull-done: the count, Biggest jump, and the cards as buttons", async () => {
    await shown("pull-done");
    expect(screen.getByText(/^\d+ videos read$/)).toBeInTheDocument();
    expect(screen.getByText("Biggest jump")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Videos" });
    expect(within(list).queryAllByRole("link")).toEqual([]);
    expect(within(list).getAllByRole("button").length).toBeGreaterThan(6);
    expect(document.body.textContent).not.toMatch(/#\p{L}/u);
  });

  it("pull-empty: no standout videos", async () => {
    await shown("pull-empty");
    expect(screen.getByRole("status")).toHaveTextContent("No standout videos for @kai.wanders.");
  });

  it("pull-limit: the daily limit, no Try again", async () => {
    await shown("pull-limit");
    expect(screen.getByRole("alert")).toHaveTextContent("You've pulled 20 times today. Try again tomorrow.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("pull-failed: Couldn't read, and Try again", async () => {
    await shown("pull-failed");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read @kai.wanders.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  // ─── A followed creator's page ───────────────────────────────────────────────

  const creatorCard = () => document.querySelector<HTMLElement>('[data-part="creator-card"]');
  /** The card's one line under the name ("@jay.makes · TikTok · read 13 Jul · 12 videos"). */
  const creatorLine = () => creatorCard()!.querySelector<HTMLElement>("[aria-live]")!.textContent;
  const cardName = () => within(creatorCard()!).getByRole("heading", { level: 2 }).textContent;
  const readAgain = () => within(creatorCard()!).getByRole("button", { name: "Read again" });
  const column = () => document.querySelector<HTMLElement>('[data-part="creator"]')!;
  const terms = () => within(column()).queryAllByRole("term").map((t) => t.textContent);
  const values = () => within(column()).queryAllByRole("definition").map((d) => d.textContent);
  const theirCards = () => within(screen.getByRole("list", { name: "Their videos" })).getAllByRole("button");
  const badges = () => theirCards().map((c) => c.querySelector('[data-part="badge"]')?.textContent ?? null);
  const READ_TODAY = "Read today. Maven reads a creator once a day.";
  /** Made-up reads and waits take 1.5 s here: the clock is the test's from this point. */
  const timed = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  it("creator: the card, the line, four figures, Build their audience, Pull, twelve videos, the first ▲ 12×", async () => {
    await shown("creator");
    expect(screen.getByRole("heading", { level: 1, name: "@jay.makes" })).toBeInTheDocument();
    expect(cardName()).toBe("Jay Makes");
    expect(creatorCard()!.querySelector("[data-face] img")).not.toBeNull();
    expect(creatorCard()!.querySelector('[data-part="bio"]')!.textContent!.split("\n")).toHaveLength(2);
    expect(creatorLine()).toBe("@jay.makes · TikTok · read\u00a013\u00a0Jul · 12\u00a0videos");
    expect(readAgain()).not.toHaveAttribute("aria-disabled");
    // The real rule's figures, from the profile and the read's median.
    expect(terms()).toEqual(["Followers", "Likes", "Posts", "Usual views"]);
    expect(values()).toEqual(["15.4M", "369.1M", "6.4K", "8.6K"]);
    expect(screen.getByRole("link", { name: "Build their audience" })).toHaveAttribute(
      "href",
      "/audience/new?door=handle&handle=jay.makes",
    );
    expect(screen.queryByRole("button", { name: "Simulate a video for their viewers" })).toBeNull();
    expect(screen.getByRole("button", { name: "Pull their best videos · 5 credits" })).toBeInTheDocument();
    // The phone's More in the card (the desk's stands in the header).
    expect(within(creatorCard()!).getByRole("button", { name: "More: @jay.makes" })).toBeInTheDocument();
    // Twelve videos, biggest jump first: three proven, the rest without a badge.
    expect(screen.getByText("Biggest jump")).toBeInTheDocument();
    expect(theirCards()).toHaveLength(12);
    expect(badges()).toEqual(["12×", "4.8×", "3.1×", null, null, null, null, null, null, null, null, null]);
    expect(theirCards()[0]!.querySelector('[data-part="views"]')!.textContent).toBe("106K views");
    // The drawn covers (one that does not load), the captions without hashtags, one with no caption.
    expect(document.querySelectorAll('[data-part="videos"] img[src^="data:image/svg+xml"]').length).toBeGreaterThanOrEqual(10);
    expect(document.body.textContent).not.toMatch(/#\p{L}/u);
    expect(theirCards().filter((c) => c.getAttribute("aria-label") === "Video by @jay.makes")).toHaveLength(1);
  });

  it("creator: Read again reads for 1.5 s here, then the line says read 25 Nov and the button is dimmed", async () => {
    await shown("creator");
    timed();
    fireEvent.click(readAgain());
    expect(readAgain()).toHaveAttribute("aria-busy", "true");
    expect(creatorLine()).toBe("@jay.makes · TikTok · Reading… · 12\u00a0videos");
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(readAgain()).not.toHaveAttribute("aria-busy");
    expect(creatorLine()).toBe("@jay.makes · TikTok · read\u00a025\u00a0Nov · 12\u00a0videos");
    expect(readAgain()).toHaveAttribute("aria-disabled", "true");
    expect(readAgain()).toHaveAccessibleDescription(READ_TODAY);
  });

  it("creator-audience: Simulate a video for their viewers, built 14 Nov; a press waits 1.5 s and stops", async () => {
    await shown("creator-audience");
    const simulate = screen.getByRole("button", { name: "Simulate a video for their viewers" });
    expect(simulate).toHaveAccessibleDescription("Their audience was built 14 Nov.");
    expect(screen.queryByRole("link", { name: "Build their audience" })).toBeNull();
    timed();
    fireEvent.click(simulate);
    expect(simulate).toHaveAttribute("aria-busy", "true");
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(simulate).not.toHaveAttribute("aria-busy");
  });

  it("creator-fresh: Read again dimmed, and why", async () => {
    await shown("creator-fresh");
    expect(creatorLine()).toBe("@jay.makes · TikTok · read\u00a025\u00a0Nov · 12\u00a0videos");
    expect(readAgain()).toHaveAttribute("aria-disabled", "true");
    expect(readAgain()).not.toHaveAttribute("aria-busy");
    expect(readAgain()).toHaveAccessibleDescription(READ_TODAY);
  });

  it("creator-reading: Read again busy, Reading… in the line, held there", async () => {
    await shown("creator-reading");
    timed();
    expect(readAgain()).toHaveAttribute("aria-busy", "true");
    expect(readAgain()).toHaveAttribute("aria-disabled", "true");
    expect(creatorLine()).toBe("@jay.makes · TikTok · Reading… · 12\u00a0videos");
    fireEvent.click(readAgain());
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(creatorLine()).toBe("@jay.makes · TikTok · Reading… · 12\u00a0videos");
  });

  it("creator-held: Couldn't be read and its sentence, no figures", async () => {
    await shown("creator-held");
    expect(cardName()).toBe("@jay.makes");
    expect(creatorLine()).toBe("Couldn't be read");
    expect(creatorCard()!.querySelector("[data-face] img")).toBeNull();
    expect(creatorCard()!.querySelector('[data-part="bio"]')).toBeNull();
    expect(screen.getByText("Maven couldn't read this account. Read again, or remove it.")).toBeInTheDocument();
    expect(document.querySelector("dl")).toBeNull();
    expect(screen.queryByRole("link", { name: "Build their audience" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Their videos" })).toBeNull();
    // Remove stays offered.
    expect(within(creatorCard()!).getByRole("button", { name: "More: @jay.makes" })).toBeInTheDocument();
  });

  it("creator-empty: No videos read yet", async () => {
    await shown("creator-empty");
    const section = screen.getByRole("region", { name: "Their videos" });
    expect(within(section).getByText("No videos read yet. Read again to get their latest.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Their videos" })).toBeNull();
    expect(creatorLine()).toBe("@jay.makes · TikTok · read\u00a013\u00a0Jul");
    // No read's median, so no Usual views.
    expect(terms()).toEqual(["Followers", "Likes", "Posts"]);
    expect(screen.getByRole("link", { name: "Build their audience" })).toBeInTheDocument();
  });

  it("creator-long: a 60-character name, a five-line bio with a 40-character word, a 24-character handle, captions empty to 200 characters", async () => {
    await shown("creator-long");
    const handle = "nia.cooks.weeknight.food";
    expect(handle).toHaveLength(24);
    expect(screen.getByRole("heading", { level: 1, name: `@${handle}` })).toBeInTheDocument();
    expect(cardName()).toHaveLength(60);
    const bio = creatorCard()!.querySelector('[data-part="bio"]')!.textContent!;
    expect(bio.split("\n")).toHaveLength(5);
    expect(bio.length).toBeGreaterThanOrEqual(280);
    expect(bio.length).toBeLessThanOrEqual(320);
    expect(bio.split(/\s+/).some((word) => word.length === 40)).toBe(true);
    // Another year's read carries its year: the longest line the card can hold.
    expect(creatorLine()).toBe(`@${handle} · TikTok · read\u00a030\u00a0Dec\u00a02025 · 8\u00a0videos`);
    expect(terms()).toEqual(["Followers", "Likes", "Posts", "Usual views"]);
    expect(screen.getByRole("button", { name: "Pull their best videos · 5 credits" })).toBeInTheDocument();
    const names = theirCards().map((c) => c.getAttribute("aria-label") ?? "");
    expect(names).toHaveLength(8);
    expect(names.filter((name) => name.length === 200)).toHaveLength(1);
    expect(names).toContain(`Video by @${handle}`);
    expect(Math.min(...names.map((name) => name.length))).toBeLessThanOrEqual(6);
    // Past 100 first.
    expect(badges()[0]).toBe("100×+");
    expect(document.body.textContent).not.toMatch(/#\p{L}/u);
  });

  it("creator-gone: the sentence and Watchlist", async () => {
    await shown("creator-gone");
    expect(screen.getByRole("heading", { level: 1, name: "Creator" })).toBeInTheDocument();
    expect(screen.getByText("This creator isn't on your watchlist.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watchlist" })).toHaveAttribute("href", "/feed?tab=watchlist");
    expect(creatorCard()).toBeNull();
  });

  it("creator-failed: the alert and Try again", async () => {
    await shown("creator-failed");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this creator.");
    expect(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(creatorCard()).toBeNull();
  });

  it("creator-loading: the outline, busy", async () => {
    await shown("creator-loading");
    expect(screen.getByRole("heading", { level: 1, name: "Creator" })).toBeInTheDocument();
    expect(screen.getByTestId("creator-next")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("list", { name: "Videos" })).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll('[data-part="outline"]').length).toBeGreaterThan(7);
    expect(creatorCard()).toBeNull();
  });

  it("creator-sheet: the first video's sheet, 12× their average, Remix this · 10 credits", async () => {
    await shown("creator-sheet");
    // Named by the first video's caption (the biggest jump), without its hashtags.
    const sheet = screen.getByRole("dialog");
    expect(sheet).toHaveAccessibleName("I tried to build a desk with no tools");
    expect(within(sheet).getByText("12× their average")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Remix this · 10 credits" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Watch on TikTok, opens in a new tab" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/videos\.example\//),
    );
    // Save marks here only.
    const save = within(sheet).getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(save);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "true");
  });
});
