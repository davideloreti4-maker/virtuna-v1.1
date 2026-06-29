/**
 * Query key factory (QUERY-02)
 *
 * Namespaced keys for cache management and invalidation.
 */
export const queryKeys = {
  trending: {
    all: ["trending"] as const,
    videos: (category: string) => ["trending", "videos", category] as const,
    stats: () => ["trending", "stats"] as const,
    detail: (videoId: string) => ["trending", "detail", videoId] as const,
  },
  deals: {
    all: ["deals"] as const,
    list: (filters?: { status?: string; tier?: string }) =>
      ["deals", "list", filters] as const,
    detail: (id: string) => ["deals", "detail", id] as const,
    enrollments: () => ["deals", "enrollments"] as const,
  },
  analysis: {
    all: ["analysis"] as const,
    history: () => ["analysis", "history"] as const,
    detail: (id: string) => ["analysis", "detail", id] as const,
  },
  bookmarks: {
    all: ["bookmarks"] as const,
    list: () => ["bookmarks", "list"] as const,
  },
  threads: {
    all: ["threads"] as const,
    list: () => ["threads", "list"] as const,
  },
  saved: {
    all: ["saved"] as const,
    // Flat filter, NOT a folder: `type` is an optional client-side item_type filter.
    list: (type?: string) => ["saved", "list", type ?? "all"] as const,
  },
  recalibration: {
    all: ["recalibration"] as const,
    // Pending recalibration proposal for one audience (null below the gate).
    proposals: (audienceId: string) =>
      ["recalibration", "proposals", audienceId] as const,
  },
  profile: {
    all: ["profile"] as const,
    current: () => ["profile", "current"] as const,
    creatorProfile: () => ["profile", "creator-profile"] as const,
  },
  affiliateLinks: {
    all: ["affiliateLinks"] as const,
    list: () => ["affiliateLinks", "list"] as const,
  },
  earnings: {
    all: ["earnings"] as const,
    summary: () => ["earnings", "summary"] as const,
  },
  team: {
    all: ["team"] as const,
    current: () => ["team", "current"] as const,
  },
  cj: {
    all: ["cj"] as const,
    products: (query: string, category?: string) =>
      ["cj", "products", query, category] as const,
  },
  channels: {
    all: ["channels"] as const,
    // The enriched Channels watchlist (tracked_accounts ⨝ competitor_profiles + agg views).
    watchlist: () => ["channels", "watchlist"] as const,
    // Shared-corpus channel search by handle/display_name.
    search: (q: string) => ["channels", "search", q] as const,
  },
  feed: {
    all: ["feed"] as const,
    // The keyset-paginated Videos feed — keyed by tab + sort + the full filter set
    // so any filter/sort/tab change starts a fresh infinite query (no stale pages).
    list: (args: { tab: string; sort: string; filters: object }) =>
      ["feed", "list", args] as const,
  },
} as const;
