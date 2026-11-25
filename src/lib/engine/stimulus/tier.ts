/**
 * SIM-1 tier rule (IN-02 / D-03) — the audio-presence discriminator as a pure function.
 *
 * The SIM-1 tier is COMPUTED from the stimulus kind, never chosen by the user: an
 * audio-bearing person-video is Max; everything else (text / file_text / image) is Flash.
 *
 * What Max means for the models (2026-11-25): a person-video is HEARD once, upstream, by the
 * person-video watch (`audience/profile-bake.ts`, `QWEN_OMNI_MODEL`), which writes the
 * behavioural signal and the transcript as TEXT. `SIM1_MODEL_BY_TIER` names the model of the
 * call that reads that text (the profile READ, `tools/runners/profile-runner.ts`), and that
 * call is text-only on BOTH tiers — so both tiers map to the reasoning model. Max used to map
 * to the omni model here because "Max" once meant "the audio tier"; the READ never sent audio.
 * The audio boundary is the watch, not this map. The badge ("sim1-max") is a product label.
 *
 * ⚠️ NAMING-COLLISION WARNING (Pitfall 1): SIM-1 Flash (a tier) ≠ qwen3.5-omni-FLASH (the audio
 * sensor model) ≠ the reasoning model (itself a "flash"). Read the CONSTANT, never the word.
 * Never route an image/text/file stimulus to QWEN_OMNI_MODEL.
 *
 * The tier→model mapping is encoded ONCE here (`SIM1_MODEL_BY_TIER`) so no model id
 * is ever inlined in vision.ts / normalize.ts. Pure module — no I/O, no side effects,
 * never reads user state.
 */

import { QWEN_REASONING_MODEL } from "../qwen/client";

import type { StimulusKind, Sim1Tier } from "./types";

/**
 * The canonical tier→model mapping (D-03) for the text READ that follows the tier.
 * Kept as a map, though both entries agree, so a tier can move on its own again.
 * Max was `QWEN_OMNI_MODEL` until 2026-11-25; rollback is that one line.
 */
export const SIM1_MODEL_BY_TIER: Record<Sim1Tier, string> = {
  max: QWEN_REASONING_MODEL,
  flash: QWEN_REASONING_MODEL,
};

/**
 * Resolve the SIM-1 tier purely from the stimulus kind (IN-02 / D-03).
 * Audio-bearing video → Max (heard upstream by the omni person-video watch); all other kinds → Flash.
 *
 * Exhaustive over `StimulusKind`: only `"video"` carries audio, so it is the sole
 * Max kind — the single audio-presence discriminator.
 */
export function resolveSim1Tier(kind: StimulusKind): Sim1Tier {
  return kind === "video" ? "max" : "flash";
}
