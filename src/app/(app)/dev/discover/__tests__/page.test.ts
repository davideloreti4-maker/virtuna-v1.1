/** @vitest-environment happy-dom */
/**
 * /dev/discover exists in the new look only. The flag is a build-time constant, so each case loads
 * the page fresh with the flag set the way that build would have it (as /dev/library's test does).
 * Each state is rendered for real and shows what it is named for.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";

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

  it("watchlist: the Watchlist chip, one card of rows (one that could not be read), the Follow row last", async () => {
    await shown("watchlist");
    expect(within(screen.getByRole("group", { name: "Discover" })).getByRole("button", { name: "Watchlist" })).toHaveAttribute(
      "aria-pressed",
      "true",
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
});
