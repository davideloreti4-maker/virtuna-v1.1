/**
 * warrant.ts — the ONE definition of "what do these rows entitle us to claim?"
 *
 * Both grounding paths retrieve through `retrieveCachedExamples`, and until now they answered the
 * citation question separately: the chat tool computed a warrant (#342), the generation runners
 * inferred one from `examples.length > 0`. Two answers to one question is how they drift. This
 * module is the shared answer; `corpus-tool.ts` and `gather-for-run.ts` both import it.
 *
 * ── The distinction this module exists to protect ────────────────────────────
 *
 * RECALL and WARRANT are different thresholds answering different questions, and collapsing them
 * is what lets a tangential row become a fabricated citation:
 *
 *   • "should the model SEE this row?"  → recall. Cheap to be wrong; the model reads and discards.
 *   • "may we CITE it as evidence?"     → warrant. Expensive to be wrong.
 *
 * They are allowed to differ, and on the chat path they deliberately do (recall 0.4 / warrant 0.5).
 * On the generation path the retrieval floor already sits AT the warrant floor (0.5 topical), so
 * the two coincide — every row the runner receives has already cleared warrant. That coincidence is
 * why the runners' `length > 0` was sound; it is not why it was *right*, and it would stop being
 * sound the moment either floor moved. Now the question is asked explicitly on both paths.
 *
 * ── Why THREE axes and not two ────────────────────────────────────────────────
 *
 * A two-axis (topical/structural) lift is the obvious refactor and it is WRONG — it silently breaks
 * the path the user actually paid for. Freshly scraped rows carry `similarity: null` by design
 * (orchestrator.ts: "this row was never matched against a query, so there is no similarity to
 * state"), and a null cannot clear a floor it was never measured against. So under two axes a
 * "Find new outliers" run — Apify scrape, real above-baseline outliers, the user's money — assesses
 * as onSubject 0 → `none` → the card renders UNGROUNDED. Every cached-fixture test stays green
 * while it happens, because fixtures carry similarities.
 *
 * `provenance` is that third axis. A scraped row's warrant does not come from cosine and never did:
 * it was fetched by SEARCHING the subject and then proof-gated as an above-baseline outlier. That is
 * evidence — arguably stronger evidence than a 0.5 cosine — it just has no cosine to quantify. The
 * honest statement is "real proven outlier, gathered for this query, closeness unquantified", not
 * "not grounded".
 *
 * The axis is DECLARED by the caller, never sniffed from the rows. The first cut of this module
 * inferred provenance from "nothing was measured", and an existing chat guard (#342) immediately
 * caught it: out of the corpus cache a null similarity is a MALFUNCTION, not a provenance signal, and
 * the inference would have handed a broken chat batch the same warrant as a paid scrape. The caller
 * always knows where its rows came from — so it says.
 *
 * ── The axes ──────────────────────────────────────────────────────────────────
 *
 *  • topical    — the claim is about the SUBJECT ("videos about X do Y"), so the rows must be about
 *                 X. Cosine decides, at the warrant floor. Below it → `none`: the corpus returned
 *                 rows (cosine search always does) but none are evidence about this subject.
 *  • structural — the claim is about SHAPE ("this hook pattern works"), subject-independent by
 *                 design (retrieve.ts: a madlib is a hook with the topic lifted out; every curated
 *                 row is a human-picked teaching example). Warranted whenever rows came back, but
 *                 it warrants a claim about STRUCTURE ONLY — never about the topic.
 *  • provenance — the rows were extracted, not matched: no cosine exists to measure. Warranted by
 *                 the extraction pipeline (search-by-subject + outlier proof gate), and the note
 *                 says the closeness is unquantified rather than implying it was measured.
 *
 * ⚠️ `grounded` means something genuinely weaker on a structural batch than on a topical one, and
 * that asymmetry is DELIBERATE (owner call 2026-07-14; hooks retrieves at minSimilarity 0 because
 * structure transfers across subjects). It is safe because no surface turns `grounded` into a
 * subject claim: an attributed card renders `ProofReceipt` whose eyebrow is "Proven structure" —
 * already the structural claim — and an unattributed one renders `NoSourceNote`, which claims
 * nothing at all. Do not "fix" the asymmetry by raising the hooks floor; that deletes the transfer
 * the floor was lowered to permit, and buys no honesty the renderer wasn't already providing.
 */

import type { RetrievedExample } from "@/lib/grounding/types";

/**
 * The WARRANT floor — the cosine above which a row may count as evidence ABOUT THE SUBJECT.
 *
 * 0.5 is the owner-calibrated topical floor (retrieve.ts, measured 2026-07-17 across 12 realistic
 * asks: 0.50 → 9/12 hit). The corpus median similarity is ~0.45, so anything at or below that is
 * indistinguishable from "a random row" — which is the definition of ungrounded.
 */
const WARRANT_FLOOR_DEFAULT = 0.5;

/** Rows above the warrant floor needed before an answer may be called grounded on the subject. */
const WARRANT_MIN_ROWS = 1;

export function warrantFloor(): number {
  const raw = Number(process.env.GROUNDING_WARRANT_MIN_SIMILARITY);
  return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : WARRANT_FLOOR_DEFAULT;
}

/** What the returned rows entitle a claim about. `none` = they entitle nothing. */
export type Warrant = "topical" | "structural" | "provenance" | "none";

/**
 * How the caller OBTAINED these rows — which is what decides how they earn a warrant.
 *
 * 🔴 This is declared by the caller, never inferred from the data, and the difference matters:
 * a missing `similarity` means two opposite things depending on where the row came from. Out of the
 * corpus cache every row HAS a cosine, so a null there means retrieval misbehaved and "absent is not
 * passing" is the honest read. Out of the scraper a null is BY DESIGN — the row was never matched
 * against anything. Inferring provenance from `measured === 0` would collapse those two, and quietly
 * hand a chat batch with broken similarities the same warrant as a proof-gated scrape.
 */
export type WarrantAxis = "topical" | "structural" | "provenance";

export interface WarrantAssessment {
  warrant: Warrant;
  /** May the caller present this batch as grounded at all? */
  grounded: boolean;
  /** Rows clearing the topical floor. 0 on an unmeasured (provenance) batch — absent, not failing. */
  onSubject: number;
  /** Rows carrying a cosine at all. 0 ⇒ nothing was measured, so nothing can be measured against. */
  measured: number;
}

/** A row carries measurable closeness only if a cosine was actually computed for it. */
function isMeasured(e: RetrievedExample): boolean {
  return typeof e.similarity === "number";
}

/** Rows at or above the warrant floor. Unmeasured rows never count — absent is not "passing". */
function countOnSubject(examples: RetrievedExample[]): number {
  const floor = warrantFloor();
  return examples.filter((e) => isMeasured(e) && (e.similarity as number) >= floor).length;
}

/**
 * Does this batch WARRANT a claim, and a claim about what?
 *
 * `axis` is the caller's INTENT (what kind of claim it wants to make); the returned `warrant` is
 * what the rows actually support, which may be weaker — or a different kind entirely, when the rows
 * turn out to be unmeasured. See the module header for why each axis earns its warrant differently.
 */
export function assessWarrant(axis: WarrantAxis, examples: RetrievedExample[]): WarrantAssessment {
  if (examples.length === 0) {
    return { warrant: "none", grounded: false, onSubject: 0, measured: 0 };
  }
  const measured = examples.filter(isMeasured).length;
  const onSubject = countOnSubject(examples);

  // Structural: the warrant is CURATION, not cosine — every stored row is a human-picked teaching
  // example. onSubject is still reported (telemetry: how topical did the structural batch happen
  // to be?) but it does not gate.
  if (axis === "structural") {
    return { warrant: "structural", grounded: true, onSubject, measured };
  }

  // Provenance: the caller EXTRACTED these rows rather than matching them (search-by-subject +
  // outlier proof gate), so there is no cosine to test and their absence is not a failure. This is
  // the paid "Find new outliers" path; assessing it topically marks it ungrounded.
  if (axis === "provenance") {
    return { warrant: "provenance", grounded: true, onSubject, measured };
  }

  const grounded = onSubject >= WARRANT_MIN_ROWS;
  return { warrant: grounded ? "topical" : "none", grounded, onSubject, measured };
}

/**
 * The subset a caller may carry into a CITED reference block — same rows minus the ones that only
 * cleared recall. A tangential row is legitimate for the model to read and discard, and illegitimate
 * to render under a "proven reference" header.
 *
 * Structural and provenance batches are citable whole: their warrant is curation / extraction, not
 * closeness, so there is no per-row cosine test to apply. A topical batch is filtered to the rows
 * that actually cleared the floor, and an ungrounded one yields nothing.
 */
export function citableSubset(warrant: Warrant, examples: RetrievedExample[]): RetrievedExample[] {
  if (warrant === "structural" || warrant === "provenance") return examples;
  if (warrant === "none") return [];
  const floor = warrantFloor();
  return examples.filter((e) => isMeasured(e) && (e.similarity as number) >= floor);
}

/** The instruction a model reads alongside the rows — the contract stated, not assumed. */
export function warrantNote(warrant: Warrant, onSubject: number, count: number): string {
  if (warrant === "topical") {
    return `${onSubject} of ${count} returned rows are close enough to the subject to cite as evidence about it. The rest are craft references only.`;
  }
  if (warrant === "structural") {
    return "These rows were selected for their STRUCTURE, not their subject. They are proven examples of the shape — cite them as patterns to borrow, never as evidence about this specific topic.";
  }
  if (warrant === "provenance") {
    return "These rows were gathered by searching this subject directly and each one cleared the above-baseline outlier check, so they are real proven examples. They carry no similarity score, so state them as real examples found for this topic — do not claim a measured degree of relevance.";
  }
  return "NOT GROUNDED: the corpus returned rows, but none are close enough to this subject to be evidence about it (cosine search always returns its nearest rows, even when nothing relevant exists). Do NOT present these as proof about the topic, and do not imply the corpus contains examples of it. Say plainly that you have no proven examples for this, then answer from craft knowledge if you can — labelled as such.";
}
