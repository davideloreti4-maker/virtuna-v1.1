import type { Niche } from "./eval-config";
import { NICHE_THRESHOLDS } from "./eval-config";

/** corpus_version identifier — D-12 semver-style. */
export type CorpusVersion = `${"pilot" | "full"}.${string}`;

export interface NicheThresholds {
  viralFloor: number; // ≥ → viral (D-10 hard cutoff)
  underCeiling: number; // ≤ → under
}

export type ThresholdsByNiche = Record<Niche, NicheThresholds>;

/**
 * Threshold snapshots — one entry per corpus_version.
 * Add new entries; NEVER edit existing ones (D-13 immutability).
 *
 * Plan F (pilot retrospective) appends the empirically-recalibrated
 * "full.YYYY-MM-DD" entry; Phase 1 ships only the pilot snapshot.
 */
const THRESHOLD_SNAPSHOTS: Record<string, ThresholdsByNiche> = {
  "pilot.2026-05-12": NICHE_THRESHOLDS,
  // "full.2026-05-XX": { ... } — Plan F writes this after pilot recalibration
};

export function getThresholds(
  version: CorpusVersion | string,
): ThresholdsByNiche {
  const snap = THRESHOLD_SNAPSHOTS[version];
  if (!snap) {
    throw new Error(
      `Unknown corpus_version: ${version}. Add a snapshot to THRESHOLD_SNAPSHOTS before evaluating.`,
    );
  }
  return snap;
}

/** Test/debug helper — lists all known versions. NOT for production code. */
export function listKnownVersions(): string[] {
  return Object.keys(THRESHOLD_SNAPSHOTS);
}
