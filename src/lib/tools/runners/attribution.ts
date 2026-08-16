/**
 * attribution.ts — the proof decision, made observable.
 *
 * hooks-runner's receipt logic was one ternary: when a receipt vanished you could not tell
 * whether the model declined to cite (honest original) or a guard stripped the claim. This
 * factors the SAME decision — order and semantics byte-identical to the ternary it replaces —
 * into named reasons, so a run can log why each card kept or lost its receipt.
 *
 * Guard order is load-bearing: admit() increments the per-source counter, so it must stay the
 * LAST check — a citation stripped by an earlier guard must not consume a diversity slot.
 */
import type { RetrievedExample } from "@/lib/grounding/types";
import type { HookProof } from "@/lib/tools/proof-schema";
import { buildProofFromSource } from "./build-proof";
import { templateInstantiated } from "./output-guards";

export type StripReason =
  | "kept"
  | "model-zero" // the model cited no source (sourceIndex 0) — an honest original
  | "invalid-index" // cited beyond every example the run ever had — phantom citation
  | "no-handle" // shown example has no handle — nothing honest to attribute
  | "trimmed-from-bundle" // cited example was truncated out of the assembled prompt
  | "lexical-mismatch" // raw path: the line does not instantiate the cited madlib
  | "diversity-capped"; // source already cited MAX_CITATIONS_PER_SOURCE times this run

export interface AttributionDecision {
  proof: HookProof | null;
  /** The cited example (when resolvable) — for instrumentation, even on strips. */
  example: RetrievedExample | null;
  reason: StripReason;
}

export function resolveAttribution(args: {
  sourceIndex: number;
  /** Examples that SURVIVED bundle assembly (trimExamplesToBundle output). */
  shownExamples: RetrievedExample[];
  /** The runner's full mapping array, pre-trim — distinguishes trimmed from phantom. */
  allExamples: RetrievedExample[];
  line: string;
  adapted: boolean;
  admit: (key: string | null | undefined) => boolean;
}): AttributionDecision {
  const { sourceIndex, shownExamples, allExamples, line, adapted, admit } = args;
  if (!Number.isInteger(sourceIndex) || sourceIndex < 1) {
    return { proof: null, example: null, reason: "model-zero" };
  }
  const example = shownExamples[sourceIndex - 1] ?? null;
  const rawProof = buildProofFromSource(sourceIndex, shownExamples);
  if (!rawProof) {
    if (example) return { proof: null, example, reason: "no-handle" };
    if (sourceIndex <= allExamples.length) {
      return {
        proof: null,
        example: allExamples[sourceIndex - 1] ?? null,
        reason: "trimmed-from-bundle",
      };
    }
    return { proof: null, example: null, reason: "invalid-index" };
  }
  if (!adapted && !templateInstantiated(rawProof.hookTemplate, line)) {
    return { proof: null, example, reason: "lexical-mismatch" };
  }
  if (!admit(rawProof.videoUrl ?? rawProof.handle)) {
    return { proof: null, example, reason: "diversity-capped" };
  }
  return { proof: rawProof, example, reason: "kept" };
}
