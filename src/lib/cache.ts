// =====================================================
// Generic In-Memory TTL Cache (INFRA-02)
// =====================================================

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Create a simple in-memory TTL cache.
 *
 * No LRU eviction needed — dataset sizes are small:
 * ~50 trending sounds, ~200 scraped videos, ~30 rules.
 */
export function createCache<T>(ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | null {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.data;
    },
    set(key: string, data: T): void {
      store.set(key, { data, expiresAt: Date.now() + ttlMs });
    },
    invalidate(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    get size(): number {
      return store.size;
    },
  };
}
