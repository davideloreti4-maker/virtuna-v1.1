import { z } from "zod";

/**
 * Creator Profile validation schema for the 9-card interview PATCH route.
 *
 * Every field is `.optional()` so a partial PATCH succeeds (the user can save
 * one card at a time from settings); `.nullable()` on most fields allows the
 * caller to explicitly clear a previously-saved answer by passing `null`.
 *
 * Mitigations baked in (threat-model T-02-01):
 * - Enum membership for every controlled field (platforms, age range, gender,
 *   goal, stage, style, cuts, cadence) — prevents arbitrary strings from
 *   reaching the CreatorContext prompt builder.
 * - Length caps on free-text (pain_points ≤ 500, reference handle ≤ 256,
 *   URL ≤ 512) — caps the prompt-injection blast radius.
 *
 * The route handler additionally runs each free-text field through
 * `sanitizeText` to strip ASCII control characters before persistence.
 */

const platformEnum = z.enum(["tiktok", "instagram", "youtube"]);
const ageRangeEnum = z.enum(["13-17", "18-24", "25-34", "35-44", "45+"]);
const genderSkewEnum = z.enum(["female", "balanced", "male"]);
const primaryGoalEnum = z.enum([
  "growth",
  "engagement",
  "brand_deals",
  "conversion",
]);
const creatorStageEnum = z.enum(["new", "growing", "established"]);
const contentStyleEnum = z.enum([
  "talking_head",
  "b_roll",
  "educational",
  "comedy",
  "tutorial",
  "vlog",
]);
const cutsPerSecondEnum = z.enum(["slow", "medium", "fast"]);
const postingFrequencyEnum = z.enum([
  "daily",
  "3-4_per_week",
  "1-2_per_week",
  "few_per_month",
  "rarely",
]);

const targetAudienceSchema = z
  .object({
    age_range: ageRangeEnum.nullable(),
    gender_skew: genderSkewEnum.nullable(),
    geo: z.string().max(80).nullable(),
    language: z.string().max(80).nullable(),
  })
  .nullable();

export const creatorProfilePatchSchema = z.object({
  target_platforms: z.array(platformEnum).max(3).optional(),
  niche_primary: z.string().max(64).nullable().optional(),
  niche_sub: z.string().max(64).nullable().optional(),
  target_audience: targetAudienceSchema.optional(),
  primary_goal: primaryGoalEnum.nullable().optional(),
  creator_stage: creatorStageEnum.nullable().optional(),
  content_style: contentStyleEnum.nullable().optional(),
  cuts_per_second: cutsPerSecondEnum.nullable().optional(),
  reference_creators: z
    .array(z.object({ handle_or_url: z.string().max(256) }))
    .max(3)
    .optional(),
  past_wins: z
    .array(z.object({ url: z.string().max(512) }))
    .max(2)
    .optional(),
  past_flops: z
    .array(z.object({ url: z.string().max(512) }))
    .max(2)
    .optional(),
  posting_frequency: postingFrequencyEnum.nullable().optional(),
  time_of_day_aware: z.boolean().nullable().optional(),
  pain_points: z.string().max(500).nullable().optional(),
});

export type CreatorProfilePatch = z.infer<typeof creatorProfilePatchSchema>;

/**
 * Strip ASCII control characters (except newline 0x0A and tab 0x09) from a
 * user-supplied string before it is persisted to `creator_profiles`. Used by
 * the API route on every free-text field — pain_points, reference creator
 * handles, win/flop URLs — to mitigate T-02-01 (prompt injection via control
 * characters in CreatorContext prompts).
 *
 * Passes through `null` unchanged so callers can still clear a field.
 */
export function sanitizeText(input: string | null): string | null {
  if (input === null) return null;
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}
