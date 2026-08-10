/**
 * checkable-judge.ts — C1 checkable-judge primitives (proposal §3.C1; measured 2026-08-10).
 *
 * The judge loop is: generate → run CHECKABLE checks → ONE consolidated revise call with every
 * rejection stated in the prompt (Stage A anchor-retry pattern: temp-0/seeded generation means an
 * UNCHANGED prompt reproduces the failure byte-for-byte) → re-check → honest degrade (script:
 * visible warning; hooks/ideas: drop the failing unit). The loop itself lives in each runner —
 * this module owns the primitives they share.
 *
 * Design constraint (load-bearing): the removed rubric critic failed ~100% of the time judging
 * TASTE (hooks-runner.ts S5 note). Everything here is either mechanical (slot regex, count,
 * anchor overlap) or a single BINARY question a model can check ("does this argue the OPPOSITE
 * of the ask?") — measured failure classes, never quality opinions:
 *
 *   - a Turn beat shipped VERBATIM prompt boilerplate with unfilled [slots] (compiled.ts's
 *     Gold-Standard Beat Templates, echoed whole — case 1 of the 08-10 script A/B)
 *   - the same script INVERTED the ask's thesis (ask "why founders should post daily" →
 *     output "posting daily is ruining your brand")
 *
 * Gated per skill by ENGINE_JUDGE_{HOOKS,IDEAS,SCRIPT}=true — OFF by default (the C0 flag
 * pattern): the thesis check costs one extra flash call per run, so it ships dark until the
 * A/B harness measures it. Judge OUTAGE fails OPEN (null → checks skipped, today's behavior):
 * a quality gate must never take generation down with it.
 */

import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";

// ─── Flags ────────────────────────────────────────────────────────────────────

export type JudgeSkill = "hooks" | "ideas" | "script";

/** Per-skill gate, mirrors the GROUNDING_*_ADAPT flag pattern (env, literal "true", default OFF). */
export function isJudgeEnabled(skill: JudgeSkill): boolean {
  return process.env[`ENGINE_JUDGE_${skill.toUpperCase()}`] === "true";
}

// ─── Unfilled-slot leak (mechanical) ─────────────────────────────────────────

/**
 * Bracketed template slots that leaked into SPOKEN content. The KC prompts mark every
 * fill-me-in slot as [bracketed diction] ("[the thing they predicted]"), and a spoken line
 * never legitimately contains one — the measured leak shipped two, verbatim, in a Turn beat.
 * Threshold: ≥3 inner chars including a letter, so stray "[3]" / "[ok]" noise never trips a
 * revise call. Returns the leaked segments (brackets included) for the revise prompt.
 */
export function findSlotLeaks(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\[[^\[\]\n]{3,}\]/g) ?? [];
  return matches.filter((m) => /[a-z]/i.test(m));
}

// ─── Ask-thesis inversion (binary, judged) ───────────────────────────────────

const JUDGE_TIMEOUT_MS = 60_000;

// ─── Revise prompt ───────────────────────────────────────────────────────────

/**
 * The consolidated revise prompt: the ORIGINAL user message plus every rejection stated.
 * Temp-0/seeded generation means an unchanged prompt would reproduce the failure
 * byte-for-byte (Stage A anchor-retry precedent) — the rejections ARE the change.
 * `constraint` restates an invariant the fix must not break (e.g. the anchor contract).
 */
export function buildRevisePrompt(
  userMessage: string,
  rejections: string[],
  constraint?: string,
): string {
  return (
    `${userMessage}\n\nREJECTED — your previous response failed these checks:\n` +
    rejections.map((r) => `- ${r}`).join("\n") +
    (constraint ? `\n${constraint}` : "") +
    `\nFix every issue and return the corrected response in the SAME JSON format.`
  );
}

/**
 * Did a unit argue the OPPOSITE of the thesis the ask requested? One flash call for the whole
 * batch, binary per unit — deliberately NARROW: a different angle, framing, or sub-topic that
 * still serves the ask must pass. Only the measured failure class (a direct inversion) fails.
 *
 * Returns one boolean per unit (missing verdicts default to NOT inverted — the model must
 * positively flag an inversion), or null when the judge is unavailable/unparseable (fail OPEN).
 */
export async function judgeThesisInversion(
  ask: string,
  units: string[],
): Promise<boolean[] | null> {
  if (units.length === 0) return [];

  const numbered = units.map((u, i) => `${i + 1}. ${u}`).join("\n");
  const system =
    `You are a mechanical output checker. A creator asked for content arguing a specific thesis; ` +
    `you check each generated unit for THESIS INVERSION only. A unit is inverted ONLY when its core ` +
    `claim directly argues the OPPOSITE of what the ask requested. A different angle, framing, ` +
    `tone, or sub-topic that still serves the ask is NOT inverted. When unsure, answer false. ` +
    `Respond with a single JSON object — no markdown, no prose. ` +
    `Shape: { "inverted": [boolean, ...] } — exactly one boolean per numbered unit, in order.`;
  const user = `The ask:\n${ask}\n\nThe units:\n${numbered}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
  try {
    const res = await getQwenClient().chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        seed: QWEN_SEED,
        enable_thinking: false, // DashScope extension — cast via `as never` below
        max_tokens: 300,        // verdict array only
      } as never,
      { signal: controller.signal },
    );
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { inverted?: unknown };
    if (!Array.isArray(parsed.inverted)) return null;
    const verdicts = parsed.inverted as unknown[];
    // Normalize to exactly one verdict per unit — a missing/malformed entry is NOT inverted
    // (the judge must positively flag; absence of a verdict is never a rejection).
    return units.map((_, i) => verdicts[i] === true);
  } catch {
    return null; // fail OPEN — a judge outage restores today's unjudged behavior
  } finally {
    clearTimeout(timer);
  }
}
