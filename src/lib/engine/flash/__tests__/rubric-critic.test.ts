/**
 * rubric-critic.test.ts — critiqueAgainstRubric unit tests (Plan 14-02 Task 1).
 *
 * The Flash rubric-critic is the independent judge (D-08) that executes the BASE
 * Value Bar (Test A named mechanism / Test B non-fakeable concrete / Test C fit +
 * Prohibition 6 trope test, base.md:260-303) against a single candidate, in ONE
 * json_object Flash call, returning { pass, predictedFailureMode }.
 *
 * Behavior (plan 14-02):
 *  - Test 1: a candidate that names a concrete mechanism + a non-fakeable concrete +
 *    creator fit → { pass: true, predictedFailureMode: null }.
 *  - Test 2: a generic niche-trope candidate (fails Prohibition 6 / Test B
 *    find-and-replace) → { pass: false, predictedFailureMode: <non-empty string> }.
 *  - Test 3: a Flash/transport error inside the critic → resolves to a fail-safe
 *    verdict (pass: false), never throws into the Promise.all (mirrors the existing
 *    runFlashTextMode(...).catch(() => null) resilience).
 *
 * Isolation: the critic must import ONLY qwen/client, flash-schema, and the panel
 * type — NEVER pipeline/aggregator/version/wave3 engine internals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NichePanel } from "../flash-prompts";

// ─── Mock Qwen client ─────────────────────────────────────────────────────────
// The critic fires ONE json_object Flash call via getQwenClient (mirrors
// run-flash-text-mode). We control the model output per test.

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

const FITNESS_PANEL: NichePanel = { niche: "fitness", contentType: null };

/** Build a fake Qwen client whose single completion returns `content`. */
function mockClientReturning(content: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
  };
}

/** Build a fake Qwen client whose single completion rejects (transport error). */
function mockClientThrowing(err: Error) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockRejectedValue(err),
      },
    },
  };
}

describe("critiqueAgainstRubric (rubric-critic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: concrete-mechanism + non-fakeable concrete + fit → { pass: true, predictedFailureMode: null }", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockClientReturning(
        JSON.stringify({ pass: true, predictedFailureMode: null }),
      ),
    );

    const { critiqueAgainstRubric } = await import("../rubric-critic");
    const verdict = await critiqueAgainstRubric(
      "Cut the first 0.8s of dead air before your title card — the curiosity-gap mechanism only fires if the question lands before the scroll reflex.",
      "idea",
      FITNESS_PANEL,
    );

    expect(verdict.pass).toBe(true);
    expect(verdict.predictedFailureMode).toBeNull();
  });

  it("Test 2: generic niche-trope candidate → { pass: false, predictedFailureMode: <non-empty> }", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockClientReturning(
        JSON.stringify({
          pass: false,
          predictedFailureMode:
            "This is the compound-interest chart trope every finance creator opens with — your audience has seen it a hundred times and will scroll.",
        }),
      ),
    );

    const { critiqueAgainstRubric } = await import("../rubric-critic");
    const verdict = await critiqueAgainstRubric(
      "5 money tips to get rich",
      "idea",
      FITNESS_PANEL,
    );

    expect(verdict.pass).toBe(false);
    expect(typeof verdict.predictedFailureMode).toBe("string");
    expect((verdict.predictedFailureMode ?? "").length).toBeGreaterThan(0);
  });

  it("Test 3: transport/parse error → fail-safe verdict (pass: false), never throws", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockClientThrowing(new Error("network down")),
    );

    const { critiqueAgainstRubric } = await import("../rubric-critic");

    // Must RESOLVE (not reject) — mirrors runFlashTextMode(...).catch(() => null).
    const verdict = await critiqueAgainstRubric("anything", "hook", FITNESS_PANEL);

    expect(verdict.pass).toBe(false);
  });

  it("malformed JSON model output → fail-safe verdict (pass: false), never throws", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockClientReturning("this is not json at all"),
    );

    const { critiqueAgainstRubric } = await import("../rubric-critic");
    const verdict = await critiqueAgainstRubric("anything", "idea", FITNESS_PANEL);

    expect(verdict.pass).toBe(false);
  });

  it("null-niche panel still produces a verdict (generic critique path)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockClientReturning(JSON.stringify({ pass: true, predictedFailureMode: null })),
    );

    const { critiqueAgainstRubric } = await import("../rubric-critic");
    const verdict = await critiqueAgainstRubric("some idea", "idea", {
      niche: null,
      contentType: null,
    });

    expect(typeof verdict.pass).toBe("boolean");
  });
});
