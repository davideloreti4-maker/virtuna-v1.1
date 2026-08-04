/**
 * `full-screen-hybrid` → `Full screen hybrid`. Sentence case, not title case: these are slugs
 * with connectives in them (`a-vs-b-comparison`), and Title Casing Every Word reads like a
 * headline for what is really a tag.
 *
 * Lifted out of `discover/teardown-detail.tsx` (where it was a local function) on 2026-08-04,
 * because the audience surfaces need the same thing and were not doing it: a freshly calibrated
 * creator was shown `financial_discipline`, `anti_consumerism`, `ego_death`, `judgment_free_zone`
 * — raw model output — on the reveal screen that is meant to be the payoff for a ~2 minute wait.
 * Model-authored slugs reach the UI from `interest_tags` in several places, so the formatting
 * belongs in one module rather than in whichever component last noticed.
 */
export function humanizeSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const words = slug.replace(/[-_]/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

/** Map + drop the empties, for the common "render a row of tags" case. */
export function humanizeSlugs(slugs: readonly string[] | null | undefined): string[] {
  if (!slugs) return [];
  return slugs.map((s) => humanizeSlug(s)).filter((s): s is string => Boolean(s));
}
