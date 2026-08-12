/**
 * search-budget.ts — how many times a single turn may search the corpus, and what happens when it
 * asks again anyway.
 *
 * WHY THIS EXISTS, measured rather than supposed. The composition spike re-run
 * (`docs/superpowers/specs/2026-08-12-composed-card-spike-rerun.md`) recorded qwen3.7-flash — the
 * SHIPPED chat model — spending every round of a turn inside `search_corpus` and never producing an
 * answer at all: 6 rounds, 6 searches, zero prose, on 2 of 6 asks and in 3 of 3 runs. It reads as
 * two different pathologies and is really one:
 *
 *   · `hooks`  — the IDENTICAL query, four times. Not exploration; a stuck loop.
 *   · `angles` — six distinct rephrasings, never satisfied.
 *
 * Production caps a turn at 4 rounds (`DEFAULT_MAX_ROUNDS`), two fewer than the spike, so the same
 * turn ends with an EMPTY answer — no cards, no prose. This is not a composed-card problem: it is
 * reachable today on any grounded chat turn.
 *
 * The governor is deliberately dumb and synchronous — no model, no I/O — because it has to be
 * applied identically by the streaming loop and by the spike harness. A rule the harness reimplements
 * is a rule the harness eventually measures differently from production.
 */

/**
 * Searches per turn. Three, because qwen3.7-plus completed every spike case inside 3-5 searches
 * and the cap must sit at the top of a competent model's working range rather than below it. The
 * refusal is not a dead end — the model keeps every row it already pulled.
 */
export const MAX_CORPUS_SEARCHES_PER_TURN = 3;

export interface SearchVerdict {
  allow: boolean;
  /**
   * What to hand back as the tool result when `allow` is false. Shaped as a payload rather than a
   * bare string because the model reads it as JSON alongside real results.
   */
  refusal?: { repeat?: true; error?: string; note: string };
}

export interface SearchGovernor {
  /** Decide whether this search may run — and record it if so. */
  check(args: Record<string, unknown>): SearchVerdict;
  /** Searches actually executed this turn. A refused repeat never counts: it did not run. */
  spent(): number;
  /** True once the budget is gone, so a caller can stop offering the tool at all. */
  exhausted(): boolean;
}

/**
 * Identity of a search. Query text is normalised (a model retypes its query, it does not copy it),
 * while axis and every filter are part of the key — "pricing, structural" is a genuinely different
 * question from "pricing, topical" and must not be refused as a repeat.
 */
function keyOf(args: Record<string, unknown>): string {
  const query = typeof args.query === "string" ? args.query.trim().toLowerCase().replace(/\s+/g, " ") : "";
  const rest = Object.entries(args)
    .filter(([k, v]) => k !== "query" && k !== "limit" && typeof v === "string")
    .map(([k, v]) => `${k}=${String(v).trim().toLowerCase()}`)
    .sort();
  return [query, ...rest].join("|");
}

export function createSearchGovernor(max: number = MAX_CORPUS_SEARCHES_PER_TURN): SearchGovernor {
  const seen = new Set<string>();
  let count = 0;

  return {
    spent: () => count,
    exhausted: () => count >= max,
    check(args) {
      const key = keyOf(args ?? {});

      // Checked BEFORE the budget: a repeat is the more actionable message, and a repeat that
      // spent budget would let a stuck model exhaust the turn without running a single new search.
      if (seen.has(key)) {
        return {
          allow: false,
          refusal: {
            repeat: true,
            note:
              "You already ran this exact search this turn and its results are above — you already " +
              "have these rows. Do not search for this again. Either search for something " +
              "genuinely different, or answer now using what you have.",
          },
        };
      }

      if (count >= max) {
        return {
          allow: false,
          refusal: {
            error: `search limit reached (${max} per turn)`,
            note:
              "You have searched enough. Answer now using the rows you already have — and if none " +
              "of them fit, say plainly that you found no proven examples and answer from craft " +
              "knowledge, labelled as such.",
          },
        };
      }

      seen.add(key);
      count++;
      return { allow: true };
    },
  };
}
