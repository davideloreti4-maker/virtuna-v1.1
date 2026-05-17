import type { ContentPayload, Wave0Result } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";

/**
 * Phase 4 contract: when filling this stub with real V3 calls,
 * preserve null-return-on-failure + warning push. Never throw.
 * Per CONTEXT.md D-16.
 *
 * `_payload` is intentionally unused in the no-op (Phase 4 will read it).
 */
export async function runWave0(
  _payload: ContentPayload,
  onEvent?: StageEventCallback,
): Promise<Wave0Result> {
  const ctStart = emitStageStart(onEvent, "wave_0_content_type", 0);
  const niStart = emitStageStart(onEvent, "wave_0_niche_detector", 0);

  // No-op — Phase 4 swaps with real V3 calls (content_type + hierarchical niche)
  const result: Wave0Result = { content_type: null, niche: null };

  emitStageEnd(onEvent, "wave_0_content_type", 0, ctStart, { cost_cents: 0, ok: true });
  emitStageEnd(onEvent, "wave_0_niche_detector", 0, niStart, { cost_cents: 0, ok: true });

  return result;
}
