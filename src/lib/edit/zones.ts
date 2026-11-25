/**
 * zones.ts — where TikTok and Instagram draw over a creator's own post (X86): their top bars, the
 * column of their right-side buttons, and their bottom bars of username, caption and sound, as an
 * organic post shows them at rest. One constant set, with the date and the sources, so there is one
 * place to change when the apps change their screens.
 *
 * Each zone is in shares of the 1080x1920 stage: its left, its top, its width and its height.
 *
 * How each was chosen (2026-11-21, task 3's round-0 rulings Z and Z2): one source per element, by
 * what it measures; the median where several measure the same thing; a number restated from
 * another source counts once; nothing only an ad shows (a call-to-action button, a "Sponsored"
 * label, an anchor link, a caption expanded).
 * - TikTok's top bar: its own In-Feed template, 240 px (the tabs and search an organic post shows too).
 * - TikTok's right-side buttons: the icons themselves, from the avatar to the sound disc, measured
 *   pixel by pixel on TikTok's own UI template ("In-Feed with Anchor", feed_1.png, 2021-04-12; its
 *   540x960 frame drawn over a 750x1334 screen): x 916 (the disc's left) to 1058 (the avatar's
 *   right), y 576 (the avatar's top) to 1737 (the disc's bottom) on the stage. The only
 *   source that shows the icons; the others give strips (180 px from 840 down; 200 px from 780 down;
 *   185 or 120 px the full height), which also cover the caption's area.
 * - TikTok's bottom bar, the collapsed state (username, up to two lines of caption, the sound row):
 *   the median of RightBlogger's overlay (528 px), Krumzi's organic figure (380) and Ignite (320):
 *   380 px. TikTok's own 660 px holds an ad's call-to-action.
 * - Instagram's top bar: Meta's 14 %.
 * - Instagram's right-side buttons: no source shows the icons. The median of the column's width as
 *   given (Meta's overlay as AdKit and Hopper HQ restate it, 227 px; Revid, 120; Keywords
 *   Everywhere, 130): 130 px; of where it starts (1152, from the bottom 40 %; Revid's lower half,
 *   960): 1056 px; down to the frame's bottom, as all give it.
 * - Instagram's bottom bar, the collapsed state: the median of Ignite (420 px) and Keywords
 *   Everywhere (420): 420 px. Meta's 35 % (672 px, restated by Revid and Hopper HQ) is an ad's
 *   figure, with its call-to-action, and is left out.
 * - Left out: the side margins (TikTok's 120 px, Meta's 6 %), kept free for screens of other shapes,
 *   not drawn over.
 *
 * Open (task 9): the five reference outliers' measured caption heights are the true check of these
 * bottom bars and columns; TikTok's icon template is from 2021, and no Instagram source was measured
 * from the icons.
 */

export interface Zone {
  app: "tiktok" | "instagram";
  /** What the app draws there, as `review` names it. */
  what: string;
  /** Shares of the stage: left, top, width, height. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const [W, H] = [1080, 1920];

const zones: Zone[] = [
  { app: "tiktok", what: "top bar", x: 0, y: 0, w: 1, h: 240 / H },
  { app: "tiktok", what: "right-side buttons", x: 916 / W, y: 576 / H, w: (1058 - 916) / W, h: (1737 - 576) / H },
  { app: "tiktok", what: "bottom caption and sound bar", x: 0, y: (H - 380) / H, w: 1, h: 380 / H },
  { app: "instagram", what: "top bar", x: 0, y: 0, w: 1, h: 0.14 },
  { app: "instagram", what: "right-side buttons", x: (W - 130) / W, y: 1056 / H, w: 130 / W, h: (H - 1056) / H },
  { app: "instagram", what: "bottom caption and audio bar", x: 0, y: (H - 420) / H, w: 1, h: 420 / H },
];

export const ZONES: readonly Zone[] = Object.freeze(zones.map((zone) => Object.freeze(zone)));

export const ZONES_SOURCE: { measured: string; from: string[] } = Object.freeze({
  measured: "2026-11-21",
  from: [
    // TikTok for Business, "TikTok Auction In-Feed Ads" (updated June 2026): its templates. The standard one (Feed.png, 2025-04-15) gives the top bar, 240 px.
    "https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads",
    "https://lf-tt4b.tiktokcdn.com/obj/i18nblog/tt4b_cms/en-US/5jqet0ab9qci-10e7f5Vig4uhAscNP8XPB0.zip",
    // Its "In-Feed with Anchor" template (2021-04-12): the UI itself, where the right-side icons were measured.
    "https://lf-tt4b.tiktokcdn.com/obj/i18nblog/tt4b_cms/en-US/5jqet0ab9qci-2ECwVwzIZXPqszI99UlWm3.zip",
    // RightBlogger, TikTok UI overlay (updated 2026-10-30): bottom 528 px (username, caption, sound name).
    "https://rightblogger.com/blog/tiktok-safe-zone-template",
    // Krumzi (updated November 2026, checked 2026-11-02): an organic TikTok post's bottom 380 px; a strip 200 px wide from 780 down.
    "https://www.krumzi.com/tools/safe-zone-checker/tiktok",
    // Ignite Social Media ("accurate as of July 2026"): TikTok bottom 320 px; Reels bottom 420 px.
    "https://www.ignitesocialmedia.com/content-creation/what-are-the-safe-zones-for-tiktoks-and-instagram-reels/",
    // Meta Ads Guide, Instagram Reels: "leave 14% at the top, 35% at the bottom and 6% on each side".
    "https://www.facebook.com/business/ads-guide/update/video/instagram-reels",
    // AdKit (updated 2026-10-21) and Hopper HQ (2026-09-18): Meta's right-side column, 227 px over the bottom 40 %.
    "https://adkit.so/tools/safe-zones/instagram",
    "https://www.hopperhq.com/blog/instagram-reel-size/",
    // Revid (2026-10-13): the Reels button column 120 px wide, over the lower half.
    "https://www.revid.ai/instagram-reels-safe-zone",
    // Keywords Everywhere: Reels bottom 420 px, right-side column 130 px.
    "https://keywordseverywhere.com/tools/instagram-reels-safe-zone-checker/",
  ],
});
