/**
 * synthesizeLanes — the day-0 lane producer (v8 Phase 5, spec §4.2).
 *
 * The DashScope client is the ONE I/O boundary a unit test cannot run, so it is the only
 * thing stubbed here; the prompt building, the strip→parse→validate chain, the repair
 * retry and the cache-prefix invariant are all the real code under test.
 */
import { describe, it, expect, vi } from "vitest";
import { buildLaneUserContent, synthesizeLanes, LANE_MIN, LANE_MAX } from "../synthesize-lanes";

/** A stand-in for the DashScope client — queued responses, one per attempt. */
function fakeClient(payloads: string[]) {
  const create = vi.fn();
  for (const content of payloads) {
    create.mockResolvedValueOnce({ choices: [{ message: { content } }] });
  }
  return { fn: create, client: () => ({ chat: { completions: { create } } }) };
}

const THREE = JSON.stringify({
  lanes: [
    { name: "The numbers person", who: "receipts, not vibes", niche: "personal finance for renters" },
    { name: "The reformed overspender", who: "story-first", niche: "debt payoff storytelling" },
    { name: "The skeptic", who: "calls out the industry", niche: "fintech app criticism" },
  ],
});

describe("buildLaneUserContent", () => {
  it("carries the creator's answer verbatim and asks for the lane range", () => {
    const content = buildLaneUserContent("I could talk about budgeting on a tight income forever");
    expect(content).toContain("budgeting on a tight income");
    expect(content).toContain(`${LANE_MIN}`);
    expect(content).toContain(`${LANE_MAX}`);
  });
});

describe("synthesizeLanes", () => {
  it("returns the parsed lanes on a clean first response", async () => {
    const { client } = fakeClient([THREE]);
    const lanes = await synthesizeLanes("budgeting", { client });
    expect(lanes).toHaveLength(3);
    expect(lanes![0]).toEqual({
      name: "The numbers person",
      who: "receipts, not vibes",
      niche: "personal finance for renters",
    });
  });

  it("strips <think> blocks and code fences before parsing", async () => {
    const { client } = fakeClient([`<think>weighing lanes</think>\n\`\`\`json\n${THREE}\n\`\`\``]);
    const lanes = await synthesizeLanes("budgeting", { client });
    expect(lanes).toHaveLength(3);
  });

  it("repairs once when the first response is not valid JSON", async () => {
    const { fn, client } = fakeClient(["not json at all", THREE]);
    const lanes = await synthesizeLanes("budgeting", { client });
    expect(lanes).toHaveLength(3);
    expect(fn).toHaveBeenCalledTimes(2);
    // The repair nudge rides the USER message so the cached system prefix stays byte-stable.
    const first = fn.mock.calls[0]![0] as { messages: { role: string; content: string }[] };
    const second = fn.mock.calls[1]![0] as typeof first;
    expect(second.messages[0]!.content).toBe(first.messages[0]!.content);
    expect(second.messages[1]!.content).toContain("ONLY the raw JSON");
  });

  it("rejects a response with fewer than LANE_MIN lanes", async () => {
    const one = JSON.stringify({ lanes: [{ name: "A", who: "b", niche: "c" }] });
    const { client } = fakeClient([one, one]);
    expect(await synthesizeLanes("budgeting", { client })).toBeNull();
  });

  it("rejects a response with more than LANE_MAX lanes", async () => {
    const lane = { name: "A", who: "b", niche: "c" };
    const four = JSON.stringify({ lanes: [lane, lane, lane, lane] });
    const { client } = fakeClient([four, four]);
    expect(await synthesizeLanes("budgeting", { client })).toBeNull();
  });

  it("returns null (never throws) when the call itself fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("DashScope down"));
    const client = () => ({ chat: { completions: { create } } });
    await expect(synthesizeLanes("budgeting", { client })).resolves.toBeNull();
  });

  it("never spends a call on a blank answer", async () => {
    const { fn, client } = fakeClient([THREE]);
    expect(await synthesizeLanes("   ", { client })).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
