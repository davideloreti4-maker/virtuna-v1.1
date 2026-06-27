/**
 * SIM-1 tier rule (IN-02 / D-03) — the audio-presence discriminator as a pure function.
 *
 * The SIM-1 tier is COMPUTED from the stimulus kind, never chosen by the user: an
 * audio-bearing person-video routes to Max (the omni audio sensor); everything else
 * (text / file_text / image) routes to Flash (qwen3.7-plus, deaf but vision-capable).
 *
 * ⚠️ NAMING-COLLISION WARNING (Pitfall 1): omni-**flash** (the MODEL name,
 * `qwen3.5-omni-flash`) is NOT SIM-1-**Flash** (the TIER). The mapping is inverted:
 *     SIM-1 Max   → QWEN_OMNI_MODEL      (qwen3.5-omni-flash, audio sensor)
 *     SIM-1 Flash → QWEN_REASONING_MODEL (qwen3.7-plus, deaf, vision-capable)
 * Never route an image/text/file stimulus to QWEN_OMNI_MODEL.
 *
 * The tier→model mapping is encoded ONCE here (`SIM1_MODEL_BY_TIER`) so no model id
 * is ever inlined in vision.ts / normalize.ts. Pure module — no I/O, no side effects,
 * never reads user state.
 */

import { QWEN_OMNI_MODEL, QWEN_REASONING_MODEL } from "../qwen/client";

import type { StimulusKind, Sim1Tier } from "./types";

/**
 * The canonical tier→model mapping (D-03). Centralized here so the omni-flash vs
 * SIM-1-Flash collision (above) is resolved in exactly one place.
 */
export const SIM1_MODEL_BY_TIER: Record<Sim1Tier, string> = {
  max: QWEN_OMNI_MODEL,
  flash: QWEN_REASONING_MODEL,
};

/**
 * Resolve the SIM-1 tier purely from the stimulus kind (IN-02 / D-03).
 * Audio-bearing video → Max (omni sensor); all other kinds → Flash.
 *
 * Exhaustive over `StimulusKind`: only `"video"` carries audio, so it is the sole
 * Max kind — the single audio-presence discriminator.
 */
export function resolveSim1Tier(kind: StimulusKind): Sim1Tier {
  return kind === "video" ? "max" : "flash";
}
