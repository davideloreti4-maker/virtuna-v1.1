/**
 * decode-why-plain.test.ts — the remix's "Why the original worked", in words the creator reads.
 *
 * The decode's four beats are analysis for the adapt step ("creates a prediction error loop") and
 * the film sheet showed them to the creator as they were. The same decode call now also writes
 * `why_plain`: two or three plain sentences from the viewer's seat. The runner carries it onto the
 * card as `sourceDecode.whyPlain`, and the sheet shows it in place of the beats.
 *
 * The decode is real. Its stand-ins are its I/O: the Qwen client, the logger, Sentry, cost.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
const mockCreate = vi.fn();
vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(() => ({ chat: { completions: { create: mockCreate } } })),
  QWEN_REASONING_MODEL: "qwen3.6-plus",
  QWEN_SEED: 7,
}));
vi.mock("@/lib/engine/qwen/cost", () => ({ calculateCost: vi.fn(() => 0.001) }));

import { BEAT_IDS } from "../decode-types";
import { runDecode, coerceDecodeResponse } from "../decode";
import { DECODE_SYSTEM_PROMPT, WHY_PLAIN_RULE } from "../decode-prompts";
import { comedyFixture } from "./fixtures/omni-structural";

/** The rule, word for word: it is the prompt. No example sentence: an example is a template. */
const RULE = `## Why It Worked, in Plain Words

"why_plain" is what the creator reads first: two or three short, plain sentences saying why people watched this video to the end. Tell it from the seat of a person watching: what they see or hear in THIS video (a moment, a line, a shot, a sound) and what they do because of it ("people", "they", "viewers"; never "you", never "the creator's audience"). Use short, everyday words a friend would use. Never use theory or industry terms: not "prediction error", "curiosity gap", "pattern interrupt", "open loop", "loop", "mechanism", "dopamine", "retention", "engagement", "payoff structure", "hook". No em dash or en dash: use a period or a comma. No advice. Shape: what happens in the video, then what people watching do because of it.`;

const beats = (body = "Body.") => BEAT_IDS.map((id) => ({ id, body, verdict: "present" }));
const completion = (result: unknown) => ({
  choices: [{ message: { content: JSON.stringify(result) } }],
  usage: { prompt_tokens: 800, completion_tokens: 300 },
});

beforeEach(() => mockCreate.mockReset());

describe("the decode prompt asks for why_plain", () => {
  it("carries the rule word for word, once, and names the field in the schema", () => {
    expect(WHY_PLAIN_RULE).toBe(RULE);
    expect(DECODE_SYSTEM_PROMPT.split(RULE)).toHaveLength(2);
    expect(DECODE_SYSTEM_PROMPT).toContain('"why_plain": "..."');
    expect(WHY_PLAIN_RULE).not.toMatch(/[–—]/);
  });
});

describe("coerceDecodeResponse: why_plain", () => {
  const base = { beats: beats(), repeatable: ["x"], luck: [{ category: "algorithmic_outlier", note: "n" }] };

  it("a real line becomes whyPlain, trimmed, with no dash", () => {
    const out = coerceDecodeResponse({ ...base, why_plain: "  The cat falls off the shelf — people wait for the second fall.  " }) as Record<string, unknown>;
    expect(out.whyPlain).toBe("The cat falls off the shelf. People wait for the second fall.");
  });

  it.each([[undefined], [""], ["   "], [7]])("missing or not text (%s): no key, and the decode still parses", (v) => {
    const out = coerceDecodeResponse({ ...base, why_plain: v }) as Record<string, unknown>;
    expect("whyPlain" in out).toBe(false);
  });
});

describe("runDecode carries whyPlain", () => {
  it("present in the model's JSON → on the result", async () => {
    mockCreate.mockResolvedValueOnce(
      completion({
        beats: beats(),
        repeatable: ["x"],
        luck: [{ category: "algorithmic_outlier", note: "n" }],
        why_plain: "A dog steals the sandwich in the first second. People stay to see if he gets caught.",
      }),
    );
    const res = await runDecode(comedyFixture);
    expect(res?.whyPlain).toBe("A dog steals the sandwich in the first second. People stay to see if he gets caught.");
    expect(res?.beats).toHaveLength(4);
  });

  it("absent → the result has none, and nothing else changes", async () => {
    mockCreate.mockResolvedValueOnce(
      completion({ beats: beats(), repeatable: ["x"], luck: [{ category: "algorithmic_outlier", note: "n" }] }),
    );
    const res = await runDecode(comedyFixture);
    expect(res).not.toBeNull();
    expect(res && "whyPlain" in res).toBe(false);
  });
});
