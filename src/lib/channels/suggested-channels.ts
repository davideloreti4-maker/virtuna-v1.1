/**
 * suggested-channels.ts — Discover Feed Phase 1.2.
 *
 * A small, curated SEED of TikTok creators offered on the Channels page "Suggested"
 * tab, grouped by category. Clicking one runs the normal add flow (ingest + track),
 * so a stale/renamed handle just degrades to an honest "couldn't find" toast — the
 * list is data, not a contract. Refine freely over time.
 *
 * Handles are stored NORMALIZED (no '@', lowercased) so they match the ingest +
 * tracked_accounts key without re-normalizing at the call site.
 */
export interface SuggestedChannel {
  /** Normalized handle (no '@', lowercased). */
  handle: string;
  displayName: string;
  category: SuggestedCategory;
}

export const SUGGESTED_CATEGORIES = [
  "Comedy",
  "Beauty",
  "Food",
  "Creators",
] as const;
export type SuggestedCategory = (typeof SUGGESTED_CATEGORIES)[number];

export const SUGGESTED_CHANNELS: SuggestedChannel[] = [
  // Comedy
  { handle: "khaby.lame", displayName: "Khaby Lame", category: "Comedy" },
  { handle: "zachking", displayName: "Zach King", category: "Comedy" },
  { handle: "brittany_broski", displayName: "Brittany Broski", category: "Comedy" },
  // Beauty
  { handle: "jamescharles", displayName: "James Charles", category: "Beauty" },
  { handle: "mikaylanogueira", displayName: "Mikayla Nogueira", category: "Beauty" },
  { handle: "bretmanrock", displayName: "Bretman Rock", category: "Beauty" },
  // Food
  { handle: "gordonramsayofficial", displayName: "Gordon Ramsay", category: "Food" },
  { handle: "cznburak", displayName: "CZN Burak", category: "Food" },
  { handle: "cookingwithlynja", displayName: "Lynja", category: "Food" },
  // Creators (general)
  { handle: "mrbeast", displayName: "MrBeast", category: "Creators" },
  { handle: "charlidamelio", displayName: "Charli D'Amelio", category: "Creators" },
  { handle: "bellapoarch", displayName: "Bella Poarch", category: "Creators" },
];

/** Group the seed by category, preserving SUGGESTED_CATEGORIES order. */
export function suggestedByCategory(): Record<SuggestedCategory, SuggestedChannel[]> {
  const out = {} as Record<SuggestedCategory, SuggestedChannel[]>;
  for (const cat of SUGGESTED_CATEGORIES) {
    out[cat] = SUGGESTED_CHANNELS.filter((c) => c.category === cat);
  }
  return out;
}
