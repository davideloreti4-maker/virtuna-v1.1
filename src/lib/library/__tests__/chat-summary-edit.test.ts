/** chat-summary-edit.test.ts — Library's row of a chat that holds an edit (plan 2026-11-24-editor-screens-a, Task 4). */
import { describe, expect, it } from "vitest";
import { fallbackTitle } from "@/components/library-next/row-line";
import { MEAL_PREP_HOOKS } from "@/components/thread-next/__tests__/fixtures/answers";
import { chatSummaryOf } from "../chat-summary";
import { insideLabel } from "../piece-words";

const EDIT = { type: "edit", props: { editId: "55555555-5555-4555-8555-555555555555" } };
const NONE = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

describe("a chat that holds an edit", () => {
  it("is led by the edit, a draft, with nothing counted", () => {
    expect(chatSummaryOf([[EDIT]], {})).toEqual({ counts: NONE, lead: "edit", stage: "draft", sim: null, frame: null });
  });

  it("is led by another piece when the chat holds one, wherever the edit sits: the edit is still counted nowhere", () => {
    const hook = MEAL_PREP_HOOKS[0];
    const led = { counts: { ...NONE, hooks: 1 }, lead: "hooks", stage: "draft", sim: null, frame: null };
    expect(chatSummaryOf([[EDIT], [hook]], {})).toEqual(led);
    expect(chatSummaryOf([[hook], [EDIT]], {})).toEqual(led);
    expect(chatSummaryOf([[hook, EDIT]], {})).toEqual(led);
  });

  it("says Edit and is named Edit until it has a title", () => {
    expect(insideLabel({ counts: NONE, lead: "edit" })).toBe("Edit");
    expect(fallbackTitle("edit")).toBe("Edit");
  });

  it("leaves a chat with no edit as it was", () => {
    expect(chatSummaryOf([[{ type: "markdown", props: { text: "Hi" } }]], {})).toMatchObject({ lead: "chat", stage: "chat" });
    expect(chatSummaryOf("not a list" as unknown as unknown[], {})).toMatchObject({ lead: "chat", stage: "chat" });
  });
});
