/**
 * SIM-1 Flash — ToolRunner implementation (Plan 01-03 Task 3).
 *
 * Implements the ToolRunner<TOut> contract (THREAD-06) for the Flash text-mode engine path.
 *
 * Emits TWO blocks tagged model:"sim1-flash" (D-10):
 *   - band block: { band, fraction, model:"sim1-flash" } from aggregateFlash (D-01/D-02)
 *   - personas block: { personas:[{archetype, verdict, quote}] } (D-01/D-03, behind expand)
 *
 * D-11 honesty spine: the runner emits NO numeric forecast, score, percentile, views, or engagement.
 * D-08: this runner is NOT wired to UI in P1 — Ideas/Hooks chips ship disabled ("coming soon").
 *       Ideas/Hooks consume this runner in P3/P4; the chip flip happens there.
 *
 * Imports:
 *   - tool-runner.ts: ToolRunner interface + dispatchToolOutput
 *   - block-registry.ts: assertBlocksInRegistry (SSOT)
 *   - flash/run-flash-text-mode.ts: runFlashTextMode + FlashFraming
 *   - flash/flash-aggregate.ts: aggregateFlash
 */

import { z } from "zod";
import type { ToolRunner } from "../tool-runner";
import { assertBlocksInRegistry } from "../block-registry";
import { runFlashTextMode } from "../../../lib/engine/flash/run-flash-text-mode";
import type { FlashFraming } from "../../../lib/engine/flash/run-flash-text-mode";
import { aggregateFlash } from "../../../lib/engine/flash/flash-aggregate";
import type { FlashResult } from "../../../lib/engine/flash/flash-schema";
import { BandBlockSchema, PersonasBlockSchema } from "../blocks";
import type { BandBlock, PersonasBlock } from "../blocks";

// Re-export FlashFraming for callers
export type { FlashFraming };

// ─── Output schema ────────────────────────────────────────────────────────────
// The runner's outputSchema wraps the FlashResult into a blocks[] array so that
// dispatchToolOutput can extract the blocks (convention: schema root exposes `blocks[]`).
// The FlashOutputSchema is validated at the dispatch boundary.

const FlashOutputSchema = z.object({
  blocks: z.array(
    z.discriminatedUnion("type", [
      BandBlockSchema,
      PersonasBlockSchema,
    ]),
  ),
});

type FlashOutput = z.infer<typeof FlashOutputSchema>;

// ─── FlashRunner (ToolRunner contract, THREAD-06) ───────────────────────────

/**
 * SIM-1 Flash ToolRunner.
 *
 * `model: "sim1-flash"` drives the composer's active-model field (D-09).
 * `renderer: ["band", "personas"]` ⊆ BLOCK_REGISTRY (validated by assertBlocksInRegistry).
 * D-08: No UI wiring in P1 — runner contract is ready; chip flip happens in P3/P4.
 */
export const flashRunner: ToolRunner<FlashOutput> = {
  id: "hooks", // Flash is the engine for Ideas/Hooks tools (P3/P4 will also use "idea")
  model: "sim1-flash",

  // promptTemplate is a passthrough — actual prompt is built inside runFlashTextMode.
  // The framing comes from the caller via input.framing (ToolInput extension).
  promptTemplate: (input) => {
    const text = typeof input.content_text === "string" ? input.content_text : "";
    return text;
  },

  // P1: no knowledge bundle — Phase 2 (GROUND-*) fills this with KC slices.
  knowledgeBundle: null,

  // outputSchema: the FlashOutputSchema wrapper — validated at dispatch boundary.
  outputSchema: FlashOutputSchema,

  // renderer: the two block types this runner is allowed to emit, ⊆ BLOCK_REGISTRY.
  renderer: ["band", "personas"],

  // stream: false — return-whole Flash result (P1, Pitfall #6 / A3).
  stream: false,
};

// ─── runFlashRunner ──────────────────────────────────────────────────────────
// Helper that executes the full Flash pipeline and returns validated OutputBlock[].
// Callers (API routes, P3/P4 tool orchestrators) use this, not flashRunner.run().
// Produces band + personas blocks tagged sim1-flash, validated against BLOCK_REGISTRY.

/**
 * Execute the Flash text-mode pipeline and return validated renderer-ready blocks.
 *
 * @param content_text  The creator's text content to react to.
 * @param framing       Mode framing — hook | idea | chat (D-04).
 * @returns { bandBlock, personasBlock, warnings }
 *
 * D-11: emits NO numeric score, percentile, views, or engagement in the blocks.
 */
export async function runFlashRunner(
  content_text: string,
  framing: FlashFraming,
): Promise<{
  bandBlock: BandBlock;
  personasBlock: PersonasBlock;
  warnings: string[];
}> {
  // Fire the bounded Flash call
  const { result, warnings } = await runFlashTextMode(content_text, framing);

  // Map FlashResult → blocks
  const { bandBlock, personasBlock } = mapFlashResultToBlocks(result);

  return { bandBlock, personasBlock, warnings };
}

// ─── mapFlashResultToBlocks ──────────────────────────────────────────────────
// Pure mapper from FlashResult → {bandBlock, personasBlock}.
// Exported for testability and for Task 3 acceptance criteria verification.

/**
 * Map a FlashResult into BandBlock + PersonasBlock, both tagged model:"sim1-flash".
 * Runs assertBlocksInRegistry to verify both types are in the allowed renderer subset.
 *
 * D-11: BandBlock has NO numeric score — only band + fraction + model tag.
 * D-10: both blocks carry model:"sim1-flash" provenance tag.
 */
export function mapFlashResultToBlocks(result: FlashResult): {
  bandBlock: BandBlock;
  personasBlock: PersonasBlock;
} {
  // Aggregate the 10 verdicts → band + fraction (D-02, no fabricated number)
  const { band, fraction } = aggregateFlash(result.personas);

  const bandBlock: BandBlock = {
    type: "band",
    props: {
      band,
      fraction,
      model: "sim1-flash", // D-10 provenance tag
    },
  };

  const personasBlock: PersonasBlock = {
    type: "personas",
    props: {
      personas: result.personas.map((p) => ({
        archetype: p.archetype,
        verdict: p.verdict,
        quote: p.quote,
      })),
    },
  };

  // Assert both block types are within the declared renderer subset (THREAD-06 / D-14)
  assertBlocksInRegistry([bandBlock, personasBlock], flashRunner.renderer);

  return { bandBlock, personasBlock };
}
