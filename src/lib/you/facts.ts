/**
 * The five facts a creator writes about themselves on You (spec 2026-11-24 §4), the
 * `creator_profiles` columns that hold them, and their limits. One place: the migration's CHECKs
 * (held equal by `facts.test.ts`), the PATCH whitelist, the page's fields and the writers read these.
 *
 * `writing_voice_description` is a DESCRIPTION of how the creator sounds, never a pasted post: an
 * example line in the voice slot is copied (measured 2026-08-12, `profile-role-map.ts`).
 */
export const YOU_FACT_LIMITS = {
  about: 200,
  sells: 300,
  writing_voice_description: 200,
  can_film: 200,
  never_do: 300,
} as const;

export type YouFactKey = keyof typeof YOU_FACT_LIMITS;

export const YOU_FACT_KEYS: readonly YouFactKey[] = Object.keys(YOU_FACT_LIMITS) as YouFactKey[];
