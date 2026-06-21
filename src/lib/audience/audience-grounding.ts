/**
 * audience-grounding.ts — GROUND-03 audience-facing grounding line (07-04 Task 1, AUD-05).
 *
 * Provides: buildAudienceGroundingLine(audience, platform, profileRow)
 *   → { line: string; coldStart: boolean }
 *
 * STEER proof (AUD-05 / D-01): for a calibrated audience, returns an audience-facing
 * "Because: your {platform} audience — {temperature mix / top dispositions}" line.
 * For General / null audience, DELEGATES to buildGroundingLine(profileRow, platform)
 * — zero behavior change for General (regression gate preserved).
 *
 * HONESTY SPINE:
 *  - No fabricated follower counts or numeric engagement figures in the line.
 *  - Cold-start path delegates honestly to buildGroundingLine.
 *  - Temperature mix / dispositions come from stored AudienceProfile — never invented.
 *
 * Pure function. No I/O. Deterministic.
 */

import { buildGroundingLine } from "@/lib/kc/grounding-line";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { Audience } from "./audience-types";

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the audience-facing grounding line for an idea card (GROUND-03 / AUD-05 steer proof).
 *
 * @param audience    Active Audience, or null → delegates to buildGroundingLine.
 * @param platform    The request platform ("tiktok" | "instagram" | "youtube").
 * @param profileRow  Creator profile row (used only when delegating to buildGroundingLine).
 * @returns           { line: string; coldStart: boolean }
 *
 * Examples:
 *   General / null: { line: "Based on TikTok baselines — add your profile for tailored ideas", coldStart: true }
 *   Calibrated:     { line: "Because: your tiktok audience — warm-leaning · connector · collector", coldStart: false }
 */
export function buildAudienceGroundingLine(
  audience: Audience | null,
  platform: string,
  profileRow: ProfileRow | null,
): { line: string; coldStart: boolean } {
  // General / null → delegate to profile-based grounding (zero behavior change)
  if (!audience || audience.is_general) {
    return buildGroundingLine(profileRow, platform);
  }

  // Calibrated audience → compose audience-facing line from stored AudienceProfile.
  // Honesty spine: only use what is stored — no fabricated counts.
  return buildAudienceLine(audience, platform);
}

// ─── Audience-line composer ────────────────────────────────────────────────────

/**
 * Compose the "Because: your {platform} audience — {mix/dispositions}" line.
 * Called only for calibrated audiences (is_general=false).
 *
 * Structure: "Because: your {platform} audience — {temperature label} · {dispositions}"
 * Falls back gracefully when AudienceProfile fields are absent.
 */
function buildAudienceLine(
  audience: Audience,
  platform: string,
): { line: string; coldStart: boolean } {
  const parts: string[] = [];

  const profile = audience.profile;

  if (profile) {
    // Temperature mix: describe the dominant temperature bucket
    const tempLabel = dominantTemperatureLabel(profile.temperature_mix);
    if (tempLabel) parts.push(tempLabel);

    // Top dispositions: up to 3 (already stored as top_dispositions)
    if (profile.top_dispositions && profile.top_dispositions.length > 0) {
      parts.push(profile.top_dispositions.slice(0, 3).join(" · "));
    }
  } else if (audience.personas && audience.personas.length > 0) {
    // Fallback: derive a minimal label from goal_label or audience name
    if (audience.goal_label) {
      parts.push(audience.goal_label);
    }
  }

  // If we have nothing meaningful, fall back to the audience name as a qualifier
  const detail = parts.length > 0
    ? parts.join(" · ")
    : audience.name;

  const platformLabel = platform.toLowerCase();
  const line = `Because: your ${platformLabel} audience — ${detail}`;

  return { line, coldStart: false };
}

// ─── Temperature label helper ──────────────────────────────────────────────────

/**
 * Derive a human-readable temperature label from the stored temperature_mix.
 * Returns the dominant temperature bucket as a qualifier (e.g. "warm-leaning").
 * Honesty spine: describes what is stored, never fabricates engagement numbers.
 */
function dominantTemperatureLabel(
  mix: Record<"cold" | "warm" | "hot", number>,
): string | null {
  const entries = Object.entries(mix) as ["cold" | "warm" | "hot", number][];
  if (entries.length === 0) return null;

  // Find dominant bucket
  const dominant = entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best));
  const [bucket, share] = dominant;

  // Only emit a label if the bucket is meaningfully dominant (≥ 40%)
  if (share < 0.4) return null;

  const TEMP_LABELS: Record<"cold" | "warm" | "hot", string> = {
    cold: "cold-leaning",
    warm: "warm-leaning",
    hot: "hot-leaning",
  };

  return TEMP_LABELS[bucket] ?? null;
}
