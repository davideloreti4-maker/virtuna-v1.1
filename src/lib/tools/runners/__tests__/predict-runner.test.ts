/**
 * predict-runner.test.ts — runPredict zero-network orchestration (Wave 0, → 06-05).
 *
 * RED by design: imports `runPredict` from `@/lib/tools/runners/predict-runner`, which does
 * NOT exist until 06-05 (module-not-found = the intended Nyquist RED). 06-05 turns it GREEN.
 *
 * Locks (mirrors simulate-runner.test discipline — injected `deps.flash`, ZERO network):
 *   - the assembled `prediction-gauge` block is ALWAYS `tier: "Directional"` + `model: "sim1-flash"`
 *     + a non-empty `caveat` (PRED-03 honesty provenance);
 *   - band / range / confidence / factors are populated from the panel (derived, not echoed);
 *   - `successCriterion` is carried from `audience.success_criterion` (D-04 lens line);
 *   - deterministic: the run never touches the network (the Flash leaf is injected).
 */

import { describe, it, expect } from "vitest";
import { runPredict } from "@/lib/tools/runners/predict-runner";
import type { PredictPanelResult } from "@/lib/engine/flash/predict-schema";
import type { Audience } from "@/lib/audience/audience-types";
import type { Stimulus } from "@/lib/engine/stimulus/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────────

const PANEL: PredictPanelResult = {
  analysts: [
    {
      archetype: "tough_crowd",
      lean: "lean_no",
      factor: "The hook buries the payoff.",
      factorDirection: "against",
      reasoning: "Skeptics bounce early.",
    },
    {
      archetype: "purposeful_viewer",
      lean: "lean_yes",
      factor: "The promise is concrete.",
      factorDirection: "for",
      reasoning: "A clear deliverable earns the watch.",
    },
    {
      archetype: "cross_niche_curiosity",
      lean: "strongly_yes",
      factor: "Novel framing travels.",
      factorDirection: "for",
      reasoning: "Fresh enough to cross over.",
    },
    {
      archetype: "niche_deep_scout",
      lean: "toss_up",
      factor: "Proof is thin.",
      factorDirection: "against",
      reasoning: "Needs one more receipt.",
    },
  ],
};

/** Injected zero-network Flash leaf — returns the fixed panel (mirrors run-predict-panel's shape). */
const flashStub = async () => ({ result: PANEL, warnings: [] as string[] });

function makeAudience(): Audience {
  return {
    id: "template-analyst",
    user_id: "user-1",
    name: "Analyst Panel",
    type: "target",
    mode: "general",
    platform: "custom",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    success_criterion: "Surfaces the sharpest risk and the strongest counter-argument.",
    persona_weights: { fyp: 0.25, niche: 0.25, loyalist: 0.25, cross_niche: 0.25 },
    personas: [],
    profile: null,
    calibration: null,
    custom_context: [],
    created_at: "2026-06-29T00:00:00Z",
    updated_at: "2026-06-29T00:00:00Z",
  } as unknown as Audience;
}

function makeStimulus(): Stimulus {
  return {
    kind: "text",
    content: "Will this hook break 100k views?",
    source: { origin: "text" },
    tier: "flash",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────────

describe("runPredict — honesty provenance (PRED-03)", () => {
  it("assembles a prediction-gauge block that is always Directional + sim1-flash + caveat", async () => {
    const block = await runPredict(
      { audience: makeAudience(), stimulus: makeStimulus() },
      { flash: flashStub },
    );

    expect(block.type).toBe("prediction-gauge");
    expect(block.props.tier).toBe("Directional");
    expect(block.props.model).toBe("sim1-flash");
    expect(block.props.caveat.length).toBeGreaterThan(0);
  });

  it("populates band / range / confidence / factors from the panel (derived, not echoed)", async () => {
    const block = await runPredict(
      { audience: makeAudience(), stimulus: makeStimulus() },
      { flash: flashStub },
    );

    expect(block.props.band.length).toBeGreaterThan(0);
    expect(typeof block.props.range.min).toBe("number");
    expect(typeof block.props.range.max).toBe("number");
    expect(["High", "Medium", "Low"]).toContain(block.props.confidence);
    expect(block.props.factors.length).toBe(PANEL.analysts.length);
  });

  it("carries successCriterion from audience.success_criterion (D-04 lens line)", async () => {
    const audience = makeAudience();
    const block = await runPredict({ audience, stimulus: makeStimulus() }, { flash: flashStub });
    expect(block.props.successCriterion).toBe(audience.success_criterion);
  });

  it("runs zero-network: the injected Flash leaf is the only model seam", async () => {
    let called = 0;
    const counting = async () => {
      called += 1;
      return { result: PANEL, warnings: [] as string[] };
    };
    await runPredict({ audience: makeAudience(), stimulus: makeStimulus() }, { flash: counting });
    expect(called).toBe(1);
  });
});
