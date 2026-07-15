/**
 * select-hook-targets.ts — WHO each generated hook is written for (per-persona generation).
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * Measured 2026-07-14 (handoff §4c): **the calibrated audience does NOT steer generation.**
 * 20 runs through the real route, two independent methods, both at chance — hook-line
 * embeddings (p = 0.43) and a blind LLM judge *told exactly who the audience is* (45%, i.e.
 * worse than a coin flip). The prompt was DUMPED and verified: all 10 personas and their
 * repaints were present, and the calibrated prompt was 7× richer than General's (2,267 chars
 * vs 307). The data reaches the writer. **The writer ignores it.**
 *
 * ⛔ So the obvious fix — "put more audience text in the generation prompt" — is a MEASURED,
 * REVERTED DEAD END. Do not retry it. It cost ~900 tokens per run for an effect of zero.
 *
 * This module implements the one direction the evidence supports: stop hoping an implicit
 * steer leaks through a prompt, and make the audience **explicit in the OUTPUT**. Each hook is
 * assigned ONE named persona to be written for, and the model must echo back which. The
 * differentiation is then structural — carried by the output contract — rather than prayed for.
 *
 * ─── THE RULES THIS ENCODES ───────────────────────────────────────────────────
 *
 * 1. SOURCE = `audience.personas`, NOT `getPersonaRoster()`.
 *    `buildAudienceRepaint` (the SIM's repaint map) projects `audience.personas`, while
 *    `getPersonaRoster` PREFERS `signature.audience.personas`. Selecting from the roster would
 *    let us aim a hook at a persona the SIM never repaints — the card would name someone the
 *    engine has never heard of. Same source as the repaint map, always.
 *
 * 2. `archetype` IS THE BINDING KEY (F7 / #282). A slug outside the fixed 10 binds to no engine
 *    slot in any niche, so its repaint reaches the model NEVER. Targeting one would print a
 *    confident "written for your X" for a person the writer was never told about. Excluded.
 *
 * 3. AN EMPTY REPAINT IS NOTHING TO WRITE FOR. The repaint is the only description of this
 *    person the model ever sees (the `label` is display-only and MUST NOT reach the model —
 *    the workspace literally promises users this). A persona with a blank repaint gives the
 *    writer no brief, so aiming a hook at it is a label with no substance behind it. Excluded.
 *
 * 4. SELECTION IS DETERMINISTIC — no LLM. The user is told "your five biggest groups"; that
 *    claim has to be auditable, and this subsystem's entire bug history is inputs quietly not
 *    arriving. A model-chosen cast would be unassertable.
 *
 * ─── SLOT-SPREAD ──────────────────────────────────────────────────────────────
 *
 * Pure share-ranking can hand back five FYP personas (six of the ten archetypes are FYP), so
 * the shelf would speak to one corner of the audience and call it "your people". The first pass
 * therefore takes the top persona of EACH slot type present (fyp / niche_deep / loyalist /
 * cross_niche — the four buckets `persona_weights` is keyed by), and only then fills the
 * remaining seats by share. Coverage first, then magnitude.
 *
 * NOTE ON SHARE (F1): `persona_weights` — not `personas[].share` — is the PREDICTION dial. That
 * is a fact about weighting SIM verdicts, and it stands. But the question here is not "who moves
 * the verdict", it is "who is a big chunk of my audience" — and that is precisely what `share`
 * means. Share is the right key for TARGETING; it would be the wrong key for scoring.
 */

import {
  ARCHETYPES,
  ARCHETYPE_SLOT,
  type Archetype,
  type SlotType,
} from "@/lib/engine/wave3/persona-registry";
import type { Audience } from "@/lib/audience/audience-types";

/** The 10 slugs an engine slot can bind to. A repaint keyed outside this set is never read. */
const ARCHETYPE_SET = new Set<string>(ARCHETYPES);

/** Fixed vocabulary order — the deterministic tie-break when two personas share a share. */
const ARCHETYPE_ORDER = new Map<string, number>(ARCHETYPES.map((a, i) => [a, i]));

/**
 * One hook's assigned reader.
 *
 * `repaint` is what the MODEL is given. `label` is what the USER is shown, and it must never
 * reach the model (F7) — it is a creator-editable display string, and the workspace tells users
 * in as many words that it stays out of the prompt. Keep the two apart at every call site.
 */
export interface HookTarget {
  /** Binding key — the slug the engine's slots and the repaint map are keyed by. */
  archetype: Archetype;
  /** The persona's calibrated description. THE ONLY persona text the model sees. */
  repaint: string;
  /**
   * The CREATOR'S OWN name for this persona, when they set one — and ONLY then. Display only;
   * NEVER goes in a prompt (F7).
   *
   * ⚠️ Deliberately NOT pre-resolved to a fallback. The distinction matters at the persistence
   * boundary: a creator's name is HISTORY (snapshot it — a later rename must not rewrite what a
   * card said when it was written), whereas OUR fallback name is merely our current vocabulary
   * (resolve it at RENDER, so improving the vocabulary improves every card ever generated). Bake
   * the fallback in here and old cards say "NICHE DEEP BUYER" forever.
   */
  label?: string;
  /** 0..1 share of the audience. */
  share: number;
  /** Which of the four `persona_weights` buckets this archetype lives in. */
  slot: SlotType;
}


/**
 * The DISTINCT cast, ranked: top persona of each slot type first (coverage), then the rest by
 * share (magnitude). Deterministic throughout — share desc, ties broken by fixed vocabulary
 * order, never by array position (two Flash runs carry no ordering guarantee).
 *
 * Returns [] for General / no audience / no bindable persona — the honest degrade. There are no
 * real people behind an uncalibrated audience, so we name none. See `selectHookTargets`.
 *
 * @param limit Max distinct people to cast (the shelf size).
 */
export function rankHookTargets(audience: Audience | null, limit: number): HookTarget[] {
  if (!audience || audience.is_general || !audience.personas?.length) return [];
  if (limit <= 0) return [];

  const eligible: HookTarget[] = audience.personas
    // Rule 2 + Rule 3: a slug the engine cannot bind, or a persona with no brief to write from,
    // is not a person we can honestly claim to have written for.
    .filter((p) => ARCHETYPE_SET.has(p.archetype) && p.repaint?.trim().length > 0)
    .map((p) => ({
      archetype: p.archetype,
      repaint: p.repaint.trim(),
      // Only the creator's OWN name is carried. No fallback here — see the `label?` doc above.
      ...(p.label?.trim() ? { label: p.label.trim() } : {}),
      share: p.share,
      slot: ARCHETYPE_SLOT[p.archetype],
    }));

  if (eligible.length === 0) return [];

  const byShare = [...eligible].sort(
    (a, b) =>
      b.share - a.share ||
      (ARCHETYPE_ORDER.get(a.archetype) ?? 0) - (ARCHETYPE_ORDER.get(b.archetype) ?? 0),
  );

  // Pass 1 — COVERAGE: the strongest persona of each slot type present, in share order.
  // Six of the ten archetypes are `fyp`, so without this a top-5 can be all-FYP and the shelf
  // would address one corner of the audience while calling itself "your people".
  const picked: HookTarget[] = [];
  const seenSlots = new Set<SlotType>();
  for (const t of byShare) {
    if (picked.length >= limit) break;
    if (seenSlots.has(t.slot)) continue;
    seenSlots.add(t.slot);
    picked.push(t);
  }

  // Pass 2 — MAGNITUDE: fill the remaining seats by share, skipping anyone already cast.
  const pickedArchetypes = new Set(picked.map((t) => t.archetype));
  for (const t of byShare) {
    if (picked.length >= limit) break;
    if (pickedArchetypes.has(t.archetype)) continue;
    pickedArchetypes.add(t.archetype);
    picked.push(t);
  }

  return picked;
}

/**
 * The per-hook assignment: exactly `count` targets, one per hook the run will generate.
 *
 * The shelf size is FIXED (a calibrated audience must not silently return fewer cards than
 * General). Real audiences are not all ten-strong — the scraped rows carry 10 personas, but the
 * authored ones carry 3–4 — so when the cast is smaller than the shelf, assignments CYCLE over
 * it: a 3-persona audience yields [p1, p2, p3, p1, p2]. Two hooks for the same person is
 * legitimate and honest (the output contract already demands distinct mechanisms, so they are
 * two different ways in to the same reader) — whereas padding with invented personas, or
 * quietly shrinking the shelf, is neither.
 *
 * @returns exactly `count` targets, or [] for an audience with no real people to name.
 */
export function selectHookTargets(audience: Audience | null, count: number): HookTarget[] {
  const cast = rankHookTargets(audience, count);
  if (cast.length === 0) return [];
  return Array.from({ length: count }, (_, i) => cast[i % cast.length]!);
}
