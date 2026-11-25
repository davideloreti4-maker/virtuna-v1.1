/** edit-block.test.ts — the `edit` block: a door from a chat to its editor page (plan 2026-11-24-editor-screens-a, Task 4). */
import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, validateBlock } from "../block-registry";
import { NON_RECORD_BLOCKS } from "../on-screen";

const ID = "55555555-5555-4555-8555-555555555555";

describe("the edit block", () => {
  it("is registered and holds only the edit's id", () => {
    expect(Object.keys(BLOCK_REGISTRY)).toContain("edit");
    expect(validateBlock({ type: "edit", props: { editId: ID } })).toEqual({ ok: true, block: { type: "edit", props: { editId: ID } } });
    expect(validateBlock({ type: "edit", props: { editId: "not-an-id" } }).ok).toBe(false);
    expect(validateBlock({ type: "edit", props: {} }).ok).toBe(false);
  });

  it("drops anything else a stored block carries: the card reads the edit itself", () => {
    const read = validateBlock({ type: "edit", props: { editId: ID, title: "kept nowhere" } });
    expect(read.ok && read.block.props).toEqual({ editId: ID });
  });

  it("is knowingly left out of the chat's memory", () => {
    expect(NON_RECORD_BLOCKS.edit).toMatch(/editor/);
  });
});
