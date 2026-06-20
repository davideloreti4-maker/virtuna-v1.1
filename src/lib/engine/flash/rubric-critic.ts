/**
 * SIM-1 Flash — Rubric-critic (Plan 14-02 Task 1).
 *
 * The INDEPENDENT JUDGE (D-08) that executes the BASE Value Bar at RUNTIME, not
 * just at authoring time. One bounded Qwen json_object call per candidate, run in
 * PARALLEL alongside the SIM band call (D-05 — wall-clock stays ~1x), returning:
 *
 *   { pass: boolean, predictedFailureMode: string | null }
 *
 * The rubric encodes the corpus BASE Value Bar (base.md:275-303):
 *   - Test A — Named Mechanism: a specific WHY-mechanism, not "interesting".
 *   - Test B — Concrete Instantiation: a non-fakeable concrete (number / named
 *     tool / precise moment / metric); fails if swapping the niche name is the
 *     only edit required (find-and-replace test).
 *   - Test C — Fit: grounded in something true about this creator/niche; cold-start
 *     honest baselines are acceptable, fabricated fit is not.
 * plus Prohibition 6 (base.md:260-272) — the "obvious list" trope test: reject the
 *   done-to-death tropes a competent insider would produce on autopilot.
 *
 * `predictedFailureMode` is the KCQ-04 shared-call flop pass (RESEARCH Pattern 3):
 *   the "if this flops for this audience, here's why" texture — null on pass,
 *   a one-line reason on fail. ONE call, two uses (cheapest per owner instinct).
 *
 * HARD ISOLATION (Pitfall #2 — mirrors run-flash-text-mode.ts:8-13):
 * This module imports ONLY from:
 *   - qwen/client.ts (getQwenClient, QWEN_SEED, QWEN_FAST_MODEL)
 *   - utils/strip (stripModelOutput)
 *   - flash-prompts.ts (NichePanel + FlashFraming TYPES only — niche/framing context)
 * It MUST NOT import pipeline.ts, aggregator.ts, version.ts, or any wave3/fold*.ts
 * or persona-registry internals — keeps the SIM-1 Max video path byte-stable.
 *
 * Call envelope mirrors runFlashTextMode:
 *   getQwenClient + AbortController + temperature:0 + seed:QWEN_SEED +
 *   response_format:json_object + stripModelOutput → JSON.parse → coerce.
 *
 * FAIL-SAFE (D-08 resilience): on transport / parse / shape error the critic
 *   RESOLVES to a fail-safe verdict ({ pass: false, ... }) — it NEVER throws into
 *   the runner's Promise.all, mirroring runFlashTextMode(...).catch(() => null).
 *   A judge that can't judge does not silently pass slop; it abstains as a fail.
 */

import { getQwenClient, QWEN_SEED, QWEN_FAST_MODEL } from "../qwen/client";
import { stripModelOutput } from "../utils/strip";
import type { NichePanel, FlashFraming } from "./flash-prompts";

// ─── Model resolution (mirrors run-flash-text-mode.ts FLASH_MODEL seam) ──────
const FLASH_MODEL = process.env.FLASH_MODEL ?? QWEN_FAST_MODEL;

// ─── Timeout (mirrors run-flash-text-mode PER_CALL_TIMEOUT_MS) ───────────────
const PER_CALL_TIMEOUT_MS = 60_000;

// ─── RubricVerdict ───────────────────────────────────────────────────────────

/**
 * The critic's verdict for a single candidate (RESEARCH Code Examples shape).
 *  - pass: Test A + B + C + Prohibition 6 all clear.
 *  - predictedFailureMode: KCQ-04 — the "if this flops, here's why" one-liner;
 *    null when the candidate passes cleanly, a non-empty reason when it fails.
 *  - abstained: WR-01 — true ONLY when the judge could not run at all (transport /
 *    timeout / unparseable output), i.e. an INFRA failure, NOT a quality verdict.
 *    The runner uses this to distinguish "the model judged this a fail" (drop) from
 *    "the critic was unavailable" (degrade to band-only + warn, never silently zero
 *    a SIM-Strong thread). Absent/false on every genuine model verdict.
 */
export interface RubricVerdict {
  pass: boolean;
  predictedFailureMode: string | null;
  abstained?: boolean;
}

/**
 * Genuine strict-fail verdict — a real (non-abstained) judgment that the item does
 * not clear the bar. Used when the model returned parseable output that isn't an
 * unambiguous pass. The runner hard-drops these.
 */
const FAIL_SAFE: RubricVerdict = { pass: false, predictedFailureMode: null };

/**
 * Abstention verdict (WR-01) — the judge could not run (transport / timeout /
 * unparseable). pass:false so slop is never silently passed, but abstained:true
 * tells the runner to degrade to the SIM band-only gate and surface a warning
 * instead of hard-dropping an otherwise-Strong candidate. An outage degrades
 * quality gracefully; it does not zero the thread with no diagnostic.
 */
const ABSTAINED: RubricVerdict = { pass: false, predictedFailureMode: null, abstained: true };

// ─── System prompt (the BASE Value Bar as a runtime critic) ──────────────────
// Byte-stable string — encodes base.md:260-303 verbatim-in-spirit (D-04: Claude's
// discretion on wording). NEVER interpolates per-request volatile data (D-17 cache
// discipline) — the candidate + niche/framing live in the user message.

const RUBRIC_SYSTEM_PROMPT = `You are a strict editorial critic judging ONE candidate creator-content item against the Value Bar. You are an INDEPENDENT judge: your only job is to say whether this item clears the bar, and if not, the single most likely reason it will flop for this audience.

Apply ALL FOUR tests. The item passes ONLY if it clears every one.

Test A — Named Mechanism
The item carries a SPECIFIC mechanism name that answers WHY it works, not WHAT it is. "Curiosity gap", "open loop", "pattern interrupt" are named mechanisms. "Interesting", "engaging", "valuable" are not. If the mechanism cannot be named concretely, the item is generic → FAIL.

Test B — Concrete Instantiation (non-fakeable)
The item contains at least one non-fakeable concrete: a specific number, a named tool or platform mechanic, a precise moment, a real metric, or a documented detail — not just adjectives. The find-and-replace test: if swapping the niche name is the only edit required to move this item to a different creator in a different niche, it FAILS Test B. ("Optimize your hook" fails; "cut the first 0.8s of dead air before the title card" passes.)

Test C — Fit to this creator
The item is grounded in something true about this creator's niche/audience. In cold-start (thin profile) honest platform baselines are acceptable; FABRICATED creator-specificity is not. Inserting the niche name into an otherwise generic template is NOT fit — it is a find-and-replace → FAIL.

Prohibition 6 — No predictable-for-the-niche output (the "obvious list" check)
Ask: "would this appear on anyone's first list of ideas for this niche?" If yes, it is the done-to-death trope a competent insider produces on autopilot (e.g. for finance: the skip-your-coffee tip, the crypto-bro skit, the compound-interest chart). Niche-relevant yet generic tropes → FAIL.

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose:
{ "pass": boolean, "predictedFailureMode": string | null }

- "pass": true ONLY if all four tests clear.
- "predictedFailureMode": when pass is false, ONE short first-person-of-the-audience sentence naming the single most likely reason this flops for this audience ("if this flops, here's why"). When pass is true, set it to null.`;

// ─── User content builder (volatile per-request tier — D-17) ─────────────────

function buildCriticUserContent(
  item: string,
  framing: FlashFraming,
  panel: NichePanel,
): string {
  const framingLabel =
    framing === "hook"
      ? "a HOOK (the first-2s scroll-stop line of a short video)"
      : framing === "idea"
        ? "a CONTENT IDEA (the concept a video would be built from)"
        : "a conversational recommendation";

  const nicheLine = panel.niche
    ? `Creator niche: ${panel.niche}.`
    : "Creator niche: general (cold-start — honest platform baselines are acceptable, fabricated fit is not).";

  return [
    "## Candidate to Judge",
    `This item is ${framingLabel}.`,
    nicheLine,
    "",
    "Item:",
    item || "(no item provided)",
    "",
    "## Your Task",
    "Apply Test A + Test B + Test C + Prohibition 6. Return the JSON verdict only.",
  ].join("\n");
}

// ─── Verdict coercion ────────────────────────────────────────────────────────
// Salvages small-model shape sloppiness without fabricating a pass. Anything that
// is not an unambiguous pass:true is treated as a fail (the judge errs strict).

function coerceVerdict(raw: unknown): RubricVerdict {
  if (!raw || typeof raw !== "object") return FAIL_SAFE;
  const r = raw as Record<string, unknown>;

  // pass: accept boolean true, or the strings "true"/"pass" (small-model variance).
  const pass =
    r.pass === true ||
    (typeof r.pass === "string" && ["true", "pass", "yes"].includes(r.pass.toLowerCase().trim()));

  // predictedFailureMode: a non-empty string when present, else null.
  let predictedFailureMode: string | null = null;
  if (typeof r.predictedFailureMode === "string" && r.predictedFailureMode.trim().length > 0) {
    predictedFailureMode = r.predictedFailureMode.trim();
  }

  // Honesty invariant: a passing item carries NO failure mode; a failing item
  // should carry one (but a missing reason still fails — never upgrade to pass).
  if (pass) {
    return { pass: true, predictedFailureMode: null };
  }
  return { pass: false, predictedFailureMode };
}

// ─── critiqueAgainstRubric ───────────────────────────────────────────────────

/**
 * Judge ONE candidate against the BASE Value Bar via a single bounded Flash
 * json_object call. Runs in PARALLEL with the SIM band call in the runner's
 * Promise.all (D-05 — never serial).
 *
 * @param item    The candidate text to judge (idea seedHook / hook seedHook|hookLine).
 * @param framing "idea" | "hook" | "chat" — frames the critic question (D-04).
 * @param panel   The resolved niche panel (from resolveNicheKey, 14-01) — supplies
 *                niche context for Test C / Prohibition 6. niche:null → generic path.
 * @returns A RubricVerdict. NEVER rejects — on any error resolves to FAIL_SAFE.
 */
export async function critiqueAgainstRubric(
  item: string,
  framing: FlashFraming,
  panel: NichePanel,
): Promise<RubricVerdict> {
  try {
    const ai = getQwenClient();

    const callParams = {
      model: FLASH_MODEL,
      messages: [
        { role: "system" as const, content: RUBRIC_SYSTEM_PROMPT },
        { role: "user" as const, content: buildCriticUserContent(item, framing, panel) },
      ],
      response_format: { type: "json_object" as const },
    };

    // @ts-expect-error — temperature:0 + seed = reproducible verdict (R8, mirrors run-flash-text-mode)
    callParams.temperature = 0;
    // @ts-expect-error — seed pins residual nondeterminism (R8)
    callParams.seed = QWEN_SEED;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

    let response;
    try {
      response = await ai.chat.completions.create(callParams as never, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const rawText = response.choices[0]?.message?.content ?? "{}";
    const text = stripModelOutput(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Unparseable model output → the judge could not produce a verdict: ABSTAIN
      // (pass:false, abstained:true), so the runner degrades to band-only rather
      // than silently dropping the candidate (WR-01). Never silently passes slop.
      return ABSTAINED;
    }

    return coerceVerdict(parsed);
  } catch {
    // Transport / timeout / any unexpected error → ABSTAIN, never throw (D-08).
    // abstained:true so a critic outage degrades gracefully (band-only) instead of
    // zeroing a SIM-Strong thread with no diagnostic (WR-01).
    return ABSTAINED;
  }
}
