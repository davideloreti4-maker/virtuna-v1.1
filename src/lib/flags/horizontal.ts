/**
 * HORIZONTAL_ENABLED — the ONE switch for the horizontal (GSI) integration.
 *
 * Owner call, 2026-07-13: the product commits to the CREATOR vertical for MVP. The
 * horizontal surface — the Profile · Simulate · Predict verbs, and the `mode: "general"`
 * audiences they run on (the authored Analyst / Hiring panels, plus any SIM a past
 * `/profile` run minted) — is HIDDEN, not removed.
 *
 * NOTHING IS DELETED. The routes (`/api/tools/{profile,simulate,predict}`), the runners,
 * the block schemas, the renderers, and every DB row all stay exactly where they are.
 * Persisted `profile-read` / `reaction-distribution` / `prediction-gauge` blocks in old
 * threads still render — the block registry is untouched on purpose, so history doesn't
 * rot into `unsupported-block`. This flag ONLY closes the doors that surface the verbs.
 *
 * Flip this to `true` and the horizontal comes back exactly as it was. That is the whole
 * point: the decision is reversible for the cost of one boolean.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * ⚠️  THE TRAP — "general" means two different things, and conflating them breaks the app.
 *
 *   GENERAL_AUDIENCE   id:'general'  is_general:true   mode:"socials"   ← KEEP. NOT horizontal.
 *   GENERAL_TEMPLATES  Analyst/Hiring panels           mode:"general"   ← HIDE. The horizontal.
 *
 * `GENERAL_AUDIENCE` is *named* General but runs the SOCIALS pack: it is the DEFAULT
 * baseline audience every creator gets before they calibrate, and it is what the
 * regression gate scores against. Hiding it would break the default audience for every
 * user. `audience-repo.ts` flags this collision as "PITFALL 1 — do not conflate".
 *
 * So the predicate below keys on `mode`, NEVER on `is_general`. Keep it that way.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */

/** The master switch. `false` ⇒ the horizontal is hidden everywhere. */
export const HORIZONTAL_ENABLED = false;

/**
 * The three horizontal verbs (GSI Profile / Simulate / Predict). Exported as data so the
 * guard test can assert they stay hidden while the flag is off, rather than trusting six
 * call sites to have remembered.
 */
export const HORIZONTAL_SKILL_IDS = ["profile", "simulate", "predict"] as const;

export type HorizontalSkillId = (typeof HORIZONTAL_SKILL_IDS)[number];

/**
 * Is this a horizontal audience? Keys on `mode === "general"` — the authored Analyst /
 * Hiring panels and any Profile-minted person-SIM. NEVER keys on `is_general` (see THE
 * TRAP above: the baseline creator audience carries that flag and must stay visible).
 */
export function isHorizontalAudience(audience: { mode?: string | null }): boolean {
  return audience.mode === "general";
}

/**
 * Drop horizontal audiences from a list when the flag is off. A no-op when it is on, so
 * the restore path is genuinely just the boolean.
 */
export function filterHorizontalAudiences<T extends { mode?: string | null }>(
  audiences: T[],
): T[] {
  if (HORIZONTAL_ENABLED) return audiences;
  return audiences.filter((a) => !isHorizontalAudience(a));
}
