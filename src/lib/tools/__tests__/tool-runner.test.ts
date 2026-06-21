/**
 * Task 3 — ToolRunner contract + dispatchToolOutput tests.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { dispatchToolOutput } from "../tool-runner";
import type { ToolRunner } from "../tool-runner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BandOutputSchema = z.object({
  blocks: z.array(
    z.object({
      type: z.literal("band"),
      props: z.object({
        band: z.enum(["Strong", "Mixed", "Weak"]),
        fraction: z.string(),
        model: z.enum(["sim1-flash", "sim1-max"]),
      }),
    }),
  ),
});

type BandOutput = z.infer<typeof BandOutputSchema>;

const mockFlashRunner: ToolRunner<BandOutput> = {
  id: "idea",
  model: "sim1-flash",
  promptTemplate: (input) => `Analyze: ${JSON.stringify(input)}`,
  knowledgeBundle: null,
  outputSchema: BandOutputSchema,
  renderer: ["band"],
};

const mockMarkdownRunner: ToolRunner<never> = {
  id: "chat",
  model: "sim1-flash",
  promptTemplate: (input) => `Chat: ${JSON.stringify(input)}`,
  knowledgeBundle: null,
  outputSchema: null,
  renderer: ["markdown"],
};

// ─── dispatchToolOutput ───────────────────────────────────────────────────────

describe("dispatchToolOutput", () => {
  it("returns typed blocks when outputSchema is present and output is valid", () => {
    const modelJson = {
      blocks: [
        { type: "band", props: { band: "Strong", fraction: "6/10 stop", model: "sim1-flash" } },
      ],
    };
    const blocks = dispatchToolOutput(mockFlashRunner, modelJson);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "band" });
  });

  it("wraps text as a single markdown block when outputSchema is null", () => {
    const blocks = dispatchToolOutput(mockMarkdownRunner, "hello world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "markdown",
      props: { text: "hello world" },
    });
  });

  it("throws when a block type is outside the runner's renderer subset", () => {
    // Runner says renderer: ["markdown"], but structured output emits a band block
    const restrictedRunner: ToolRunner<BandOutput> = {
      ...mockFlashRunner,
      renderer: ["markdown"], // band is NOT allowed
    };
    const modelJson = {
      blocks: [
        { type: "band", props: { band: "Weak", fraction: "2/10 stop", model: "sim1-flash" } },
      ],
    };
    expect(() => dispatchToolOutput(restrictedRunner, modelJson)).toThrow();
  });

  it("throws when outputSchema parse fails (invalid structured output)", () => {
    const badJson = { blocks: [{ type: "band", props: { band: "Unknown" } }] };
    expect(() => dispatchToolOutput(mockFlashRunner, badJson)).toThrow();
  });
});

// ─── ToolRunner type shape ────────────────────────────────────────────────────

describe("ToolRunner interface", () => {
  it("accepts all four valid id values", () => {
    const ids: Array<ToolRunner<never>["id"]> = ["test", "idea", "hooks", "chat"];
    expect(ids).toHaveLength(4);
  });

  it("accepts both model values", () => {
    const models: Array<ToolRunner<never>["model"]> = ["sim1-max", "sim1-flash"];
    expect(models).toHaveLength(2);
  });
});
