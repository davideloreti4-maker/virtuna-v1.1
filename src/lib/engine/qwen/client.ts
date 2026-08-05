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
// The platform runs on TWO models and, as of 2026-08-05, ZERO holdouts: QWEN_OMNI_MODEL (the
// Wave 0 / audience-bake AUDIO sensor — a different family because 3.7 is deaf) and
// QWEN_REASONING_MODEL (everything else — text and video). See docs/MODEL-POLICY.md.
// The three scoped constants below (APOLLO, CALIBRATE, UNBOUND_CHAT) all resolve to flash now.
// They are KEPT as separate constants, not collapsed: each one is the seam that let its path be
// held back and released independently, and each was retired by fixing OUR layer — Apollo's cite
// contract and CALIBRATE's transport in #431, the artefact guard's structure blindness in #438's
// follow-up. Keeping the seam costs nothing and is what makes the next holdout cheap.
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
// ✅ THE HOLDOUT IS RETIRED (2026-08-05). This path is on flash, and the property it was protecting
// is now owned by `createArtefactGuard` in chat-agent-loop.ts — by CONSTRUCTION rather than by
// which model we happen to be paying for. `FREE_SKILL_TOOLS` is empty, so an anonymous visitor
// binds NO generators and the agent must refuse to produce the artefact.
//
// The holdout existed because flash "refused" and then wrote the pack anyway. That was real, and it
// was re-confirmed at 6/6 the day this flipped. But the diagnosis was wrong: the model was not the
// cause, it was the last thing standing between a GAP IN THE GUARD and the customer. The guard was
// quote-scoped — it redacted a quoted candidate line — while the pack arrives as STRUCTURE, an
// enumerated list of content units carrying no quotation marks at all. Plus simply hit that gap
// less often. Extending the guard to judge enumerated spans the same way it judges quoted ones
// closed it on BOTH arms.
//
// Measured live through the real `/api/tools/chat` with `scripts/live-chat-anon.mjs`, the model the
// only variable, the guard fix the only other change:
//     flash · quote-only guard  : 6/6 refused · 6/6 LEAKED   (every one a real enumerated pack)
//     flash · + structure guard : 6/6 refused · 0/6 leaked   ×3 runs
//     plus  · + structure guard : 6/6 refused · 0/6 leaked   ×2 runs
//
// ⚠️ The gate that governs this line is unchanged and still binds: move it only behind a fresh
// `live-chat-anon.mjs` showing 6/6 refused and 0 leaked. What changed is that flash now PASSES it.
// If the guard is ever weakened, this constant is not the safety net — re-run the harness.
//
// 🔑 A model holdout is a MITIGATION; it hides a defect behind a more expensive model and bills you
// ~10× on that path for the privilege. It also fails silently the moment someone swaps a constant.
// When a cheap model "fails" a safety property, check whether it is exposing a gap the expensive
// one was papering over — twice now (Apollo's §-cites in #431, and this) the answer was yes.
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
export const QWEN_UNBOUND_CHAT_MODEL = process.env.QWEN_UNBOUND_CHAT_MODEL ?? "qwen3.7-flash";
