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

// Maven's pick (spec 2026-11-25-maven-pick-design.md): a mock hooks run shows the line under its pack
// and the plain reason in each hook's sheet, as a real run does, so every mock hook carries a usable
// `why` and keeps it through the schema.
describe("mock fixtures — the hooks' plain reasons", () => {
  it("every mock hook carries a usable why, kept by the schema", async () => {
    const { usableWhy } = await import("@/lib/thread-next/pick-line");
    const hooks = FIXTURE_BLOCKS_BY_SKILL.hooks.filter((b) => b.type === "hook-card");
    expect(hooks.length).toBeGreaterThanOrEqual(2);
    for (const block of hooks) {
      const parsed = BlockUnionSchema.parse(block) as { props: { why?: string } };
      expect(usableWhy(parsed.props.why), JSON.stringify(block.props)).not.toBeNull();
    }
  });
});
