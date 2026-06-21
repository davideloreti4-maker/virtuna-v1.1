/**
 * deriveAudienceArchetype — reads Flash per-persona stop verdicts → the human-facing
 * "stops the {persona}" audience tag (D-03/D-04).
 *
 * Design constraints:
 *  - PURE: no I/O, no side effects, fully unit-testable.
 *  - Reads ONLY Flash per-persona verdicts (D-03 — no new SIM pass, no extra call).
 *  - The tag names an AUDIENCE persona (which SIM persona stopped), never a CRAFT archetype.
 *  - CRITICAL (D-04): this function never imports, references, or emits the private
 *    craft-archetype vocabulary (BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE/QUESTION).
 *    Craft archetypes drive intra-batch diversity inside the generator; they NEVER
 *    surface as a user-facing field.
 *
 * Tie-break rule (Claude's Discretion):
 *  When multiple personas stop, prefer the most discriminating stopper — the "toughest
 *  crowd" that still stopped reads as the strongest pull signal. Priority order:
 *  tough_crowd > niche_deep_scout > niche_deep_buyer > purposeful_viewer >
 *  saver > cross_niche_curiosity > sharer > lurker > high_engager > loyalist.
 *  If the highest-priority stopper is not in this map, use the first stopper in
 *  input order (predictable fallback).
 *
 * All-scroll fallback: returns an honest neutral tag when no persona stopped.
 * Never fabricate a "stops the X" claim when no one stopped (honesty spine).
 */

// ─── Persona archetype → human-facing label ───────────────────────────────────
// Maps raw archetype id → the label that composes the tag ("Stops the <label>").
// Fallback: humanize the raw id (replace underscores with spaces, title-case).

const ARCHETYPE_LABEL: Record<string, string> = {
  tough_crowd: 'the skeptic',
  niche_deep_scout: 'the expert',
  niche_deep_buyer: 'your core buyer',
  purposeful_viewer: 'the purposeful scroller',
  saver: 'the utility-hunter',
  cross_niche_curiosity: 'the curious newcomer',
  sharer: 'the connector',
  lurker: 'the silent watcher',
  high_engager: 'the active fan',
  loyalist: 'the loyalist',
};

// ─── Tie-break priority (lower index = higher priority = harder to stop) ──────
// Tough crowd stopping is the strongest signal; loyalist stopping is the weakest.
const TIEBACK_PRIORITY: string[] = [
  'tough_crowd',
  'niche_deep_scout',
  'niche_deep_buyer',
  'purposeful_viewer',
  'saver',
  'cross_niche_curiosity',
  'sharer',
  'lurker',
  'high_engager',
  'loyalist',
];

// ─── Humanize fallback ────────────────────────────────────────────────────────
function humanizeArchetype(archetype: string): string {
  return archetype
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .toLowerCase();
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Derive the human-facing audience-archetype tag from Flash per-persona stop verdicts.
 *
 * @param personas - Array of Flash per-persona reaction objects (D-03).
 *   Each entry: { archetype: string; verdict: "stop" | "scroll"; quote: string }
 * @returns A concise human-facing string naming the audience persona that stopped,
 *   or an honest neutral tag if no persona stopped.
 *
 * D-04: never references or emits BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE/QUESTION.
 */
export function deriveAudienceArchetype(
  personas: Array<{ archetype: string; verdict: 'stop' | 'scroll'; quote: string }>,
): string {
  // Collect all stoppers
  const stoppers = personas.filter((p) => p.verdict === 'stop');

  // All-scroll → honest neutral tag (honesty spine — never fabricate a capture claim)
  if (stoppers.length === 0) {
    return 'No clear audience lock';
  }

  // Single stopper — use directly
  if (stoppers.length === 1) {
    const archetype = stoppers[0]!.archetype;
    const label = ARCHETYPE_LABEL[archetype] ?? humanizeArchetype(archetype);
    return `Stops ${label}`;
  }

  // Multiple stoppers — pick the highest-priority (toughest crowd that stopped)
  let best: string | null = null;
  let bestPriority = Infinity;

  for (const stopper of stoppers) {
    const priority = TIEBACK_PRIORITY.indexOf(stopper.archetype);
    // indexOf returns -1 for unknown archetypes → treat as lowest priority (999)
    const effectivePriority = priority === -1 ? 999 : priority;
    if (effectivePriority < bestPriority) {
      bestPriority = effectivePriority;
      best = stopper.archetype;
    }
  }

  // If no known archetype found (all unknown), fall back to first stopper in input order
  if (best === null) {
    best = stoppers[0]!.archetype;
  }

  const label = ARCHETYPE_LABEL[best] ?? humanizeArchetype(best);
  return `Stops ${label}`;
}
