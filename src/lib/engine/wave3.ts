import type { ContentPayload, DeepSeekReasoning, PersonaSimulationResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";

/**
 * Phase 7 contract: 10-persona simulation (6 FYP + 2 niche + 1 loyalist + 1 cross-niche).
 * Per CONTEXT.md D-17. Must remain null-safe on partial failures.
 *
 * `_payload` and `_deepseekResult` are intentionally unused in the no-op (Phase 7 will read them).
 */
export async function runWave3(
  _payload: ContentPayload,
  _deepseekResult: DeepSeekReasoning | null,
  onEvent?: StageEventCallback,
): Promise<PersonaSimulationResult[]> {
  const start = emitStageStart(onEvent, "wave_3_personas", 3);

  // No-op — Phase 7 swaps with 10 parallel DeepSeek V4 Flash calls
  const result: PersonaSimulationResult[] = [];

  emitStageEnd(onEvent, "wave_3_personas", 3, start, { cost_cents: 0, ok: true });

  return result;
}
