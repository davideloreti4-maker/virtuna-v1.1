/**
 * Mock fixtures MUST satisfy the production block schemas — else insertMessage (D-14)
 * silently maps them to <UnsupportedBlock> and the demo thread renders as gray sentinels.
 * This test is the cheap guard: every seeded block round-trips through BlockUnionSchema.
 */
import { describe, it, expect } from "vitest";
import { BlockUnionSchema } from "@/lib/tools/blocks";
import { SEED_MESSAGES, FIXTURE_BLOCKS_BY_SKILL } from "../fixtures";

describe("mock fixtures — schema validity", () => {
  it("every SEED_MESSAGES block parses against BlockUnionSchema", () => {
    const failures: string[] = [];
    SEED_MESSAGES.forEach((msg, mi) => {
      msg.blocks.forEach((block, bi) => {
        const r = BlockUnionSchema.safeParse(block);
        if (!r.success) {
          failures.push(
            `msg[${mi}].block[${bi}] (${(block as { type?: string }).type}): ${r.error.issues
              .map((i) => `${i.path.join(".")} ${i.message}`)
              .join("; ")}`,
          );
        }
      });
    });
    expect(failures, failures.join("\n")).toHaveLength(0);
  });

  it("every per-skill fixture set is non-empty and schema-valid", () => {
    for (const [skill, blocks] of Object.entries(FIXTURE_BLOCKS_BY_SKILL)) {
      expect(blocks.length, `${skill} has no fixtures`).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(
          BlockUnionSchema.safeParse(block).success,
          `${skill} block failed schema`,
        ).toBe(true);
      }
    }
  });
});
