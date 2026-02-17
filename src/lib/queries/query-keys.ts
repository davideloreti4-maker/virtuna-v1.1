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
  },
  outcomes: {
    all: ["outcomes"] as const,
    history: () => ["outcomes", "history"] as const,
  },
} as const;
