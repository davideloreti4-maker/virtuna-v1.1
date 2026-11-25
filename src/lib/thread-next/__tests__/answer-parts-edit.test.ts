/** answer-parts-edit.test.ts — an `edit` block in a turn is one card, and the prose beside it narration (Task 4). */
import { describe, expect, it } from "vitest";
import { hasResultCard, partsOf } from "../answer-parts";

const EDIT = { type: "edit", props: { editId: "55555555-5555-4555-8555-555555555555" } };

describe("an edit block in a turn", () => {
  it("is one edit part at its index", () => {
    const blocks = [{ type: "markdown", props: { text: "Here is your edit." } }, EDIT];
    expect(hasResultCard(blocks)).toBe(true);
    expect(partsOf(blocks)).toEqual([{ kind: "edit", item: { index: 1, block: EDIT } }]);
  });
});
