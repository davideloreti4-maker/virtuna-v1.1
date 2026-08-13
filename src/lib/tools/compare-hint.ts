/**
 * compare-hint.ts — a comparison ask never says "structure", so the model never sees its own trigger.
 *
 * ─── THE MEASUREMENT ─────────────────────────────────────────────────────────────────────────
 *
 * 2026-08-13, prod build, `COMPOSED_CARDS=true`, signed in, isolated threads, main @ `e70dc603`.
 * The three comparison asks from `probe-composed-card-rate.ts`, n=18 per arm:
 *
 *     the creator's words, unchanged     1/18 ·  5.6%
 *     + " — lay out the structure side by side."   15/18 · 83.3%   (5/6 · 5/6 · 5/6)
 *
 * **Fifteenfold, and uniform across all three asks.** The `comparison` recipe was never the
 * problem: it exists, it renders (screenshotted in a real thread 2026-08-12), and it requires no
 * corpus proof (`requiredSlots: ["comparison"]`). The model simply answered in prose.
 *
 * ─── WHY IT WORKS, AND WHY THE WORDING IS NOT ARBITRARY ──────────────────────────────────────
 *
 * The composed-card directive fires on **"when the answer has structure"** (`chat-agent-loop.ts`,
 * `composeLine`). In the same clean run, the ONE ask that carries a structural cue in the
 * creator's own words — *"explain the STRUCTURE of a story-time video, START TO FINISH"* — cards
 * **6/6**, while every comparison cards 0–1/6. The directive is not being refused; it is not being
 * recognised. This supplies the evidence of shape that is MISSING, exactly as `count-hint.ts`
 * supplies the evidence of intent a count carries.
 *
 * ⚠️ The directive ALSO already says "Do NOT answer with markdown: no `##` headings, no bold
 * section labels". Measured output for a failing ask was a markdown essay with `###` headings and
 * bold labels — i.e. the model produced verbatim the thing the sentence forbids. **Prompt wording
 * is not the lever here** (four recorded failures of untested wording in this lane, session 10
 * §5.1); the ask is.
 *
 * ⚠️ It appends the EXACT string the measurement used. A differently-phrased cue is a different
 * stimulus and needs its own runs — the same warning `count-hint.ts` carries.
 *
 * ─── WHAT IT MAY AND MAY NOT TOUCH ───────────────────────────────────────────────────────────
 *
 * Only the assembled bundle — the text the MODEL reads. `currentAsk` stays the creator's real
 * words, because it feeds the conversation digest and the persisted transcript; the app must never
 * quote back words the creator did not type.
 *
 * It forces nothing. No `tool_choice`, no pin, no billed run — the model still decides, so the
 * worst case is the prose answer production already serves today.
 *
 * SCOPED TO COMPOSED CARDS at the call site: with `COMPOSED_CARDS` off there is no `emit_card` to
 * reach, and rewriting asks to steer a tool that is not bound would change prose for no benefit.
 *
 * Pure, no I/O, no LLM. Deterministic.
 */

import { guessSkill } from "@/lib/tools/pre-router";

/**
 * Server flag — default-ON with the house `!== "false"` kill switch, so a half-set flag stays ON.
 * Inert in production today regardless: the call site also requires `COMPOSED_CARDS`.
 */
export function isCompareHintEnabled(): boolean {
  return process.env.ENGINE_COMPARE_HINT !== "false";
}

/** The exact cue the 15/18 measurement used. Do not reword without re-running the arms. */
export const COMPARE_HINT = " — lay out the structure side by side.";

/**
 * The ask already announces shape, so the directive's trigger is already visible. "structure" is
 * the word the directive itself uses; the rest are the phrasings that carried 6/6 in the same run.
 */
const STRUCTURE_PRESENT =
  /\b(structure|structured|side by side|step by step|start to finish|break ?down)\b/i;

/**
 * Comparison shape. `\bvs\b` is word-bounded so "cvs" cannot fire it. Deliberately narrow: this
 * reads the creator's WORDS, and a broad match would rewrite asks that were answering fine.
 */
const COMPARISON_SHAPE =
  /(\bvs\.?\b|\bversus\b|\bcompared? to\b|\bcompare\b|\bcomparison\b|\bwhich (?:one )?(?:works|holds|performs|lands|converts|does|is)\b)/i;

/**
 * Give the model the evidence of SHAPE a structural word carries — or return the ask untouched.
 *
 * @param rawAsk The creator's typed message.
 * @returns the text to assemble into the BUNDLE. Never what the creator sees.
 *
 * Untouched when the ask is a generation request (that is `count-hint.ts`'s territory and a
 * generator outranks a card by the directive's own "This never replaces a generator"), when it
 * already announces structure, or when it carries no comparison shape at all.
 */
export function addCompareHint(rawAsk: string): string {
  if (guessSkill(rawAsk)) return rawAsk;
  if (STRUCTURE_PRESENT.test(rawAsk)) return rawAsk;
  if (!COMPARISON_SHAPE.test(rawAsk)) return rawAsk;
  return `${rawAsk}${COMPARE_HINT}`;
}
