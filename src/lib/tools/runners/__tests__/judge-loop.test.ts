/**
 * judge-loop.test.ts — C1 checkable-judge RUNNER COMPOSITION (generate → check → ONE revise →
 * re-check → honest degrade), the seam the pure checkable-judge tests cannot see.
 *
 * Contract under test (per skill, gated by ENGINE_JUDGE_{HOOKS,IDEAS,SCRIPT}):
 *   - flag OFF → byte-identical behavior: one gen call, zero judge calls, no new warnings
 *   - checks: unfilled [slot] leaks (mechanical) · ask-thesis inversion (ONE flash judge call
 *     per check pass, skipped entirely when the run has no real ask) · requested count
 *     (hooks/ideas) · anchor fidelity re-check (script — a revise must not regress N-7)
 *   - ONE consolidated revise call carrying every rejection (temp-0/seeded generation means an
 *     unchanged prompt reproduces the failure byte-for-byte — Stage A anchor-retry precedent)
 *   - honest degrade when the revise doesn't clear: script ships the ORIGINAL with a visible
 *     warning; hooks/ideas DROP the failing unit(s) with a visible warning
 *
 * The leak fixture is the REAL measured failure: case 1 of AB-ADAPT-IDEAS-SCRIPT-2026-08-10-script
 * shipped compiled.ts's Gold-Standard Turn template verbatim, unfilled slots and all.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GatherCorpusResult } from "@/lib/grounding/gather-for-run";

// ─── Mock topology (mirrors citation-guard-adapt.test.ts) ─────────────────────

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
  runFlashTextModeBatch: vi.fn(),
}));

vi.mock("@/lib/audience/characterize-content", () => ({
  characterizeContent: vi.fn(),
}));

vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(
    (input: { ask: string; anchor?: string }) =>
      `BUNDLE ask:${input.ask}${input.anchor ? ` anchor:${input.anchor}` : ""}`,
  ),
}));

vi.mock("@/lib/grounding/gather-for-run", () => ({
  gatherCorpusForRun: vi.fn(),
}));

import { getQwenClient } from "@/lib/engine/qwen/client";
import { gatherCorpusForRun } from "@/lib/grounding/gather-for-run";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** The REAL measured leak — case 1's Turn beat, verbatim. */
const LEAKED_TURN =
  "It was not [the thing they predicted]. It was [the actual finding — stated plainly, without qualification].";

const ASK = "why founders should post daily even when it feels cringe";

function scriptResponse(turnContent: string, opening = "Posting daily feels cringe. Do it anyway.") {
  return {
    beats: [
      { label: "Hook", content: opening, timing: "0–3s", retentionMarker: "Stakes-first claim." },
      { label: "Setup", content: "Every founder waits for polish first.", timing: "3–15s", retentionMarker: "Open loop." },
      { label: "Turn", content: turnContent, timing: "15–30s", retentionMarker: "Prediction error." },
      { label: "Payoff", content: "Post the ugly video today.", timing: "30–40s", retentionMarker: "One action." },
      { label: "CTA", content: "Come back and tell me what you posted.", timing: "40–45s", retentionMarker: "Report-back." },
    ],
    openingBeatSeed: opening,
    personaStops: 8,
    stopQuote: "Okay I need this.",
    sourceIndex: 0,
  };
}

function hooksResponse(lines: string[]) {
  return {
    hooks: lines.map((l) => ({
      hookLine: l,
      mechanism: "Concrete stakes before the ask lands",
      seedHook: l,
      channel: "spoken",
      needsTake: false,
      personaStops: 7,
      stopQuote: "That got me.",
      sourceIndex: 0,
    })),
  };
}

function ideasResponse(angles: Array<{ title: string; angle: string }>) {
  return {
    ideas: angles.map((a) => ({
      title: a.title,
      angle: a.angle,
      mechanism: "Belief↔reality tension",
      seedHook: `${a.title} — the seed line`,
      needsTake: false,
      topic: "posting",
      take: "",
      format: null,
      personaStops: 7,
      stopQuote: "Huh, really?",
      sourceIndex: 0,
    })),
  };
}

const CLEAN_HOOKS_5 = [
  "The most expensive thing you do every day is nothing.",
  "You are not bad at posting. You are cheap on cringe.",
  "Your polished video is killing your reach.",
  "Silence costs more than any bad take ever will.",
  "Nobody remembers your worst post. Everyone notices your absence.",
];

const UNGROUNDED: GatherCorpusResult = {
  corpus: undefined,
  examples: [],
  scrapeAvailable: false,
  warrant: "structural",
  grounded: false,
  adapted: false,
};

/**
 * Dispatcher mock: routes each create() call to the gen or judge queue by the judge system-prompt
 * marker. A queue holds its LAST response when exhausted (temp-0 generation is deterministic — a
 * repeated identical prompt reproduces the same output). An Error entry rejects the call.
 */
const JUDGE_MARKER = "mechanical output checker";

function mockQwen(gen: unknown[], judge: unknown[] = []) {
  const genQ = [...gen];
  const judgeQ = [...judge];
  const create = vi.fn().mockImplementation((req: { messages: Array<{ content: string }> }) => {
    const q = req.messages[0]!.content.includes(JUDGE_MARKER) ? judgeQ : genQ;
    const next = q.length > 1 ? q.shift()! : q[0];
    if (next === undefined) return Promise.reject(new Error("mock queue empty"));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve({ choices: [{ message: { content: JSON.stringify(next) } }] });
  });
  (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
    chat: { completions: { create } },
  });
  return create;
}

type CreateMock = ReturnType<typeof mockQwen>;
function callsOf(create: CreateMock, kind: "gen" | "judge") {
  return create.mock.calls.filter(
    (c) =>
      (c[0] as { messages: Array<{ content: string }> }).messages[0]!.content.includes(
        JUDGE_MARKER,
      ) ===
      (kind === "judge"),
  );
}
function userPromptOf(call: unknown[]): string {
  return (call[0] as { messages: Array<{ content: string }> }).messages[1]!.content;
}

const FLAGS = ["ENGINE_JUDGE_HOOKS", "ENGINE_JUDGE_IDEAS", "ENGINE_JUDGE_SCRIPT"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  (gatherCorpusForRun as ReturnType<typeof vi.fn>).mockResolvedValue(UNGROUNDED);
  for (const k of FLAGS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of FLAGS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

// ─── Script ───────────────────────────────────────────────────────────────────

describe("runScriptPipeline × checkable-judge", () => {
  it("slot leak → ONE revise (rejection in prompt) → the clean revision ships, no warnings", async () => {
    process.env.ENGINE_JUDGE_SCRIPT = "true";
    const create = mockQwen(
      [scriptResponse(LEAKED_TURN), scriptResponse("It was not the leads. It was the reps.")],
      [{ inverted: [false] }],
    );

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks, warnings } = await runScriptPipeline({ ask: ASK, platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(1);
    const turn = blocks[0]!.props.beats.find((b) => b.label === "Turn");
    expect(turn?.content).toBe("It was not the leads. It was the reps.");
    expect(warnings).toEqual([]);

    expect(callsOf(create, "gen").length).toBe(2);
    expect(callsOf(create, "judge").length).toBe(2); // initial + post-revise re-judge
    const revisePrompt = userPromptOf(callsOf(create, "gen")[1]!);
    expect(revisePrompt).toContain("REJECTED");
    expect(revisePrompt).toContain("[the thing they predicted]");
  });

  it("thesis inversion → revise → the re-judged clean revision ships", async () => {
    process.env.ENGINE_JUDGE_SCRIPT = "true";
    const create = mockQwen(
      [
        scriptResponse("Daily posting builds noise, not authority.", "Posting daily is ruining your brand."),
        scriptResponse("The cringe is the tax on being seen.", "Silence is the only thing more expensive than cringe."),
      ],
      [{ inverted: [true] }, { inverted: [false] }],
    );

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks, warnings } = await runScriptPipeline({ ask: ASK, platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(1);
    expect(blocks[0]!.props.openingBeatSeed).toContain("Silence is the only thing");
    expect(warnings).toEqual([]);
    const revisePrompt = userPromptOf(callsOf(create, "gen")[1]!);
    expect(revisePrompt).toContain("OPPOSITE");
  });

  it("leak survives the revise → the ORIGINAL ships with a visible warning naming the beat", async () => {
    process.env.ENGINE_JUDGE_SCRIPT = "true";
    mockQwen([scriptResponse(LEAKED_TURN)], [{ inverted: [false] }]); // revise reproduces the leak

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks, warnings, judgeTrace } = await runScriptPipeline({
      ask: ASK,
      platform: "tiktok",
      profileRow: null,
    });

    expect(blocks.length).toBe(1);
    expect(warnings.some((w) => w.includes("Turn") && w.includes("placeholder"))).toBe(true);
    expect(judgeTrace).toContain("revise:rejected");
  });

  it("flag OFF → one gen call, zero judge calls, the leak ships silently (today's behavior)", async () => {
    const create = mockQwen([scriptResponse(LEAKED_TURN)]);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks, warnings } = await runScriptPipeline({ ask: ASK, platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(1);
    expect(warnings).toEqual([]);
    expect(callsOf(create, "gen").length).toBe(1);
    expect(callsOf(create, "judge").length).toBe(0);
  });

  it("no real ask (chip run) → NO judge call, but the mechanical leak check still revises", async () => {
    process.env.ENGINE_JUDGE_SCRIPT = "true";
    const anchor = "Stop trying to wake up at 5 AM";
    const opening = "Stop trying to wake up at 5 AM. Fix your sleep instead.";
    const create = mockQwen([
      scriptResponse(LEAKED_TURN, opening),
      scriptResponse("It was not discipline. It was adenosine.", opening),
    ]);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks, warnings } = await runScriptPipeline({
      ask: "",
      platform: "tiktok",
      profileRow: null,
      anchor,
    });

    expect(blocks.length).toBe(1);
    expect(warnings).toEqual([]);
    expect(callsOf(create, "judge").length).toBe(0);
    expect(callsOf(create, "gen").length).toBe(2);
    // The revise must also restate the anchor contract so a fix can't regress N-7.
    expect(userPromptOf(callsOf(create, "gen")[1]!)).toContain("Anchor");
  });
});

// ─── Hooks ────────────────────────────────────────────────────────────────────

describe("runHooksPipeline × checkable-judge", () => {
  it("count shortfall → revise names the count → the full batch ships", async () => {
    process.env.ENGINE_JUDGE_HOOKS = "true";
    const create = mockQwen(
      [hooksResponse(CLEAN_HOOKS_5.slice(0, 3)), hooksResponse(CLEAN_HOOKS_5)],
      [{ inverted: [false, false, false] }, { inverted: [false, false, false, false, false] }],
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks, warnings } = await runHooksPipeline({
      ask: ASK,
      platform: "tiktok",
      profileRow: null,
      count: 5,
    });

    expect(blocks.length).toBe(5);
    expect(warnings).toEqual([]);
    expect(userPromptOf(callsOf(create, "gen")[1]!)).toContain("exactly 5");
  });

  it("a leak that survives the revise → that hook is DROPPED with a visible warning", async () => {
    process.env.ENGINE_JUDGE_HOOKS = "true";
    mockQwen(
      [hooksResponse(["Hey [insert name], posting daily works.", CLEAN_HOOKS_5[0]!])],
      [{ inverted: [false, false] }],
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks, warnings } = await runHooksPipeline({
      ask: ASK,
      platform: "tiktok",
      profileRow: null,
      count: 2,
    });

    expect(blocks.length).toBe(1);
    expect(blocks[0]!.props.hookLine).toBe(CLEAN_HOOKS_5[0]);
    expect(warnings.some((w) => w.includes("failed output checks"))).toBe(true);
  });

  it("judge outage fails OPEN — clean single-call run, no warnings", async () => {
    process.env.ENGINE_JUDGE_HOOKS = "true";
    const create = mockQwen(
      [hooksResponse(CLEAN_HOOKS_5.slice(0, 2))],
      [new Error("DashScope 500")],
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks, warnings } = await runHooksPipeline({
      ask: ASK,
      platform: "tiktok",
      profileRow: null,
      count: 2,
    });

    expect(blocks.length).toBe(2);
    expect(warnings).toEqual([]);
    expect(callsOf(create, "gen").length).toBe(1);
  });
});

// ─── Ideas ────────────────────────────────────────────────────────────────────

describe("runIdeasPipeline × checkable-judge", () => {
  it("slot leak in one idea → revise fixes it → all four ship clean", async () => {
    process.env.ENGINE_JUDGE_IDEAS = "true";
    const leaky = [
      { title: "The Cringe Tax", angle: "Pay the [specific cost] upfront to be seen." },
      { title: "Silence Is Expensive", angle: "Not posting costs more than posting badly." },
      { title: "Indexed, Not Judged", angle: "You are being indexed, not judged." },
      { title: "The 30-Day Trail", angle: "Thirty days of posts is a reputation audit." },
    ];
    const clean = leaky.map((x, i) =>
      i === 0 ? { ...x, angle: "Pay the discomfort upfront to be seen." } : x,
    );
    const create = mockQwen(
      [ideasResponse(leaky), ideasResponse(clean)],
      [{ inverted: [false, false, false, false] }],
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks, warnings } = await runIdeasPipeline({ ask: ASK, platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(4);
    expect(warnings).toEqual([]);
    expect(callsOf(create, "gen").length).toBe(2);
    expect(userPromptOf(callsOf(create, "gen")[1]!)).toContain("REJECTED");
  });
});
