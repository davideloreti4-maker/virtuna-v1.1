/**
 * output-guards.ts — cheap, CHECKABLE output validations for the generation runners
 * (Stage A of the engine rework, 2026-08-09; proposal §3.A).
 *
 * Every guard here judges a mechanical property — word overlap, slot skeletons, digit
 * junk, prefix survival — never taste. That constraint is load-bearing: the removed
 * rubric critic failed ~100% of the time precisely because it judged taste
 * (hooks-runner.ts, S5 note). These guards exist to catch the measured defect classes:
 *
 *   N-7  a script chip's anchor ignored → a script about a different topic
 *   N-2  the sourceIndex digits shipped as the SEED LINE ("0", "1", "3")
 *   N-1  "PROVEN STRUCTURE" receipts decorating output that shares no skeleton with them
 *   N-4  "3 hooks" asked, 5 delivered
 *   —    a card citing a grounding example the assembler had already truncated out of
 *        the model's own prompt (assembler.ts step 4b re-truncates AFTER `used` is built)
 *
 * All pure functions, no I/O — unit-tested in __tests__/output-guards.test.ts.
 */

import type { RetrievedExample } from "@/lib/grounding/types";

// ─── Shared text normalization ───────────────────────────────────────────────

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words that carry no subject signal — never count them as anchor overlap. */
const STOPWORDS = new Set([
  "this", "that", "with", "your", "youre", "have", "from", "they", "them",
  "what", "when", "where", "will", "would", "could", "should", "about",
  "just", "like", "dont", "didnt", "doesnt", "into", "than", "then", "there",
  "here", "been", "being", "were", "wont", "cant", "over", "only", "very",
  "them", "their", "these", "those", "make", "made", "making", "want", "need",
]);

/** The content-bearing words of a line: normalized, ≥4 chars, minus stopwords. */
function significantWords(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

// ─── N-7 · anchor fidelity ───────────────────────────────────────────────────

/**
 * Does the output's opening honor the anchor it was launched from?
 *
 * Mechanical check only: the opening must share subject words with the anchor. A real
 * adaptation keeps the anchor's nouns (alarm, dopamine, receptors); the N-7 failure —
 * a dance-challenge script from a morning-routine hook — shares zero. Threshold is
 * deliberately loose (≥2 shared significant words, or ≥30% of the anchor's) so a heavy
 * rewording still passes; the guard exists to catch TOPIC ABANDONMENT, not paraphrase.
 *
 * Vacuously true when either side has too little signal to judge — an empty opening is
 * the beats-validation guard's problem, not an anchor problem.
 */
export function anchorHonored(anchor: string, opening: string): boolean {
  const anchorWords = [...new Set(significantWords(anchor))];
  if (anchorWords.length < 2) return true; // nothing to check
  const openingWords = new Set(significantWords(opening));
  if (openingWords.size === 0) return true;
  const shared = anchorWords.filter((w) => openingWords.has(w)).length;
  return shared >= 2 || shared / anchorWords.length >= 0.3;
}

// ─── N-2 · seed-line plausibility ────────────────────────────────────────────

/**
 * Is this seedHook plausibly a spoken line, rather than schema junk? The N-2 failure
 * shipped the adjacent sourceIndex field's digits ("0", "1", "3") as the SEED LINE and
 * `typeof === "string" && truthy` let it through. A seed line must contain letters and
 * at least two words' worth of content.
 */
export function plausibleSeedHook(seed: string): boolean {
  const t = seed.trim();
  if (t.length < 5) return false;
  if (!/[a-z]/i.test(t)) return false; // digits/punctuation only
  return true;
}

// ─── N-1 · template instantiation ────────────────────────────────────────────

/**
 * Does the output line actually instantiate the cited madlib's skeleton?
 *
 * A madlib is literal skeleton segments around [slots]. If NONE of the meaningful
 * literal segments appear (fuzzily) in the line, the citation is decorative — the
 * receipt would assert "this borrows that video's structure" about a line that
 * demonstrably doesn't (all four N-1 pairs share zero skeleton). The threshold is ONE
 * matched segment, deliberately generous: inflection changes ("does" → "do") must not
 * cost an honest citation. Vacuously true with no template or an all-slots template.
 */
export function templateInstantiated(template: string | null | undefined, line: string): boolean {
  if (!template || !template.trim()) return true;
  const segments = template
    .split(/\[[^\]]*\]/)
    .map((s) => normalize(s))
    .filter((s) => s.length >= 8 || s.split(" ").filter(Boolean).length >= 2);
  if (segments.length === 0) return true; // all slots — nothing checkable
  const lineWords = new Set(normalize(line).split(" ").filter(Boolean));
  for (const seg of segments) {
    const words = seg.split(" ").filter((w) => w.length >= 3);
    if (words.length === 0) continue;
    const hits = words.filter((w) => lineWords.has(w)).length;
    if (hits / words.length >= 0.6) return true;
  }
  return false;
}

// ─── N-4 · requested count ───────────────────────────────────────────────────

/** Pipeline max — mirrors hooks-runner HOOK_COUNT (a cost rail, not a quality bar). */
const MAX_COUNT = 5;

/**
 * The hook count the creator actually asked for ("3 hooks for my video…"), or null
 * when the ask names none. Only a number DIRECTLY modifying "hook(s)" counts — "for
 * 30 days" must not read as a count. Clamped to the pipeline max.
 */
export function requestedCount(ask: string | undefined): number | null {
  if (!ask) return null;
  const m = /(\d{1,2})\s*hooks?\b/i.exec(ask);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, MAX_COUNT);
}

// ─── Citation integrity · trim `examples` to what the model was actually shown ──

const CORPUS_FENCE_OPEN = "Grounded examples:\n<<<USER_CONTENT>>>\n";
const FENCE_CLOSE = "\n<<<END_USER_CONTENT>>>";

/**
 * Re-derive which grounding examples SURVIVED bundle assembly.
 *
 * assembleBundle's overflow path (step 4b) re-truncates the fenced corpus AFTER the
 * runner's `examples` (the sourceIndex mapping array) was fixed — so the model could
 * cite an example that was cut from its own prompt, and the card rendered the receipt
 * anyway. Truncation is a pure PREFIX slice of the corpus string, and prompt.ts renders
 * examples as "\n\n"-joined blocks each opening with "N. " — so an example survived iff
 * its block's END offset fits inside the surviving prefix.
 *
 * Conservative by design: an unresolvable boundary (e.g. a future corpus format whose
 * numbering this can't parse) drops the tail rather than keeping it — a dropped
 * citation degrades to an honest "Original", a kept phantom is a false receipt.
 */
export function trimExamplesToBundle(
  bundle: string,
  corpus: string | undefined,
  examples: RetrievedExample[],
): RetrievedExample[] {
  if (!corpus || examples.length === 0) return examples;

  const open = bundle.lastIndexOf(CORPUS_FENCE_OPEN);
  if (open === -1) return []; // corpus section dropped entirely — the model saw none of it
  const start = open + CORPUS_FENCE_OPEN.length;
  const end = bundle.indexOf(FENCE_CLOSE, start);
  if (end === -1) return []; // malformed fence — trust nothing
  const inner = bundle.slice(start, end);

  if (inner === corpus) return examples; // the common case: nothing was cut

  const survived = inner.length;
  const kept: RetrievedExample[] = [];
  for (let n = 1; n <= examples.length; n++) {
    // The block for example n ends where example n+1's "\n\nN+1. " marker begins.
    const nextMarker = corpus.indexOf(`\n\n${n + 1}. `);
    const endOfN = n === examples.length ? corpus.length : nextMarker;
    if (endOfN === -1 || endOfN > survived) break; // cut (or unresolvable) — drop this and the rest
    kept.push(examples[n - 1]!);
  }
  return kept;
}

// ─── F-7 · source diversity ──────────────────────────────────────────────────

/** Max cards in one run that may carry the SAME source's receipt. */
export const MAX_CITATIONS_PER_SOURCE = 2;

/**
 * Per-run citation counter: call `admit(key)` with a stable source key (videoUrl or
 * handle) before attaching a proof; false ⇒ this source has already been cited
 * MAX_CITATIONS_PER_SOURCE times this run and the card should render without a receipt
 * (F-7 shipped the same reel on 3 of 5 cards). Pure bookkeeping — no reordering.
 */
export function createSourceDiversityCap(max: number = MAX_CITATIONS_PER_SOURCE): {
  admit: (key: string | null | undefined) => boolean;
} {
  const counts = new Map<string, number>();
  return {
    admit(key) {
      if (!key) return true; // unkeyable source — nothing to deduplicate on
      const n = counts.get(key) ?? 0;
      if (n >= max) return false;
      counts.set(key, n + 1);
      return true;
    },
  };
}
