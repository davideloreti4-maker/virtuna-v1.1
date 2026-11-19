/**
 * The fold's request and its answer are about the SAME ten viewers.
 *
 * Found 2026-11-19 on engine 3.23.0. The system prompt asked for "one entry per archetype" while the
 * user block listed ten persona SLOTS — and only three of the eight content types give one slot per
 * archetype (talking_head has two loyalists and no purposeful_viewer, b_roll has tough_crowd twice,
 * vlog has three loyalists …). qwen3.7-flash answered per archetype: it dropped the duplicate,
 * sometimes invented a viewer nobody asked for, and from about nine scenes on returned nine entries.
 *   - nine entries  → `.length(10)` failed twice (the retry repeats the same deterministic call)
 *                     → the whole audience was dropped ("expert read only")
 *   - ten entries, wrong set → accepted without a warning; the unasked viewer was weighted as "fyp"
 * Measured on two real clips (11 and 19 scenes): the old wording failed for 4 of 5 viewer plans, the
 * wording locked below returned exactly the ten asked viewers in 15 of 15 calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));

// The model API is the one boundary this test cannot run; everything else is the real code.
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

process.env.DASHSCOPE_API_KEY = "test-key";

import { runFold } from "../fold";
import { STABLE_FOLD_SYSTEM_PROMPT, buildFoldUserContent } from "../fold-prompts";
import { ALLOCATION_TABLE, selectPersonaSlots, type PersonaSlot } from "../persona-registry";
import type { ContentTypeSlug } from "../../types";

const SEGMENTS = [
  { idx: 0, t_start: 0, t_end: 3, is_hook_zone: true, visual_event: "a", audio_event: "" },
  { idx: 1, t_start: 3, t_end: 8, is_hook_zone: false, visual_event: "b", audio_event: "" },
  { idx: 2, t_start: 8, t_end: 15, is_hook_zone: false, visual_event: "c", audio_event: "" },
];

type Viewer = { archetype: string; persona_id: string };

/** A well-formed answer for the given viewers (attention falls 0.5 per viewer: no diversity nudge). */
function answer(viewers: Viewer[]) {
  const personas = viewers.map((v, i) => ({
    archetype: v.archetype,
    persona_id: v.persona_id,
    watch_through_pct: 80 - i * 2,
    share_intent: 60,
    comment_intent: 40,
    save_intent: 30,
    rewatch_intent: 20,
    scroll_past_second: 0,
    segment_reactions: [
      { attention: 0.9, swipe_predicted: false },
      { attention: 0.6, swipe_predicted: false },
      { attention: 0.4, swipe_predicted: false },
    ],
  }));
  return {
    choices: [{ message: { content: JSON.stringify({ personas }) } }],
    usage: { prompt_tokens: 1000, completion_tokens: 500 },
  };
}

const asViewers = (slots: PersonaSlot[]): Viewer[] => slots.map((s) => ({ archetype: s.archetype, persona_id: s.persona_id }));
const textOf = (slots: PersonaSlot[]) => {
  const item = buildFoldUserContent(slots, SEGMENTS as never, "hook", [], null).find((c) => c.type === "text");
  return item && item.type === "text" ? item.text : "";
};

describe("fold request — one entry per persona slot", () => {
  it("the system prompt asks for one entry per slot, not one per archetype", () => {
    expect(STABLE_FOLD_SYSTEM_PROMPT).not.toContain("one per archetype");
    expect(STABLE_FOLD_SYSTEM_PROMPT).toContain("ONE PER PERSONA SLOT");
  });

  it.each(Object.keys(ALLOCATION_TABLE) as ContentTypeSlug[])(
    "names the ten persona ids to return, in slot order (%s)",
    (contentType) => {
      const slots = selectPersonaSlots(contentType, "lifestyle");
      const text = textOf(slots);
      const list = text.slice(text.lastIndexOf("EXACTLY 10 personas"));
      const positions = slots.map((s, i) => list.indexOf(`${i + 1}. ${s.persona_id}`));
      expect(positions.every((p) => p >= 0)).toBe(true); // every asked viewer is named, with its number
      expect([...positions].sort((a, b) => a - b)).toEqual(positions); // in slot order
    },
  );
});

describe("fold request — the reaction count is the last thing the model reads", () => {
  // Second fault found the same day: on a two-minute clip (70k video tokens) flash copied the
  // 2-item arrays of the worked example and returned 2 reactions per viewer instead of 10, with the
  // old and the new wording alike → every viewer dropped for a segment-count mismatch. Restating the
  // count per entry as the final line: 0 of 3 exact before, 6 of 7 after, and no change elsewhere.
  it("ends by restating how many reactions every entry needs and that the example's 2 is not the count", () => {
    const text = textOf(selectPersonaSlots("vlog", "comedy"));
    const lastLine = text.trimEnd().split("\n").pop() ?? "";
    expect(lastLine).toContain(`exactly ${SEGMENTS.length} items`);
    expect(lastLine).toContain(`idx 0 to ${SEGMENTS.length - 1}`);
    expect(lastLine).toMatch(/only an example/);
  });
});

describe("runFold — only the viewers that were asked for count", () => {
  beforeEach(() => mockCreate.mockReset());

  const run = (slots: PersonaSlot[]) => runFold(slots, SEGMENTS as never, "hook", [], null);

  it("drops a viewer nobody asked for and keeps the nine asked viewers", async () => {
    // talking_head: two loyalists, no purposeful_viewer. The model answers "one per archetype".
    const slots = selectPersonaSlots("talking_head", "lifestyle");
    const perArchetype = [
      ...asViewers(slots).filter((v) => v.persona_id !== "loyalist-2-loyalist-lifestyle"),
      { archetype: "purposeful_viewer", persona_id: "fyp-6-purposeful-viewer-lifestyle" },
    ];
    expect(perArchetype).toHaveLength(10); // ten entries: it passes the count check
    mockCreate.mockResolvedValue(answer(perArchetype));

    const outcome = await run(slots);

    expect(outcome.fold_success).toBe(true); // nine asked viewers ≥ the salvage floor of six
    expect(outcome.personaSimResults.map((p) => p.archetype)).not.toContain("purposeful_viewer");
    expect(outcome.personaSimResults).toHaveLength(9);
    expect(outcome.pass2Results).toHaveLength(9);
    expect(outcome.warnings.join(" ")).toMatch(/not asked for: [^;]*purposeful_viewer/);
    expect(outcome.warnings.join(" ")).toMatch(/missing: [^;]*loyalist-2-loyalist-lifestyle/);
  });

  it("gives no audience when fewer than six asked viewers come back", async () => {
    const slots = selectPersonaSlots("talking_head", "lifestyle");
    const mostlyStrangers = [
      ...asViewers(slots).slice(0, 5),
      ...Array.from({ length: 5 }, (_, i) => ({ archetype: `stranger_${i}`, persona_id: `stranger-${i}` })),
    ];
    mockCreate.mockResolvedValue(answer(mostlyStrangers));

    const outcome = await run(slots);

    expect(outcome.fold_success).toBe(false);
    expect(outcome.personaSimResults).toHaveLength(0);
  });

  it("matches a viewer whose id is misspelled by its archetype and restores the asked id", async () => {
    const slots = selectPersonaSlots("comedy", "lifestyle");
    const misspelled = asViewers(slots).map((v) =>
      v.archetype === "high_engager" ? { ...v, persona_id: "fyp-3-high-engager-lifestyle" } : v,
    );
    mockCreate.mockResolvedValue(answer(misspelled));

    const outcome = await run(slots);

    expect(outcome.fold_success).toBe(true);
    expect(outcome.personaSimResults).toHaveLength(10);
    expect(outcome.personaSimResults.map((p) => p.persona_id)).toEqual(slots.map((s) => s.persona_id));
  });
});
