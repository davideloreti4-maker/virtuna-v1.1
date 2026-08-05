import OpenAI from "openai";

const DASHSCOPE_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

let client: OpenAI | null = null;

export function getQwenClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error("Missing DASHSCOPE_API_KEY environment variable");
    // maxRetries:0 — every engine stage owns its own retry loop (+ circuit breaker on
    // deepseek). The SDK default (2) stacks on top of those manual loops → up to 6 HTTP
    // attempts on a single Omni call. Make the app the sole retry authority: predictable
    // latency tail + cost. (Audit A2.)
    client = new OpenAI({ apiKey, baseURL: DASHSCOPE_ENDPOINT, maxRetries: 0 });
  }
  return client;
}

/**
 * Fixed sampling seed for all scoring-critical LLM calls, paired with `temperature: 0`.
 * Together these make the engine reproducible: the same input yields the same score
 * run-to-run. This is the precondition for a trustworthy eval/weight-fit number — you
 * cannot separate model error from run-to-run sampling jitter if the scorer drifts
 * between runs. Greedy decoding (temp 0) is the primary lever; the seed pins any residual
 * nondeterminism (notably thinking-mode stages).
 */
export const QWEN_SEED = 7;

// Model ID constants — env-overridable, defaults to the agreed stack.
// Default flipped plus→flash 2026-06-06 (quick/20260605-engine-latency-quality-spine-ab):
// A/B-validated on 2 videos (easy + hard) — omni-flash HALVED the read (36→17s), held/
// improved the text substrate (richer verbatim, emotion_arc intact, correct flop detection
// on the weak-hook case) at ~5× lower GA cost. omni is the foundation the fold + Apollo
// both reason over → highest-leverage latency lever. Rollback: QWEN_OMNI_MODEL=qwen3.5-omni-plus.
export const QWEN_OMNI_MODEL      = process.env.QWEN_OMNI_MODEL      ?? "qwen3.5-omni-flash";
// Shared reasoning model (chat / decode / adapt / text-mode / fold / vision).
// Default 3.7-plus -> 3.7-FLASH 2026-08-04 (owner call): 3.7-flash is the same generation,
// accepts text + image + VIDEO (so every sighted call site keeps its capability), carries 1M
// context, and costs $0.03/$0.13 per M at ≤32K input against plus's $0.40/$1.60 — an order of
// magnitude. The audio boundary is unchanged and is the whole reason omni stays: 3.7-flash is
// DEAF, exactly like 3.7-plus was, so audio still enters only through QWEN_OMNI_MODEL above.
// ⚠️ The retired-flash note that used to sit here was about qwen3.6-FLASH, a previous
// generation: it was dropped in 2026-06-25 because plus held multi-output reactions (SIM
// candidates, fold personas) far more distinct. That risk does not transfer automatically to a
// newer model, but it is the thing to watch — the fold's diversity-collapse retry
// (FOLD_DIVERSITY_RETRY_TEMP) is the tripwire. Rollback: QWEN_REASONING_MODEL=qwen3.7-plus.
export const QWEN_REASONING_MODEL = process.env.QWEN_REASONING_MODEL ?? "qwen3.7-flash";
// The platform runs on two models plus ONE scoped holdout (QWEN_UNBOUND_CHAT_MODEL, at the foot
// of this block, on 3.7-plus on live evidence): QWEN_OMNI_MODEL (the Wave 0 / audience-bake AUDIO
// sensor) + QWEN_REASONING_MODEL (everything else — text and video). See docs/MODEL-POLICY.md.
// Apollo and CALIBRATE were holdouts too until 2026-08-04 (#431) — see each of them below.
// Apollo reasoner model (the score-mode judge in deepseek.ts) — SCOPED separately from
// QWEN_REASONING_MODEL so Apollo can move independently of chat/decode/adapt/text-mode.
// ✅ Apollo IS ON 3.7-FLASH as of 2026-08-04 (#431) — the holdout was RETIRED by fixing our own
// prompt, not by giving up on the model. Read the history below before touching this line; the
// comment here said "STAYS ON 3.7-PLUS" for a while after the value had already flipped, which is
// exactly the kind of drift that makes someone rule the model out as a variable.
//
// The holdout, and why it ended:
//   Flash first measured at composite 53 with cites NONE, against plus at 81 with
//   [§2.1 §2.2 §2.3 §2.5] (`scripts/apollo-cite-harness.ts`, same video, same prompt). The cause
//   was OUR contract, not the model: it said to cite "ONLY inside the auditable fields" — a rule
//   about WHERE cites may go, which plus read as an instruction to cite and flash read as
//   permission not to. The § token is now required explicitly and ENFORCED (fewer than 4 of 6
//   cited `lever`s triggers a cite-specific retry; exhausting it logs an error + Sentry rather
//   than shipping an uncited read as the framework-grounded product). Re-measured on flash:
//   cites [§2.1 §2.2 §2.3 §2.5], 6/6 dimensions, identical to plus — and flash is the
//   DETERMINISTIC one (49/49 across runs where plus swings 52→80 on its own seed).
//
// ⚠️ ACCEPTED BEHAVIOUR CHANGE, not a silent one: flash grades ~30 composite points HARSHER,
// landing the hook band one step below plus where hook is ~80% of the composite (§2.0a),
// reproduced on a second clip (82 vs 53). Stricter rather than wrong — but it moves a number
// users see, and the owner took that call explicitly. Rollback: QWEN_APOLLO_MODEL=qwen3.7-plus.
// Deaf on both, so none of this is about capability.
export const QWEN_APOLLO_MODEL    = process.env.QWEN_APOLLO_MODEL    ?? "qwen3.7-flash";
// CALIBRATE synth model (audience/enrich-signature) — SCOPED separately for the same reason
// Apollo is: it can be held back without pinning the rest of the platform.
// ✅ CALIBRATE IS ON 3.7-FLASH as of 2026-08-04 (#431) — holdout retired by repairing transport,
// same as Apollo. (This comment also read "STAYS ON 3.7-PLUS" after the value flipped.)
//
// The holdout, and why it ended. Flash first scored 0/7 against plus's 3/3
// (`scripts/calibrate-synth-harness.ts`, real 32-post @zachking payload, byte-identical input),
// breaking the two HARD invariants in SynthSchema:
//   1. persona shares must sum to 1.0 (±0.02) — flash emitted 0.75-0.85 in all 7 runs. Repaired
//      by `normalize-shares.ts` inside SynthSchema (a 0.5–1.5 guard band).
//   2. in 2 of 7 runs it FLATTENED the shape, putting `personas`/`persona_weights` at the top
//      level instead of under `audience` — complete and correct, just unnested, which Zod saw as
//      undefined. Repaired by `liftFlattenedAudience()`: pure transport, a no-op on a correct
//      response.
// Both calls also gained a RETRY they never had. `defaultSynthesize` was single-shot, so any
// malformed response threw to calibration.ts and became `{ error: "scrape_failed" }` AFTER the
// Apify scrape was already paid for — blaming the scrape for a synthesis failure. That was real
// fragility on plus too; it just bit far more often on flash.
// Re-measured on flash: 3/3, ~12× cheaper, ~2× faster, persona quality unchanged (10/10 distinct
// creator-specific names, 0 archetype echoes, 0/8 flat axes).
// Note this was never the Apollo failure mode: CALIBRATE runs thinking OFF
// (enrich-signature.ts:391, D-01). Rollback: QWEN_CALIBRATE_MODEL=qwen3.7-plus.
export const QWEN_CALIBRATE_MODEL = process.env.QWEN_CALIBRATE_MODEL ?? "qwen3.7-flash";
// UNBOUND-CHAT model (an anonymous /go visitor's chat turn) — the THIRD holdout, and the third
// time the same lesson has been paid for: a cheaper model can pass every harness the swap thought
// to run and fail the one it did not.
//
// ⚠️ THE UNBOUND CHAT PATH STAYS ON 3.7-PLUS. `FREE_SKILL_TOOLS` is empty, so an anonymous visitor
// binds NO generators and the agent must refuse to produce the artefact. Measured live through the
// real `/api/tools/chat` route with `scripts/live-chat-anon.mjs`, same build, same guard, same six
// asks — the ONLY variable is this model.
//
// RE-MEASURED 2026-08-05, both arms back to back on this build, when the flip was asked for again:
//     plus : 6/6 refused · 1/6 leaked
//     flash: 6/6 refused · 6/6 LEAKED
// Flash is now leaking on EVERY ask, not 5 of 6 — it opens with a correct refusal sentence
// ("I can't write the hook for you because I don't have a content-generation tool on this
// account") and then writes the pack anyway as a numbered list of concepts, mechanisms, formats
// and CTAs. `createArtefactGuard` is visibly firing inside those lists — the redaction
// "[a line like that needs an account with credits]" appears mid-item — and the visitor still
// leaves with a usable content pack, because the guard redacts the QUOTED candidate line while the
// structure around it carries the value. Defence in depth is working and is not sufficient.
//
// Note plus is 1/6, not the 0/6 recorded previously: there is a residual leak on BOTH arms and the
// guard has a real gap. That is a reason to fix the guard, not a reason to call the arms equal —
// 1/6 against 6/6 on identical input is a 6× difference and the model is the whole of it.
// Flash opens with a correct refusal sentence and then writes the pack anyway, as a numbered list
// of ideas/angles. That is the paid product handed to an anonymous visitor through the one door
// that is free by design, which makes it a revenue leak, not a tone regression.
//
// #426 measured chat dispatch on flash and found it identical to plus — but only on the SIGNED-IN
// path, where the generators ARE bound and the model's job is to call one. The unbound path is a
// different job (refuse, and hold the line under pressure) and was never harnessed.
//
// Deliberately scoped to the UNBOUND path only, not to chat as a whole: signed-in chat is the
// volume, it stays on flash, and the cost win survives almost intact. Scope the exception rather
// than abandon the change — the same move that let Apollo and CALIBRATE be held without pinning
// the platform. `createArtefactGuard` still runs underneath as defence in depth; it redacts QUOTED
// candidate lines, which is why flash's unquoted numbered lists walked straight past it.
// Rollback FORWARD (re-try flash) only behind a fresh `live-chat-anon.mjs` run.
export const QWEN_UNBOUND_CHAT_MODEL = process.env.QWEN_UNBOUND_CHAT_MODEL ?? "qwen3.7-plus";
