/**
 * niche-resolver.ts — Phase 14 (14-01 Task 1).
 *
 * resolveNicheKey(nichePrimary): free-text / sub-slug `niche_primary` → a top-level
 * NICHE_INSTANTIATION key (the 10 instantiation slugs) or null.
 *
 * WHY THIS EXISTS (the moat-spine fix):
 *   `creator_profiles.niche_primary` is free text (`z.string().max(64)`). In production it
 *   frequently holds a sub-slug like `personal-finance` or prose, which fails the EXACT
 *   top-level slug match in `selectPersonaSlots` (persona-registry.ts:436) and silently
 *   falls back to "general TikTok" + generic instantiation. The text SIM then can't say no
 *   (flat 6/6/6/6/5, "all Mixed"). This resolver normalizes the free-text field to a real
 *   instantiation key BEFORE it reaches the panel, restoring niche discrimination.
 *
 * LAYER (D-02 / Pitfall 2): this lives at the RUNNER layer. It is NEVER called inside the
 *   shared `selectPersonaSlots` engine function (which the SIM-1 Max video path imports at
 *   pipeline.ts:771) — calling it there would perturb the Max-path bytes and force an
 *   ENGINE_VERSION bump. Runners call it; the engine function stays byte-identical.
 *
 * PURITY (D-17 cache warmth): deterministic, no Date.now / no Math.random. Same input →
 *   same output, so the resolved niche keeps the downstream system-prompt prefix cacheable.
 *
 * HONESTY: when nothing resolves, returns null — the caller then gets the honest generic
 *   fallback. We NEVER fabricate a niche to dodge the generic path.
 *
 * ISOLATION: imports only from taxonomy.ts (data) + persona-registry.ts (read-only key view).
 */

import { NICHE_TREE } from "@/lib/niches/taxonomy";
import {
  NICHE_INSTANTIATION_KEYS,
  isNicheInstantiationKey,
} from "./persona-registry";

/** Normalize a free-text niche value: trim + lowercase. */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Resolve a free-text / sub-slug `niche_primary` to a top-level NICHE_INSTANTIATION key.
 *
 * Resolution order:
 *   1. null / empty → null.
 *   2. Normalized direct top-level instantiation-key hit → return it.
 *   3. Sub-slug → walk NICHE_TREE, find the parent whose `subs[]` contains the slug;
 *      return parent.slug if it is an instantiation key.
 *   4. Keyword/contains fallback against top-level labels/slugs (and their sub labels/slugs) →
 *      the nearest top-level instantiation key.
 *   5. No match → null (honest generic fallback — never fabricate a niche).
 *
 * @param nichePrimary The raw `creator_profiles.niche_primary` value (free text, sub-slug, or null).
 * @returns A top-level NICHE_INSTANTIATION key, or null when nothing resolves.
 */
export function resolveNicheKey(nichePrimary: string | null): string | null {
  // (1) null / empty
  if (nichePrimary === null) return null;
  const norm = normalize(nichePrimary);
  if (norm.length === 0) return null;

  // (2) direct top-level instantiation-key hit
  if (isNicheInstantiationKey(norm)) return norm;

  // (3) sub-slug → parent
  for (const top of NICHE_TREE) {
    if (top.subs.some((sub) => sub.slug === norm)) {
      return isNicheInstantiationKey(top.slug) ? top.slug : null;
    }
  }

  // (4) keyword/contains fallback against top-level + sub labels/slugs.
  //     Iterate NICHE_TREE in declared order → first (= most prominent) match wins,
  //     deterministic. Only top-level slugs that ARE instantiation keys are eligible.
  for (const top of NICHE_TREE) {
    if (!isNicheInstantiationKey(top.slug)) continue;

    const topSlug = normalize(top.slug);
    const topLabel = normalize(top.label);
    // Direct contains on the top-level slug/label (e.g. "fitness coaching" → fitness).
    if (norm.includes(topSlug) || norm.includes(topLabel)) return top.slug;
    // Hyphenless top-level slug match (e.g. "food cooking" → food-cooking).
    if (topSlug.includes("-") && norm.includes(topSlug.replace(/-/g, " "))) return top.slug;

    // Sub label/slug contains (e.g. "investing for beginners" never matches a sub here,
    // but "skincare routine" → beauty via the skincare sub).
    for (const sub of top.subs) {
      const subSlug = normalize(sub.slug);
      const subLabel = normalize(sub.label);
      if (norm.includes(subSlug) || norm.includes(subLabel)) return top.slug;
      if (subSlug.includes("-") && norm.includes(subSlug.replace(/-/g, " "))) return top.slug;
    }
  }

  // (5) no match → honest null (generic fallback downstream)
  void NICHE_INSTANTIATION_KEYS; // keyset is the source of truth for what's resolvable
  return null;
}
