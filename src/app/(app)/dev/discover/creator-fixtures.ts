import { readOn } from "@/lib/audience-next/audience-words";
import { canReadAgainAt, creatorPageOf, type CreatorPage, type CreatorProfileRow, type CreatorVideoRow } from "@/lib/discover-next/creator";

import { DEV_VIDEOS } from "./fixtures";

/**
 * Made-up followed creators for /dev/discover's creator pages (`dev-creator.tsx`), as the server read
 * would hand them on: a profile row and the rows of one read, run through the real rule
 * (`creatorPageOf`), so a fixture cannot show what the page would not. The clock is fixed (`DEV_NOW`), so
 * the dates read the same on every visit.
 *
 * - @jay.makes: a two-line bio, four figures, twelve videos of the read of 13 Jul (three proven, one with
 *   only hashtags for a caption); also read this morning, whose read failed, and with no videos read.
 * - @nia.cooks.weeknight.food: the page at its worst. A 60-character name, a five-line bio of 300
 *   characters with one unbroken 40-character word, a handle of the full 24 characters, read last year,
 *   no picture, eight captions from none to 200 characters, one video past 100.
 *
 * Nothing here loads from the network: the picture and the covers are drawn as inline SVG.
 */

export const DEV_NOW = new Date("2026-11-25T12:00:00Z");

/** A made-up picture: a coloured disc with a face, drawn here (as the Watchlist's dev rows draw theirs). */
function picture(ground: string, skin: string, hair: string): string {
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">` +
        `<rect width="80" height="80" fill="${ground}"/>` +
        `<path d="M10 80c2-18 14-28 30-28s28 10 30 28z" fill="#3b3b44"/>` +
        `<ellipse cx="40" cy="36" rx="15" ry="18" fill="${skin}"/>` +
        `<path d="M24 36c-3-18 6-26 16-26s20 8 16 26c-2-8-6-14-16-15c-10 1-14 7-16 15z" fill="${hair}"/>` +
        `</svg>`,
    )
  );
}

// ─── @jay.makes ──────────────────────────────────────────────────────────────

const JAY_READ = "2026-07-13T09:00:00Z";
const JAY_MEDIAN = "8600";

const JAY: CreatorProfileRow = {
  id: "p-jay",
  tiktok_handle: "jay.makes",
  display_name: "Jay Makes",
  bio: "Furniture from hand tools, one board at a time.\nNew build every Sunday, mistakes included.",
  avatar_url: picture("#e3b448", "#c48e6a", "#2c211b"),
  follower_count: 15_400_000,
  heart_count: 369_100_000,
  video_count: 6_364,
  last_scraped_at: JAY_READ,
  scrape_status: "completed",
};

type VideoRow = [caption: string, multiple: number, views: number, posted: string];

/** Their last read, as the table hands it back (newest post first, not by jump): the page orders it.
 *  The captions start from the made-up library's lines for @jay.makes; a few carry hashtags, which the
 *  cards leave out. The views sit around the multiple × their median of 8,600. */
const JAY_VIDEOS: VideoRow[] = [
  ["Sharpening a chisel the slow way #handtools", 0.3, 2_610, "2026-07-12"],
  ["I tried to build a desk with no tools #woodworking #diy", 12, 106_100, "2026-07-09"],
  ["Three cuts, one drawer", 0.5, 4_310, "2026-07-05"],
  ["#asmr #woodworking", 1.2, 10_500, "2026-07-02"],
  ["POV: it's the first night in your new flat and nothing has legs yet #apartment", 3.1, 26_900, "2026-06-28"],
  ["Why my shelves never sag (it's one cheap bracket)", 0.9, 7_800, "2026-06-21"],
  ["I fixed my neighbour's fence and he never noticed #diy #fyp", 4.8, 41_300, "2026-06-14"],
  ["Answering your questions about the desk, part 2", 0.4, 3_390, "2026-06-07"],
  ["A chair from one board, no screws", 2.7, 23_000, "2026-05-31"],
  ["Stop sanding like this", 0.8, 6_950, "2026-05-24"],
  ["The joint nobody teaches you #woodworking", 1.7, 14_400, "2026-05-17"],
  ["Workshop tour, two years in #shoptour", 0.6, 5_240, "2026-05-10"],
];

/** One read's rows: one `ingested_at` on all of them, and the creator's median as the ingest stores it. */
function readRows(handle: string, rows: readonly VideoRow[], at: string, median: string): CreatorVideoRow[] {
  return rows.map(([caption, multiple, views, posted], i) => ({
    platform_video_id: `dev-${handle.split(".")[0]}-${String(i + 1).padStart(2, "0")}`,
    video_url: `https://videos.example/${handle}/${i + 1}`,
    description: caption,
    views,
    likes: Math.round(views * 0.071),
    comments: Math.round(views * 0.0042),
    posted_at: `${posted}T17:30:00Z`,
    outlier_multiplier: String(multiple),
    baseline_label: "vs own",
    // No stored cover: a dev fixture stores none (the cards take drawn ones, `drawn`).
    cover_url: null,
    ingested_at: at,
    baseline_views: median,
  }));
}

/** The page keeps only the covers Maven stores (`isStoredCover`), and a dev fixture stores none; so the
 *  cards take the made-up library's drawn covers in their place (its seventh does not load: the tile). */
const drawn = (page: CreatorPage, from = 0): CreatorPage => ({
  ...page,
  videos: page.videos.map((video, i) => ({ ...video, coverUrl: DEV_VIDEOS[(from + i) % DEV_VIDEOS.length]!.coverUrl })),
});

const JAY_SOURCE = { held: false, mergedFrom: null, trackedIds: ["t-jay"], competitorId: "p-jay" };

function jayPage(profile: Partial<CreatorProfileRow> = {}, videos = readRows("jay.makes", JAY_VIDEOS, JAY_READ, JAY_MEDIAN), held = false) {
  return drawn(
    creatorPageOf({ source: { ...JAY_SOURCE, held }, profile: { ...JAY, ...profile }, videos, audiences: [], now: DEV_NOW }),
  );
}

/** @jay.makes, last read 13 Jul: Build their audience, Pull, twelve videos. */
export const DEV_CREATOR: CreatorPage = jayPage();

/** With an audience of theirs. Set by hand: the dev page holds no audience rows. */
export const DEV_CREATOR_AUDIENCE: CreatorPage = { ...DEV_CREATOR, audience: { id: "dev-audience", builtOn: "14 Nov" } };

const FRESH_READ = "2026-11-25T08:00:00Z";
/** Read this morning: Read again is dimmed until tomorrow. */
export const DEV_CREATOR_FRESH: CreatorPage = jayPage(
  { last_scraped_at: FRESH_READ },
  readRows("jay.makes", JAY_VIDEOS, FRESH_READ, JAY_MEDIAN),
);

/** Their read failed and nothing was kept (the Watchlist's rule: failed, with no followers read). */
export const DEV_CREATOR_HELD: CreatorPage = jayPage(
  { scrape_status: "failed", follower_count: null, heart_count: null, video_count: null, last_scraped_at: null },
  [],
  true,
);

/** Read, but no video of theirs held: the sentence where the grid would be, and no median to show. */
export const DEV_CREATOR_EMPTY: CreatorPage = jayPage({}, []);

/** A page just read here (`dev-creator.tsx`'s Read again): the line says today, the button is dimmed. */
export function readJustNow(page: CreatorPage): CreatorPage {
  const at = DEV_NOW.toISOString();
  return { ...page, read: readOn(at, DEV_NOW), canReadAgain: canReadAgainAt(at, DEV_NOW) };
}

// ─── The page at its worst ───────────────────────────────────────────────────

const NIA_READ = "2025-12-30T22:00:00Z";
const NIA_MEDIAN = "21400";

const NIA: CreatorProfileRow = {
  id: "p-nia-long",
  tiktok_handle: "nia.cooks.weeknight.food",
  display_name: "Nia Cooks | Weeknight Dinners & Slow Sunday Bakes, Honestly!",
  bio: [
    "Weeknight dinners in thirty minutes, for two or for six.",
    "Slow Sunday cooking when the week allows it, honest notes when it fails.",
    "New recipe every Tuesday and Friday, written out in full on the site.",
    "Substitution questions go in the comments: I read them all.",
    "recipes.example/weeknight-dinners-in-30m",
  ].join("\n"),
  avatar_url: null,
  follower_count: 1_234_567,
  heart_count: 98_765_432,
  video_count: 12_345,
  last_scraped_at: NIA_READ,
  scrape_status: "completed",
};

const LONGEST =
  "The one-pan lemon chicken orzo I make every Tuesday when the fridge is nearly empty, nobody wants to wash up and everyone still asks for seconds: the whole method, the timings and what to swap in too.";

const NIA_VIDEOS: VideoRow[] = [
  [`${LONGEST} #dinner #onepan #weeknight`, 240, 5_136_000, "2025-12-02"],
  ["", 38.5, 823_900, "2025-12-28"],
  ["Rice.", 7.25, 155_150, "2025-11-19"],
  ["Three sauces from one jar of tahini, and the one I keep in the fridge all week #sauce", 3, 64_200, "2025-12-21"],
  ["Sunday focaccia, start to finish, with the dimpling everyone gets wrong the first time they try it at home", 2.9, 62_060, "2025-12-14"],
  ["Is this pasta water trick worth it? I tested it ten times", 1.1, 23_540, "2025-12-07"],
  ["Soup for a cold Tuesday", 0.7, 14_980, "2025-11-30"],
  ["What I cooked this week, honestly", 0.2, 4_280, "2025-11-26"],
];

/** @nia.cooks.weeknight.food, at its longest everywhere a stranger's text can stand. */
export const DEV_CREATOR_LONG: CreatorPage = drawn(
  creatorPageOf({
    source: { held: false, mergedFrom: null, trackedIds: ["t-nia-long"], competitorId: "p-nia-long" },
    profile: NIA,
    videos: readRows(NIA.tiktok_handle, NIA_VIDEOS, NIA_READ, NIA_MEDIAN),
    audiences: [],
    now: DEV_NOW,
  }),
  12,
);
