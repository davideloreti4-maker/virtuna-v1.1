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
 * `sanitizeText` to strip ASCII control characters and Unicode zero-width
 * characters before persistence.
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
 * Strip ASCII control characters (except newline 0x0A and tab 0x09) and
 * Unicode zero-width characters (incl. the BOM) from a user-supplied string
 * before it is persisted to `creator_profiles`. Used by the API route on
 * every free-text field — pain_points, reference creator handles, win/flop
 * URLs — to mitigate T-02-01 (prompt injection via invisible characters in
 * CreatorContext prompts).
 *
 * WR-07: the second `.replace` strips U+200B (ZERO WIDTH SPACE), U+200C
 * (ZERO WIDTH NON-JOINER), U+200D (ZERO WIDTH JOINER), U+2060 (WORD JOINER),
 * and U+FEFF (BOM / ZERO WIDTH NO-BREAK SPACE) — all common prompt-
 * injection vectors that would otherwise hide tokens inside `pain_points`.
 * Escaped Unicode codepoints used to keep the source free of literal
 * invisible characters.
 *
 * WR-B (iter-3): the third `.replace` strips the literal delimiter
 * sentinels `<<<USER_CONTENT>>>` and `<<<END_USER_CONTENT>>>` that
 * `formatCreatorContext` (creator.ts) uses to wrap user-supplied text in
 * opaque blocks for the LLM. Without this strip a motivated user could
 * paste a closing delimiter, then a fake opening delimiter, then prompt
 * instructions — escaping the data fence and injecting outside it. The
 * zod enums and 500-char cap bound blast radius; this strip closes the
 * remaining defense-in-depth gap.
 *
 * Passes through `null` unchanged so callers can still clear a field.
 */
export function sanitizeText(input: string | null): string | null {
  if (input === null) return null;
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
      // WR-B: strip the literal delimiter sentinels so user input cannot
      // close the <<<USER_CONTENT>>> ... <<<END_USER_CONTENT>>> wrap that
      // formatCreatorContext (creator.ts) puts around free-text fields.
      // The `(?:END_)?` covers both open and close forms; `i` is
      // conservative against a copy-paste that introduces a case variation.
      .replace(/<<<(?:END_)?USER_CONTENT>>>/gi, "")
  );
}
