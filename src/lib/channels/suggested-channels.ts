/**
 * suggested-channels.ts — Discover Feed Phase 1.2 (UI-refinement: creator-strategy seed).
 *
 * A curated SEED of creators offered on the Channels page "Suggested" tab, grouped by
 * creator-strategy theme (mirrors the Sandcastles reference: "Social media growth",
 * "Viral content tactics", "AI tools for creators"). Clicking a card runs the normal
 * add flow (ingest + track), so a stale/renamed handle just degrades to an honest
 * "couldn't find" toast — the list is data, not a contract. Refine freely over time.
 *
 * Counts (followers/views) are hand-curated STATIC illustration — the watchlist shows
 * live counts once a channel is ingested; the suggested cards just need a believable
 * size signal. Handles are NORMALIZED (no '@', lowercased) so they match the ingest +
 * tracked_accounts key without re-normalizing at the call site. Platform is carried for
 * the badge; the add pipeline is TikTok-first today, so the seed stays TikTok-addable.
 */
export interface SuggestedChannel {
  /** Normalized handle (no '@', lowercased). */
  handle: string;
  displayName: string;
  category: SuggestedCategory;
  platform: string;
  /** Static, illustrative follower count (the watchlist shows the live one). */
  followers: number;
  /** Static, illustrative lifetime views. */
  views: number;
}

export const SUGGESTED_CATEGORIES = [
  "Social media growth strategies",
  "Viral content creation tactics",
  "AI tools for creators",
] as const;
export type SuggestedCategory = (typeof SUGGESTED_CATEGORIES)[number];

export const SUGGESTED_CHANNELS: SuggestedChannel[] = [
  // Social media growth strategies
  { handle: "garyvee", displayName: "Gary Vaynerchuk", category: "Social media growth strategies", platform: "tiktok", followers: 16_300_000, views: 980_000_000 },
  { handle: "vanessalau", displayName: "Vanessa Lau", category: "Social media growth strategies", platform: "tiktok", followers: 247_000, views: 53_000_000 },
  { handle: "modernmillie", displayName: "Modern Millie", category: "Social media growth strategies", platform: "tiktok", followers: 196_000, views: 30_000_000 },
  { handle: "natalie.barbu", displayName: "Natalie Barbu", category: "Social media growth strategies", platform: "tiktok", followers: 209_000, views: 59_000_000 },

  // Viral content creation tactics
  { handle: "mrbeast", displayName: "MrBeast", category: "Viral content creation tactics", platform: "tiktok", followers: 114_000_000, views: 3_200_000_000 },
  { handle: "jennyhoyos", displayName: "Jenny Hoyos", category: "Viral content creation tactics", platform: "tiktok", followers: 1_100_000, views: 393_000_000 },
  { handle: "alexhormozi", displayName: "Alex Hormozi", category: "Viral content creation tactics", platform: "tiktok", followers: 1_500_000, views: 507_000_000 },
  { handle: "brendanjkane", displayName: "Brendan Kane", category: "Viral content creation tactics", platform: "tiktok", followers: 88_000, views: 19_000_000 },

  // AI tools for creators
  { handle: "rileybrownai", displayName: "Riley Brown", category: "AI tools for creators", platform: "tiktok", followers: 452_000, views: 67_000_000 },
  { handle: "mreflow", displayName: "Matt Wolfe", category: "AI tools for creators", platform: "tiktok", followers: 94_000, views: 9_500_000 },
  { handle: "theaiadvantage", displayName: "The AI Advantage", category: "AI tools for creators", platform: "tiktok", followers: 75_000, views: 7_500_000 },
  { handle: "heyrobynai", displayName: "Robyn (AI)", category: "AI tools for creators", platform: "tiktok", followers: 53_000, views: 17_000_000 },
];

/** Group the seed by category, preserving SUGGESTED_CATEGORIES order. */
export function suggestedByCategory(): Record<SuggestedCategory, SuggestedChannel[]> {
  const out = {} as Record<SuggestedCategory, SuggestedChannel[]>;
  for (const cat of SUGGESTED_CATEGORIES) {
    out[cat] = SUGGESTED_CHANNELS.filter((c) => c.category === cat);
  }
  return out;
}
