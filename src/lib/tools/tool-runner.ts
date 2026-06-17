/**
 * ToolRunner contract + dispatchToolOutput (THREAD-06).
 *
 * Every tool in the studio flows through this contract.
 * The dispatch rule:
 *  - outputSchema present → validate structured model JSON → assertBlocksInRegistry → typed blocks
 *  - outputSchema null    → wrap model text as a single markdown block
 *
 * The `stream?: boolean` field is reserved but unused in P1 — the seam is here so
 * the IDEAS-02 "content-first streaming" pattern (Phase 3) can slot in without a
 * contract change (Open Q3 from RESEARCH.md).
 */

import { type z } from "zod";
import {
  type BlockType,
  assertBlocksInRegistry,
} from "./block-registry";

// ─── KnowledgeBundle ─────────────────────────────────────────────────────────
// P1 placeholder — Phase 2 (GROUND-*) fills this with the generative KC slices.
// Shape is intentionally opaque here so the contract doesn't couple to the KC schema.

export interface KnowledgeBundle {
  /** Opaque — Phase 2 defines the concrete fields. */
  [key: string]: unknown;
}

// ─── ToolInput ────────────────────────────────────────────────────────────────
// Minimal input type — callers may extend this for specific tools.
export interface ToolInput {
  [key: string]: unknown;
}

// ─── ToolRunner contract (THREAD-06) ─────────────────────────────────────────

export interface ToolRunner<TOut = unknown> {
  /** Explicit tool selection (D-06). Creators must know which tool they're invoking. */
  id: "test" | "idea" | "hooks" | "chat";

  /** Drives the composer's active-model field (D-09). Chip → model: Test→Max, Ideas/Hooks→Flash. */
  model: "sim1-max" | "sim1-flash";

  /**
   * Builds the prompt for this tool.
   * Returns either a plain string or an OpenAI content array (for multi-modal inputs).
   */
  promptTemplate: (input: ToolInput) => string | Array<{ type: string; [key: string]: unknown }>;

  /**
   * Knowledge bundle for grounded generation (D-04 / GROUND-*).
   * P1: null — Phase 2 fills this with KC slices per tool.
   */
  knowledgeBundle: KnowledgeBundle | null;

  /**
   * Zod schema for the structured model output.
   * Present → structured-output path → typed renderer blocks.
   * Absent (null) → markdown block path.
   */
  outputSchema: z.ZodType<TOut> | null;

  /**
   * Block types this tool is allowed to emit.
   * MUST be a subset of BLOCK_REGISTRY keys (enforced by assertBlocksInRegistry at dispatch).
   */
  renderer: BlockType[];

  /**
   * Reserved seam for content-first streaming (IDEAS-02, Phase 3).
   * Unused in P1 — return-whole Flash result (see RESEARCH.md Open Q3 / Pitfall #6).
   */
  stream?: boolean;
}

// ─── Block shape (dispatch output) ───────────────────────────────────────────

export interface OutputBlock {
  type: BlockType;
  props: unknown;
}

// ─── dispatchToolOutput ───────────────────────────────────────────────────────

/**
 * Dispatch helper — validates model output and returns typed OutputBlock[].
 *
 * @param runner  The ToolRunner contract (carries outputSchema + renderer subset).
 * @param modelOutput  The raw model output: JSON object when outputSchema is set,
 *                     string when outputSchema is null.
 * @returns OutputBlock[] ready for persistence + rendering.
 * @throws if outputSchema.safeParse fails OR a block type is outside runner.renderer.
 */
export function dispatchToolOutput<TOut>(
  runner: ToolRunner<TOut>,
  modelOutput: unknown,
): OutputBlock[] {
  // Schema-absent path: wrap text as a single markdown block.
  if (runner.outputSchema === null) {
    const text = typeof modelOutput === "string" ? modelOutput : String(modelOutput);
    return [{ type: "markdown", props: { text } }];
  }

  // Schema-present path: parse structured JSON at the model boundary.
  const parsed = runner.outputSchema.safeParse(modelOutput);
  if (!parsed.success) {
    throw new Error(
      `ToolRunner(${runner.id}): outputSchema parse failed — ${parsed.error.message}`,
    );
  }

  // Extract blocks from the parsed output.
  // Convention: the schema root MUST expose a `blocks` array field.
  const output = parsed.data as Record<string, unknown>;
  const rawBlocks = Array.isArray(output.blocks) ? output.blocks : [];
  const blocks = rawBlocks as OutputBlock[];

  // Assert all block types are within the runner's declared renderer subset (THREAD-06).
  assertBlocksInRegistry(blocks, runner.renderer);

  return blocks;
}
