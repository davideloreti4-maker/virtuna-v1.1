/**
 * adapt-profile.ts — build the flat `AdaptProfile` the grounding-as-remix briefer re-voices toward.
 *
 * The adapt stage (src/lib/grounding/adapt.ts) re-points proven structures at THIS creator — the half
 * the raw corpus slice starved. It wants a handful of flat strings, deliberately NOT the ProfileRow
 * schema (grounding must not know kc's shapes). This is the ONE bridge from ProfileRow → AdaptProfile,
 * shared by all three generate-by-remix runners (hooks · ideas · script) so they cannot drift on how a
 * creator is described to the briefer.
 */

import type { AdaptProfile } from "@/lib/grounding/adapt";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

/**
 * Flatten the structured target_audience JSON into the one-line string the adapt briefer wants
 * (it re-voices proven structures toward this reader). Mirrors profile-role-map's audience formatter;
 * null when nothing is set (the briefer simply omits the line). A value that is ALREADY a plain string
 * (a pre-formatted audience line) is used as-is — robust to that shape, inert for the typed object path
 * prod uses.
 */
function flattenTargetAudience(
  ta: ProfileRow["target_audience"] | string,
): string | null {
  if (!ta) return null;
  if (typeof ta === "string") return ta.trim() || null;
  const parts = [
    ta.age_range ? `age ${ta.age_range}` : null,
    ta.gender_skew ? `${ta.gender_skew}-skewed` : null,
    ta.geo,
    ta.language,
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Reduce past_wins/past_flops to the descriptive strings the briefer reasons over. Prod stores them
 * as `{ url }[]` (no scraped text in v1 — the briefer just gets the URLs); tolerate a bare `string[]`
 * too, and drop any empty/undefined entry so the prompt never renders "undefined". null when empty.
 */
function toOutcomeList(
  items: ProfileRow["past_wins"] | string[] | null | undefined,
): string[] | null {
  if (!items?.length) return null;
  const out = items
    .map((w) => (typeof w === "string" ? w : w?.url))
    .filter((s): s is string => Boolean(s && s.trim()));
  return out.length > 0 ? out : null;
}

/**
 * Map a creator's ProfileRow (or null cold-start) to the flat AdaptProfile the briefer re-voices toward.
 * Every field degrades to null/omitted, so a cold-start run hands the briefer an empty-but-valid profile
 * rather than crashing — the briefer then leans on the ask + the proven structures alone.
 */
export function buildAdaptProfile(profileRow: ProfileRow | null): AdaptProfile {
  return {
    niche_primary: profileRow?.niche_primary ?? null,
    target_audience: flattenTargetAudience(profileRow?.target_audience),
    primary_goal: profileRow?.primary_goal ?? null,
    writing_voice_sample: profileRow?.writing_voice_sample ?? null,
    past_wins: toOutcomeList(profileRow?.past_wins),
    past_flops: toOutcomeList(profileRow?.past_flops),
  };
}
