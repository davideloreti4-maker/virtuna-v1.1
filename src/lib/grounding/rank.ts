/**
 * grounding/rank.ts — the STRUCTURAL ranker (hooks).
 *
 * WHY THIS EXISTS. `hook_template` is a MADLIB: a proven hook with its topic lifted out and
 * replaced by slots — "I [achieved significant result] for [monetary value]". That is, by
 * construction, an abstraction OVER the subject. The lesson it carries is the SHAPE and the
 * reason the shape works; the words are a worked example, not the payload. A founder can run
 * a fitness creator's madlib and it lands.
 *
 * But retrieval selected these madlibs by cosine over a TOPICAL embedding of the filled-in
 * line, then dropped everything under a similarity floor. So the pipeline abstracted the topic
 * out to build the template, then picked the template by the topic it had just removed — and
 * the floor deleted the rest. Measured on the live 532-row corpus (scripts/probe-hook-transfer.ts):
 *
 *   • 8 of 10 real creator asks retrieved ZERO rows. "personal branding for founders" peaked at
 *     0.576 against a 0.58 floor — and the row it deleted at 0.576 was, literally, a video about
 *     building a personal brand. The most on-topic hook in the corpus, thrown away by the
 *     topical filter.
 *   • The off-topic control ("carbonara recipe") scored 0.673 and SHIPPED. The floor does not
 *     separate relevant from irrelevant; it only detects whether the corpus happens to contain
 *     your subject.
 *   • Across ten queries, 9 distinct rows ever reached the model. 515 usable madlibs were
 *     unreachable by any query tried.
 *
 * So for hooks we stop gating on subject and rank on STRUCTURE:
 *
 *   1. ARCHETYPE SPREAD is the payload. The corpus holds 14 archetypes, but the cosine top-12
 *      returned only 6 — over-weighted to `personal-experience`, which is simply the biggest
 *      class (164 of 532). Six examples of one shape teach less than six different shapes.
 *      We select round-robin across archetypes: six examples, six ways to open.
 *   2. TOPIC becomes a TIEBREAKER, not a gate — it picks WHICH exemplar of each archetype you
 *      get, never WHETHER you get one. A founder asking about branding still gets the
 *      founder-flavoured `authority` hook, if one exists; if none does, they get the best
 *      `authority` hook there is, which still transfers.
 *   3. PROOF breaks ties ahead of topic: a madlib that demonstrably beat its baseline is a
 *      better exemplar of its shape than one that merely exists.
 *
 * NOT ranked on `trust_weight`: the corpus is 100% curated today, so it is the constant 1.5 for
 * every row. A ranking term that cannot discriminate is decoration, and this subsystem has
 * already shipped enough fields with zero readers.
 */

import type { SharedMatchRow } from "./corpus";
import { MIN_OUTLIER_MULTIPLIER } from "./outlier-gate";

/** Rows with no archetype extracted (8 of 532) still rank — they group under this key. */
const UNCLASSIFIED = "(unclassified)";

/**
 * Does this row carry a hook structure to borrow? Weaker than the generic `hasReusableSignal`
 * (which also accepts an idea or a template): for the HOOKS slice specifically, a row without a
 * madlib or a spoken line has nothing to teach — its `idea.belief` never reaches the renderer.
 */
export function hasHookStructure(row: SharedMatchRow): boolean {
  return Boolean(row.hook_template?.trim() || row.spoken_hook?.trim());
}

/** A proven outlier is a better exemplar of its shape than an unmeasured one. */
function isProven(row: SharedMatchRow): boolean {
  const m = row.outlier_multiplier;
  return typeof m === "number" && Number.isFinite(m) && m >= MIN_OUTLIER_MULTIPLIER;
}

/**
 * Within one archetype: proven exemplars first, then by how well the row's subject happens to
 * match the ask (the demoted topical signal), then by raw multiplier as a stable last resort.
 */
function compareWithinArchetype(a: SharedMatchRow, b: SharedMatchRow): number {
  const provenA = isProven(a) ? 1 : 0;
  const provenB = isProven(b) ? 1 : 0;
  if (provenA !== provenB) return provenB - provenA;

  if (b.similarity !== a.similarity) return b.similarity - a.similarity;

  return (b.outlier_multiplier ?? 0) - (a.outlier_multiplier ?? 0);
}

/**
 * Select up to `maxExamples` rows spanning as many distinct hook archetypes as the corpus can
 * offer, preferring the proven and the topically-near exemplar of each.
 *
 * Round-robin, not top-N-per-group: pass 1 takes the best row of every archetype, pass 2 takes
 * each archetype's runner-up, and so on. With 14 archetypes and 6 slots that yields 6 distinct
 * shapes; with only 3 archetypes available it wraps and deepens rather than returning short.
 *
 * Archetypes are ordered by their BEST row — so the shape whose strongest exemplar is closest to
 * the creator's ask leads the block, and the model reads the most relevant structure first.
 */
export function selectStructuralExamples(
  rows: SharedMatchRow[],
  maxExamples: number,
): SharedMatchRow[] {
  const usable = rows.filter(hasHookStructure);
  if (usable.length === 0) return [];

  const byArchetype = new Map<string, SharedMatchRow[]>();
  for (const row of usable) {
    const key = row.hook_archetype?.trim() || UNCLASSIFIED;
    const bucket = byArchetype.get(key);
    if (bucket) bucket.push(row);
    else byArchetype.set(key, [row]);
  }

  // Non-empty by construction: every group was created by pushing a row into it.
  const groups = [...byArchetype.values()].filter((g): g is [SharedMatchRow, ...SharedMatchRow[]] =>
    g.length > 0,
  );
  for (const group of groups) group.sort(compareWithinArchetype);
  // Lead with the archetype whose champion is the strongest — same comparator, no new policy.
  groups.sort((a, b) => compareWithinArchetype(a[0], b[0]));

  const selected: SharedMatchRow[] = [];
  const deepest = Math.max(...groups.map((g) => g.length));
  for (let depth = 0; depth < deepest && selected.length < maxExamples; depth++) {
    for (const group of groups) {
      if (selected.length >= maxExamples) break;
      const row = group[depth];
      if (row) selected.push(row);
    }
  }
  return selected;
}
