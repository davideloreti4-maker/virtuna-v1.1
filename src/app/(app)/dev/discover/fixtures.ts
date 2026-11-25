import type { CardVideo } from "@/lib/discover-next/hub-data";

/**
 * Made-up library videos for /dev/discover: thirty proven videos by made-up creators across five
 * niches (both comedy values among them), three platforms, two past 100, five whose line is empty, a
 * placeholder or holds a fill-in slot (their cards show no line), and one cover that does not load.
 * The covers are drawn here as inline SVG (a person against a coloured wall), so the page loads
 * nothing from the network.
 */

/** A wall and a figure, 2 by 3, in the given colours. */
function cover(wall: string, shade: string, shirt: string): string {
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="${shade}"/></linearGradient></defs>` +
        `<rect width="120" height="180" fill="url(#g)"/>` +
        `<rect x="10" y="24" width="30" height="40" rx="4" fill="#ffffff" opacity=".16"/>` +
        `<path d="M12 180c3-44 24-66 48-66s45 22 48 66z" fill="${shirt}"/>` +
        `<rect x="51" y="98" width="18" height="24" rx="7" fill="#b98262"/>` +
        `<ellipse cx="60" cy="78" rx="21" ry="26" fill="#c48e6a"/>` +
        `<path d="M36 84c-7-30 10-50 24-50s32 18 24 50c-2-12-8-25-24-27c-16 2-22 15-24 27z" fill="#2c211b"/>` +
        `</svg>`,
    )
  );
}

const WALLS: ReadonlyArray<[string, string, string]> = [
  ["#d9c6aa", "#8d7258", "#5b7fa6"],
  ["#9fc3d9", "#3f6f8f", "#e3b448"],
  ["#e8b7a8", "#a1584a", "#2f4b3a"],
  ["#c9d8b6", "#5e7a4a", "#8a3b56"],
  ["#d6cce8", "#6a5a8f", "#d9772b"],
  ["#2f2f35", "#121214", "#c0503f"],
];

/** A cover address that does not load (the card shows the neutral tile). */
export const BROKEN_COVER = "data:image/png;base64,bm90LWFuLWltYWdl";

type Row = [handle: string, line: string | null, niche: string, platform: string, views: number, multiplier: number, posted: string, formats?: string[]];

const ROWS: Row[] = [
  ["jay.makes", "I tried to build a desk with no tools", "comedy", "tiktok", 39_800_000, 27, "2025-03-14", ["Challenge"]],
  ["nia.cooks", "Meal prep for a whole week in one hour", "food", "instagram", 36_300_000, 27, "2024-11-02", ["Day In The Life"]],
  ["dev.lifts", "The one stretch I wish I had learned at twenty", "health-fitness", "tiktok", 25_000_000, 16, "2025-08-21"],
  ["ari.codes", "I asked my laptop to write my wedding speech", "tech", "youtube", 23_900_000, 75, "2026-01-09"],
  ["mo.laughs", "When your mum finds the receipt", "comedy-entertainment", "instagram", 20_800_000, 34, "2025-06-30", ["Skit/Humor"]],
  ["sam.bakes", "This bread took me three days and it was worth it", "food", "tiktok", 19_900_000, 51, "2025-02-11"],
  ["lee.travels", "The cheapest way to cross Europe by train", "comedy", "youtube", 19_300_000, 48, "2024-09-18"],
  ["jay.makes", "POV: it's the first night in your new flat", "comedy", "tiktok", 18_400_000, 6.1, "2026-02-27", ["Day In The Life"]],
  ["dev.lifts", "Can we have a word about leg day?", "health-fitness", "instagram", 18_200_000, 18, "2025-10-05"],
  ["mo.laughs", "If we ordered the taxi it should be here in ten minutes", "comedy-entertainment", "tiktok", 34_200_000, 16, "2025-12-12", ["Skit/Humor"]],
  ["nia.cooks", "Three dinners from one chicken", "food", "youtube", 12_100_000, 9.4, "2024-07-01"],
  ["ari.codes", "Ranking every phone I have owned", "tech", "tiktok", 11_700_000, 12, "2025-04-19", ["Ranking/Rating/Tier List"]],
  ["sam.bakes", null, "food", "instagram", 10_400_000, 8.2, "2025-09-09"],
  ["lee.travels", "[City] is the most underrated place in Europe", "comedy", "instagram", 9_800_000, 7.5, "2025-01-23"],
  ["dev.lifts", "A week of push-ups before work", "health-fitness", "tiktok", 9_200_000, 100, "2026-03-03"],
  ["jay.makes", "(No spoken audio; music only)", "comedy", "tiktok", 8_700_000, 5.2, "2024-12-08"],
  ["nia.cooks", "The pasta trick restaurants do not tell you", "food", "tiktok", 8_100_000, 13, "2025-11-16"],
  ["ari.codes", "My setup costs less than your headphones", "tech", "instagram", 7_600_000, 4.4, "2025-05-27"],
  ["mo.laughs", "N/A", "comedy-entertainment", "youtube", 7_200_000, 6.6, "2024-10-30"],
  ["sam.bakes", "Croissants at home, the honest version", "food", "tiktok", 6_900_000, 22, "2025-07-14", ["A vs B Comparison"]],
  ["lee.travels", "Packing for two weeks in one bag", "comedy", "tiktok", 6_300_000, 3.6, "2026-04-02"],
  ["dev.lifts", "", "health-fitness", "youtube", 5_800_000, 10, "2025-03-30"],
  ["jay.makes", "I fixed my neighbour's fence and he never noticed", "comedy", "instagram", 5_400_000, 100, "2025-08-08"],
  ["nia.cooks", "Breakfast for under a pound", "food", "instagram", 4_900_000, 3.2, "2024-08-15"],
  ["ari.codes", "This keyboard sounds like rain", "tech", "tiktok", 4_500_000, 14, "2026-05-19"],
  ["mo.laughs", "Telling my dad I quit my job, in three acts", "comedy-entertainment", "tiktok", 4_100_000, 8.8, "2025-12-29", ["Skit/Humor"]],
  ["sam.bakes", "The cake that broke the internet in my house", "food", "youtube", 3_700_000, 5.9, "2025-06-06"],
  ["lee.travels", "Night train to the mountains", "comedy", "instagram", 3_300_000, 4.1, "2025-02-02"],
  ["dev.lifts", "Five minutes, no equipment, every morning", "health-fitness", "tiktok", 2_900_000, 11, "2024-11-21"],
  ["ari.codes", "Why my code works and I do not know why", "tech", "instagram", 2_400_000, 3.9, "2026-06-01"],
];

/** The library as the page hands it to the hub; the hub puts it in order. */
export const DEV_VIDEOS: CardVideo[] = ROWS.map(([handle, line, niche, platform, views, multiplier, posted, formats], i) => {
  const [wall, shade, shirt] = WALLS[i % WALLS.length]!;
  return {
    id: `dev-v${String(i + 1).padStart(2, "0")}`,
    // The seventh card's cover does not load: the neutral tile.
    coverUrl: i === 6 ? BROKEN_COVER : cover(wall, shade, shirt),
    handle,
    spokenHook: line,
    niche,
    platform,
    views,
    postedAt: `${posted}T12:00:00Z`,
    multiplier,
    baselineLabel: i % 4 === 3 ? "vs followers" : "vs their average",
    proven: true,
    extreme: multiplier >= 100,
    formats: formats ?? [],
  };
});
