/**
 * reasoning-leak.ts — the model's planning voice is not an answer. Drop it at assembly.
 *
 * ─── THE DEFECT ──────────────────────────────────────────────────────────────────────────────
 *
 * `enable_thinking: composing` (1050d7a9) buys real quality — flash went 2/6, 3/6, 4/6 composing
 * without it to 6/6, 5/6 with. Its comment then asserts the safety property:
 *
 *     "Reasoning arrives as `delta.reasoning_content`, which this loop never reads — only
 *      `delta.content` reaches `onToken`. That is what keeps the thinking out of the creator's
 *      stream, and it is asserted live in scripts/probe-thinking-stream.ts."
 *
 * The first half is true most of the time. It is not true always, and three production rows are
 * the counter-example (thread b13d63f4, 2026-08-12, one ask asked four times):
 *
 *     249848cb   33,165 chars   pure monologue, no answer at all, no tag (burned the token budget)
 *     291591a8   20,742 chars   monologue + a literal `</think>` + the real closing line
 *     ae09c4df   18,484 chars   monologue + the emit_card JSON in a fence + a closing question
 *
 * `chat-agent-loop.ts:1178` only ever accumulates `delta.content`, so that text came through the
 * CONTENT channel. The orphaned `</think>` — a closing tag with no opening one, persisted as the
 * creator's answer — is the proof, and it is why the probe's verdict was not wrong so much as
 * incomplete: it measured a shape the provider gets right.
 *
 * ─── WHY A GUARD AND NOT A PROMPT OR A FLAG ──────────────────────────────────────────────────
 *
 * This is known provider behaviour in this codebase already: `engine/utils/strip.ts` exists because
 * Qwen thinking-mode emits `<think>…</think>` inside `content`, and every JSON call site
 * (`fold.ts`, `adapt.ts`, `run-predict-panel.ts`, `run-flash-text-mode.ts`) strips it before
 * parsing. The one path that streams to a HUMAN never did.
 *
 * ⚠️ It is NOT `stripModelOutput`, deliberately. That helper also strips markdown code fences,
 * which is right for a JSON payload and wrong for chat: a creator answer legitimately contains
 * fenced code and would be silently mangled.
 *
 * ⚠️ MEASURED 2026-08-16, 0 of 21 live runs reproduced it
 * (`scripts/probe-thinking-content-channel.ts`): bare calls, tools bound, the shipped 25,268-char
 * prompt, and that prompt with thread history and cards on screen. Neither tools nor prompt size
 * nor thread depth is the variable — production saw 3 of 4 identical asks leak on one day and 0 of
 * 6 the next. The trigger is provider-side and cannot be summoned, which is exactly why the remedy
 * is a boundary guard rather than a prompt change: there is nothing to A/B.
 *
 * Pure, no I/O, no LLM. Deterministic.
 */

/**
 * Remove any thinking block that reached the creator-facing text.
 *
 * Three shapes, because all three are attested and only the first is well-formed:
 *
 *   1. `<think>…</think>`  — the paired shape `engine/utils/strip.ts` has always handled.
 *   2. `…</think>` alone   — an ORPHANED CLOSE, which is what row 291591a8 actually persisted.
 *      Everything up to and including the LAST one is deliberation; the tail is the answer.
 *   3. `<think>…`  alone   — an orphaned OPEN: the model started thinking and never came back
 *      (the token ceiling arrived first), so everything from the tag on is deliberation.
 *
 * Returns the input BYTE-IDENTICAL when no tag is present — the overwhelmingly common case — so a
 * normal answer is never even trimmed. That matters: trailing whitespace is part of what the
 * creator was shown, and this must not quietly rewrite healthy turns.
 */
export function stripLeakedReasoning(text: string): string {
  // Fast path AND a correctness guarantee: an untagged answer is returned untouched.
  if (!text.includes("think>")) return text;

  let out = text.replace(/<think>[\s\S]*?<\/think>/g, "");

  // Whatever closing tag survives the pair-strip is orphaned. Take the LAST — nested or repeated
  // deliberation should all fall, and only the text after the final one can be the answer.
  const lastClose = out.lastIndexOf("</think>");
  if (lastClose !== -1) out = out.slice(lastClose + "</think>".length);

  // …and a surviving OPEN tag means the thinking never terminated. Nothing after it is answer.
  const firstOpen = out.indexOf("<think>");
  if (firstOpen !== -1) out = out.slice(0, firstOpen);

  return out.trim();
}

/**
 * The ceiling for a turn that delivered NO cards.
 *
 * 🔴 This is NOT the prose cap the lane forbids. Capping a search-and-answer turn is the one thing
 * the audit rules out — 25 of 34 over-cap no-card turns are legitimate comparison writing whose
 * long prose IS the answer, and they are pinned by a test. This sits far above them.
 *
 * Measured against the whole production `messages` table: the largest legitimate answer ever
 * persisted is 3,791 chars. The smallest leak is 18,484. Nothing at all lives in between, so a
 * ceiling in that gap separates the two populations without touching the real one. 8,000 is a
 * little over 2× the largest real answer and a little under half the smallest leak.
 */
export const RUNAWAY_PROSE_CAP = 8_000;

/**
 * Drop runaway prose WHOLE rather than truncating it.
 *
 * The same ruling F-1 reached for post-card text: `POST_TOOL_TEXT_CAP` only ever truncates, which
 * its own docstring concedes hands the creator 600 chars cut mid-sentence instead of nothing. Text
 * this far over budget is not an answer with a long tail — it is deliberation — and half of it is
 * not better than none.
 *
 * Applied AFTER `stripLeakedReasoning`, never before: row 291591a8 is 20,742 chars of monologue
 * wrapped around a perfectly good 47-char closing line. Stripping first saves that line; capping
 * first would throw it away with the noise.
 */
export function capRunawayProse(text: string): string {
  return text.length > RUNAWAY_PROSE_CAP ? "" : text;
}
