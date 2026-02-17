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
  outcomes: {
    all: ["outcomes"] as const,
    history: () => ["outcomes", "history"] as const,
  },
  bookmarks: {
    all: ["bookmarks"] as const,
    list: () => ["bookmarks", "list"] as const,
  },
  profile: {
    all: ["profile"] as const,
    current: () => ["profile", "current"] as const,
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
} as const;
