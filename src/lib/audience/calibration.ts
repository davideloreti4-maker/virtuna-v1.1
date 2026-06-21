/**
 * Phase 7 Plan 03 — Calibration pipeline (AUD-02).
 *
 * Turns a handle (Personal) or description (Target) into a persisted, goal-biased Audience.
 *
 * Honesty spine (D-06 / Pitfall 3):
 *   - An explicit thin-data gate (getFollowerTier === null AND videos < THIN_MIN_VIDEOS)
 *     returns { fallback: 'general', reason: 'thin' } — NEVER fabricates personas.
 *   - A scrape error returns { error: 'scrape_failed' } — distinct from the thin fallback.
 *     UI-SPEC distinguishes "couldn't read enough" vs "calibration failed".
 *
 * Goal bias (Pitfall 2):
 *   - biasForGoalIntent(goalIntent) is applied ONCE at calibration time and stored on the row.
 *   - The resolver NEVER re-applies the bias per-request.
 *
 * Exports: THIN_MIN_VIDEOS, deriveAudienceProfile, calibrateFromScrape
 */

import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import type { ProfileData, VideoData } from "@/lib/scraping/types";
import { getFollowerTier } from "@/lib/engine/corpus/follower-tier";
import { biasForGoalIntent } from "./goal-intent";
import { repaintPersonas } from "./persona-repaint";
import { TEMPERATURE_DISPOSITION } from "./temperature-disposition";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import type {
  Audience,
  AudienceProfile,
  AudienceType,
  AudiencePlatform,
  GoalIntent,
  Temperature,
  Disposition,
} from "./audience-types";

// ─── Thin-data gate constant ──────────────────────────────────────────────────

/**
 * Minimum number of scraped videos required to proceed with calibration.
 * Chosen strict (10) to avoid building an audience profile from a handful of posts.
 * See Assumptions A4 in 07-RESEARCH.md.
 *
 * Both conditions must be true for the thin gate to fire:
 *   1. getFollowerTier(followerCount) === null (followerCount missing or 0)
 *   2. scrapeVideos returned < THIN_MIN_VIDEOS
 */
export const THIN_MIN_VIDEOS = 10;

// ─── Audience Profile derivation ──────────────────────────────────────────────

/**
 * Derive an AudienceProfile from scraped signals.
 * Purely deterministic given (profile, videos) — no external calls.
 *
 * temperature_mix: derived from the TEMPERATURE_DISPOSITION lens applied to the
 *   DEFAULT_PERSONA_WEIGHT_CONFIG (cold/warm/hot proportions). This is profile-agnostic
 *   in v1 — the DEFAULT_PERSONA_WEIGHT_CONFIG is used since calibrated weights are computed
 *   from the goalIntent bias. The profile provides the follower_tier signal.
 *
 * top_dispositions: derived from the 10 archetypes, ranked by DEFAULT weight then
 *   aggregated by disposition. Top 3 returned.
 *
 * follower_tier: getFollowerTier(followerCount) — null when count unavailable.
 */
export function deriveAudienceProfile(
  profile: ProfileData,
  _videos: VideoData[],
): AudienceProfile {
  const follower_tier = getFollowerTier(profile.followerCount) ?? null;

  // Temperature mix: aggregate temperature fractions from the DEFAULT 10-archetype distribution.
  // Each archetype has an equal 0.1 weight in the DEFAULT distribution (10 archetypes, sum=1.0).
  // This is the baseline profile — weight bias gets applied via biasForGoalIntent at calibration.
  const temperatureCounts: Record<Temperature, number> = { cold: 0, warm: 0, hot: 0 };
  for (const archetype of ARCHETYPES) {
    const { temperature } = TEMPERATURE_DISPOSITION[archetype as Archetype];
    temperatureCounts[temperature] += 1;
  }
  const total = ARCHETYPES.length;
  const temperature_mix: Record<Temperature, number> = {
    cold: temperatureCounts.cold / total,
    warm: temperatureCounts.warm / total,
    hot: temperatureCounts.hot / total,
  };

  // Top dispositions: count archetype occurrences per disposition, return top 3
  const dispositionCounts: Partial<Record<Disposition, number>> = {};
  for (const archetype of ARCHETYPES) {
    const { disposition } = TEMPERATURE_DISPOSITION[archetype as Archetype];
    dispositionCounts[disposition] = (dispositionCounts[disposition] ?? 0) + 1;
  }

  const top_dispositions = (
    Object.entries(dispositionCounts) as [Disposition, number][]
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => d);

  return {
    temperature_mix,
    top_dispositions,
    follower_tier,
  };
}

// ─── Calibration input types ──────────────────────────────────────────────────

export interface CalibrationInput {
  /** @handle for Personal audiences (required for scrape). */
  handle?: string;
  /** Audience type — 'personal' triggers scrape, 'target' is description-only. */
  type: AudienceType;
  /** Platform (tiktok/instagram/youtube/custom). */
  platform: AudiencePlatform;
  /** Creator's goal intent (deterministic weight bias). */
  goalIntent: GoalIntent;
  /** Display name for the audience. */
  name: string;
  /** Optional description for Target audiences. */
  description?: string;
}

// ─── Return types ──────────────────────────────────────────────────────────────

/** Thin fallback — scrape succeeded but data too sparse to calibrate honestly. */
export interface CalibrationFallback {
  fallback: "general";
  reason: "thin";
}

/** Scrape error — network failure or Apify actor crash. Distinct from thin fallback. */
export interface CalibrationError {
  error: "scrape_failed";
  message?: string;
}

/** Successful calibration — Audience-shaped object (no id — repo assigns). */
export interface CalibrationSuccess {
  audience: Omit<Audience, "id" | "created_at" | "updated_at">;
}

export type CalibrationResult =
  | CalibrationSuccess
  | CalibrationFallback
  | CalibrationError;

// ─── Main calibration function ─────────────────────────────────────────────────

/**
 * Calibrate an audience from a handle (Personal) or description (Target).
 *
 * Personal path:
 *   1. Scrape profile + videos via ApifyScrapingProvider.
 *   2. Apply thin gate (D-06): getFollowerTier === null AND videos < THIN_MIN_VIDEOS → fallback.
 *   3. Derive AudienceProfile (temp mix, dispositions, follower tier).
 *   4. Bake goal-intent bias into persona_weights (ONCE — Pitfall 2).
 *   5. Repaint 10 personas (deterministic).
 *   6. Return CalibrationSuccess { audience } — caller persists via createAudience.
 *
 * Target path (no scrape):
 *   1. Derive a profile from the description (no Apify call).
 *   2. Apply goal bias + repaint.
 *   3. Return CalibrationSuccess.
 *
 * Never throws — all errors are typed returns.
 *
 * @param input CalibrationInput
 * @param _provider Optional ScrapingProvider (injection point for tests)
 */
export async function calibrateFromScrape(
  input: CalibrationInput,
  _provider?: {
    scrapeProfile(handle: string): Promise<ProfileData>;
    scrapeVideos(handle: string, limit?: number): Promise<VideoData[]>;
  },
): Promise<CalibrationResult> {
  const { handle, type, platform, goalIntent, name, description } = input;

  let profile: ProfileData | null = null;
  let videos: VideoData[] = [];

  // ── Personal path: scrape ──────────────────────────────────────────────────
  if (type === "personal") {
    if (!handle) {
      return { error: "scrape_failed", message: "handle required for personal audience" };
    }

    const provider = _provider ?? new ApifyScrapingProvider();

    try {
      // Parallel scrape (profile + videos) — Apify runs are independent
      [profile, videos] = await Promise.all([
        provider.scrapeProfile(handle),
        provider.scrapeVideos(handle, 30),
      ]);
    } catch (err) {
      // Scrape failure is distinct from thin-data (D-06 / UI-SPEC)
      return {
        error: "scrape_failed",
        message: err instanceof Error ? err.message : "scrape failed",
      };
    }

    // ── Thin-data gate (D-06 / Pitfall 3) ─────────────────────────────────
    // Both conditions required:
    //   1. Follower count missing/zero → getFollowerTier returns null
    //   2. Video count below threshold
    const tier = getFollowerTier(profile.followerCount);
    if (tier === null && videos.length < THIN_MIN_VIDEOS) {
      // Honest fallback — NEVER return fabricated personas
      return { fallback: "general", reason: "thin" };
    }
  }

  // ── Profile derivation (Personal uses scraped; Target uses a mock profile) ─
  const scrapeProfile: ProfileData =
    profile ??
    ({
      handle: handle ?? name,
      displayName: name,
      bio: description ?? "",
      avatarUrl: "",
      verified: false,
      followerCount: 0,
      followingCount: 0,
      heartCount: 0,
      videoCount: 0,
    } as ProfileData);

  const audienceProfile = deriveAudienceProfile(scrapeProfile, videos);

  // ── Goal-intent bias (baked ONCE here — Pitfall 2) ─────────────────────────
  const persona_weights = biasForGoalIntent(goalIntent);

  // ── Persona repaint (deterministic — stored on row, not generated per-request) ─
  const personas = repaintPersonas({ audienceProfile, goalIntent, weights: persona_weights });

  // ── Return Audience-shaped object (no id — caller passes to createAudience) ─
  const audience: Omit<Audience, "id" | "created_at" | "updated_at"> = {
    user_id: "", // injected by the route from the session (CR-01)
    name,
    type,
    platform,
    goal_label: description ?? null,
    goal_intent: goalIntent,
    is_general: false,
    is_preset: false,
    persona_weights,
    personas,
    profile: audienceProfile,
    calibration: {
      source: type === "personal" ? "scrape" : "description",
      handle: type === "personal" ? handle : undefined,
      scraped_at: type === "personal" ? new Date().toISOString() : undefined,
      thin: false,
    },
  };

  return { audience };
}
