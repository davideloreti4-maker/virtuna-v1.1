import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import { createLogger } from "@/lib/logger";
import { getThresholds, listKnownVersions, type ThresholdsByNiche } from "./thresholds";

const log = createLogger({ module: "corpus/corpus-version" });

export interface CorpusVersionSnapshot {
  version: string;                                  // e.g., "pilot.2026-05-12"
  niche_thresholds: ThresholdsByNiche;
  sealed_at: string;                                 // ISO timestamp (set when first row inserted)
  row_count: number;                                 // current DB count for this version
}

// D-13 fixed-snapshot -> cache forever. Manual invalidation only.
const cache = createCache<CorpusVersionSnapshot>(Number.MAX_SAFE_INTEGER);

/**
 * Read a corpus version's snapshot: threshold values (immutable per D-13)
 * plus a live row count from the DB. Returns null when the version is not
 * registered in thresholds.ts (matches the ml.ts:475 "not yet trained" idiom).
 */
export async function loadCorpusVersion(
  version: string,
): Promise<CorpusVersionSnapshot | null> {
  const cached = cache.get(version);
  if (cached) {
    // Refresh row_count only (thresholds are immutable, cached forever)
    const fresh = await fetchRowCount(version);
    return { ...cached, row_count: fresh };
  }

  let thresholds: ThresholdsByNiche;
  try {
    thresholds = getThresholds(version);
  } catch {
    log.warn("Unknown corpus_version", { version, known: listKnownVersions() });
    return null;
  }

  const row_count = await fetchRowCount(version);
  const snapshot: CorpusVersionSnapshot = {
    version,
    niche_thresholds: thresholds,
    sealed_at: new Date().toISOString(),
    row_count,
  };
  cache.set(version, snapshot);
  return snapshot;
}

/** Manual cache invalidation — only used by tests. */
export function invalidateCorpusVersionCache(): void {
  cache.clear();
}

async function fetchRowCount(version: string): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("training_corpus")
    .select("id", { count: "exact", head: true })
    .eq("corpus_version", version);
  if (error) {
    log.warn("Row count fetch failed; returning 0", { error: error.message });
    return 0;
  }
  return count ?? 0;
}

/**
 * Convenience: list all known corpus versions (from thresholds.ts).
 * The DB may have additional `corpus_version` values written prior to thresholds.ts
 * registration — those are considered orphan rows; surfacing them is Plan F's job.
 */
export { listKnownVersions };
