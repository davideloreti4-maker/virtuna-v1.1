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
import { isNicheInstantiationKey } from "./persona-registry";

type NicheTreeNode = (typeof NICHE_TREE)[number];

/** Normalize a free-text niche value: trim + lowercase. */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** A slug/label plus its hyphenless variant ("food-cooking" → ["food-cooking", "food cooking"]). */
function hyphenVariants(token: string): string[] {
  const t = normalize(token);
  return t.includes("-") ? [t, t.replace(/-/g, " ")] : [t];
}

/**
 * Resolve a free-text / sub-slug `niche_primary` to a top-level NICHE_INSTANTIATION key.
 *
 * Resolution order:
 *   1. null / empty → null.
 *   2. Normalized direct top-level instantiation-key hit → return it.
 *   3. Sub-slug → walk NICHE_TREE, find the parent whose `subs[]` contains the slug;
 *      return parent.slug if it is an instantiation key.
 *   4. Forward-contains (input phrase CONTAINS a known token): 4a top-level slug/label,
 *      then 4b sub slug/label. Longest matched token wins (specificity > declaration order, WR-02).
 *   5. Reverse whole-segment (a known token has the input as a whole hyphen/space SEGMENT) —
 *      bare single-word inputs only, ≥3 chars (e.g. "finance" → education, WR-03).
 *   6. No match → null (honest generic fallback — never fabricate a niche).
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

  // (4) forward-contains fallback — the input PHRASE contains a known token.
  //     Specificity beats declaration order (WR-02): tier 4a tests TOP-LEVEL slug/label
  //     first (a niche NAME in the text is the strongest signal), tier 4b tests SUB
  //     slug/label. Within each tier the LONGEST matched token wins (most specific), with
  //     declaration order as the deterministic tie-break. This stops an incidental short
  //     sub-token from an earlier niche (e.g. "makeup") beating a later top-level match.
  const forwardBest = (tokensFor: (top: NicheTreeNode) => string[]): string | null => {
    let best: { key: string; len: number } | null = null;
    for (const top of NICHE_TREE) {
      if (!isNicheInstantiationKey(top.slug)) continue;
      for (const tok of tokensFor(top)) {
        if (tok.length > 0 && norm.includes(tok)) {
          // strict `>` keeps the earlier (declaration-order) niche on a length tie
          if (best === null || tok.length > best.len) best = { key: top.slug, len: tok.length };
        }
      }
    }
    return best?.key ?? null;
  };

  // 4a — top-level slug/label (+ hyphenless variants)
  const topHit = forwardBest((top) => [
    ...hyphenVariants(top.slug),
    ...hyphenVariants(top.label),
  ]);
  if (topHit) return topHit;

  // 4b — sub slug/label (+ hyphenless variants)
  const subHit = forwardBest((top) =>
    top.subs.flatMap((sub) => [...hyphenVariants(sub.slug), ...hyphenVariants(sub.label)]),
  );
  if (subHit) return subHit;

  // (5) reverse whole-segment fallback for BARE single-word inputs (WR-03): the most
  //     common production free-text ("finance", "tech", "food", "fashion", "music") is a
  //     whole hyphen/space-delimited SEGMENT of a known token (e.g. "finance" is a segment
  //     of "personal-finance" → education; "tech" of "tech-gadgets"). Whole-segment match
  //     (NOT arbitrary substring) avoids mid-word false positives ("art" must not match the
  //     "art" inside "smart-home"). Gated to single-word inputs (phrases are handled by the
  //     forward pass) with a 3-char floor to keep 1–2 char noise out. Declaration order is
  //     the tie-break, so an earlier niche wins when a segment is shared.
  if (norm.length >= 3 && !/\s/.test(norm)) {
    for (const top of NICHE_TREE) {
      if (!isNicheInstantiationKey(top.slug)) continue;
      const tokens = [
        normalize(top.slug),
        normalize(top.label),
        ...top.subs.flatMap((sub) => [normalize(sub.slug), normalize(sub.label)]),
      ];
      for (const tok of tokens) {
        if (tok.split(/[-\s]+/).includes(norm)) return top.slug;
      }
    }
  }

  // (6) no match → honest null (generic fallback downstream)
  return null;
}
