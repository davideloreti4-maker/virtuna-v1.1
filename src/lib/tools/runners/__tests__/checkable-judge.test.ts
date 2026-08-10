/**
 * checkable-judge.test.ts — C1 checkable-judge primitives (proposal §3.C1).
 *
 * Every check here is MECHANICAL or binary-checkable — never a taste rubric. That constraint
 * is load-bearing: the removed rubric critic failed ~100% judging taste (hooks-runner.ts S5
 * note). The measured defect classes these primitives exist for (both from case 1 of
 * docs/AB-ADAPT-IDEAS-SCRIPT-2026-08-10-script.md, a LIVE adapt-arm run):
 *
 *   - a Turn beat shipped VERBATIM prompt boilerplate with unfilled [slots], echoed from
 *     compiled.ts's Gold-Standard Beat Templates
 *   - the same script INVERTED the ask's thesis (ask "why founders should post daily" →
 *     output "posting daily is ruining your brand")
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

import {
  findSlotLeaks,
  judgeThesisInversion,
  isJudgeEnabled,
} from "@/lib/tools/runners/checkable-judge";
import { getQwenClient } from "@/lib/engine/qwen/client";

/** The REAL measured leak — case 1's Turn beat, verbatim (compiled.ts:1317 boilerplate). */
const LEAKED_TURN =
  "It was not [the thing they predicted]. It was [the actual finding — stated plainly, without qualification].";

// ─── findSlotLeaks ────────────────────────────────────────────────────────────

describe("findSlotLeaks", () => {
  it("finds both unfilled slots in the measured case-1 Turn leak", () => {
    const leaks = findSlotLeaks(LEAKED_TURN);
    expect(leaks).toEqual([
      "[the thing they predicted]",
      "[the actual finding — stated plainly, without qualification]",
    ]);
  });

  it("returns [] on a clean spoken line", () => {
    expect(findSlotLeaks("Posting daily is ruining your brand. You are building noise.")).toEqual([]);
    expect(findSlotLeaks("Comment 'HEAVY' if you are ready to stop running.")).toEqual([]);
  });

  it("ignores short bracket runs with no slot diction ([3], [ok], [])", () => {
    expect(findSlotLeaks("Top [3] tips")).toEqual([]);
    expect(findSlotLeaks("checkbox [] done and [ok] too")).toEqual([]);
  });

  it("flags a classic insert-style placeholder", () => {
    expect(findSlotLeaks("Hey [insert name], welcome back")).toEqual(["[insert name]"]);
  });

  it("returns [] on empty/whitespace text", () => {
    expect(findSlotLeaks("")).toEqual([]);
    expect(findSlotLeaks("   ")).toEqual([]);
  });
});

// ─── isJudgeEnabled ───────────────────────────────────────────────────────────

describe("isJudgeEnabled", () => {
  const KEYS = ["ENGINE_JUDGE_HOOKS", "ENGINE_JUDGE_IDEAS", "ENGINE_JUDGE_SCRIPT"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is OFF by default for every skill", () => {
    expect(isJudgeEnabled("hooks")).toBe(false);
    expect(isJudgeEnabled("ideas")).toBe(false);
    expect(isJudgeEnabled("script")).toBe(false);
  });

  it("each skill has its own flag", () => {
    process.env.ENGINE_JUDGE_SCRIPT = "true";
    expect(isJudgeEnabled("script")).toBe(true);
    expect(isJudgeEnabled("hooks")).toBe(false);
    expect(isJudgeEnabled("ideas")).toBe(false);
  });

  it("only the literal 'true' enables", () => {
    process.env.ENGINE_JUDGE_HOOKS = "1";
    expect(isJudgeEnabled("hooks")).toBe(false);
  });
});

// ─── judgeThesisInversion ─────────────────────────────────────────────────────

function mockJudgeResponse(content: string | Error) {
  const create =
    content instanceof Error
      ? vi.fn().mockRejectedValue(content)
      : vi.fn().mockResolvedValue({ choices: [{ message: { content } }] });
  (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
    chat: { completions: { create } },
  });
  return create;
}

describe("judgeThesisInversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps the model's per-unit verdicts back in order", async () => {
    mockJudgeResponse(JSON.stringify({ inverted: [false, true, false] }));
    const verdicts = await judgeThesisInversion("why founders should post daily", [
      "The most expensive thing you do every day is nothing.",
      "Posting daily is ruining your brand.",
      "Your polished video is killing your reach.",
    ]);
    expect(verdicts).toEqual([false, true, false]);
  });

  it("sends the ask and every unit to the judge", async () => {
    const create = mockJudgeResponse(JSON.stringify({ inverted: [false] }));
    await judgeThesisInversion("why lifting beats cardio", ["Put the weights down."]);
    const call = create.mock.calls[0]![0] as { messages: Array<{ content: string }> };
    const allText = call.messages.map((m) => m.content).join("\n");
    expect(allText).toContain("why lifting beats cardio");
    expect(allText).toContain("Put the weights down.");
  });

  it("normalizes a short verdict array — missing entries default to NOT inverted", async () => {
    mockJudgeResponse(JSON.stringify({ inverted: [true] }));
    const verdicts = await judgeThesisInversion("ask", ["a", "b", "c"]);
    expect(verdicts).toEqual([true, false, false]);
  });

  it("fails OPEN (null) when the judge call throws", async () => {
    mockJudgeResponse(new Error("DashScope 500"));
    expect(await judgeThesisInversion("ask", ["a"])).toBeNull();
  });

  it("fails OPEN (null) on malformed judge output", async () => {
    mockJudgeResponse("not json at all");
    expect(await judgeThesisInversion("ask", ["a"])).toBeNull();
  });

  it("returns [] without calling the model when there are no units", async () => {
    const create = mockJudgeResponse(JSON.stringify({ inverted: [] }));
    expect(await judgeThesisInversion("ask", [])).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});
