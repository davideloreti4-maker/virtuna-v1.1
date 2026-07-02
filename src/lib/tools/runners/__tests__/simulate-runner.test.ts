/**
 * simulate-runner.test.ts — Phase 5 Plan 05 Task 1 (SIMU-01/02) · person-framing revision.
 *
 * Locks the Simulate verb's TWO branches:
 *   - PANEL → the message runs through the Flash content-critic engine
 *     (runFlashTextMode → aggregateFlash, steered by the audience repaint) and renders a
 *     band + fraction (NEVER re-rolled) + clustered themes + the per-persona drill.
 *   - PERSON → the Flash engine is BYPASSED. A single behavioral MESSAGE-reaction
 *     (injectable `personReact`, grounded in the baked signature) renders one read
 *     (verdict + reasoning + quote); band/fraction/themes SUPPRESSED (Pitfall 2 — no
 *     "7/10" for one human). This is the person-framing fix: the person reacts to the
 *     message's ask, not to it as content to scroll past.
 *
 * Coverage (the <behavior> + acceptance_criteria):
 *   - person → single read from personReact; flash NEVER called; band/fraction/themes null.
 *   - person → personReact receives the drafted message + a signature-grounded subject.
 *   - person → an over-long quote is truncated to the block's 160-char cap.
 *   - the person/panel branch is DETERMINISTIC: driven by the persisted `__subject_kind`
 *     marker, NOT by persona count. A person-marked audience carrying >1 persona STILL
 *     renders a person read (no fraction).
 *   - panel → band/fraction === aggregateFlash(personas) (never re-rolled); tier Directional.
 *   - the emitted block passes ReactionDistributionBlockSchema.safeParse.
 */

import { describe, it, expect, vi } from "vitest";
import { aggregateFlash } from "@/lib/engine/flash/flash-aggregate";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";
import { ReactionDistributionBlockSchema } from "@/lib/tools/profile-blocks";
import type { Audience, CalibratedPersona } from "@/lib/audience/audience-types";
import type { Stimulus } from "@/lib/engine/stimulus/types";

import { runSimulate } from "../simulate-runner";
import type { PersonReaction } from "../simulate-runner";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Build N personas with `stops` "stop" verdicts (rest "scroll"). 10 by default. */
function makePersonas(stops: number, total = 10): FlashPersona[] {
  const slugs = [
    "loyalist",
    "tough_crowd",
    "high_engager",
    "lurker",
    "saver",
    "sharer",
    "purposeful_viewer",
    "niche_deep_buyer",
    "niche_deep_scout",
    "cross_niche_curiosity",
  ];
  return Array.from({ length: total }, (_, i) => ({
    archetype: slugs[i % slugs.length]!,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: `reaction ${i} from ${slugs[i % slugs.length]}`,
  }));
}

function calibratedPersona(archetype: string, share: number): CalibratedPersona {
  return {
    archetype: archetype as CalibratedPersona["archetype"],
    repaint: `${archetype} judges directly`,
    temperature: "warm",
    disposition: "skeptic",
    share,
  };
}

function makeAudience(opts: {
  marker?: "person" | "panel";
  personas?: CalibratedPersona[];
}): Audience {
  return {
    id: "aud-sim-1",
    user_id: "user-1",
    name: "Alex",
    type: "target",
    mode: "general",
    platform: "custom",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: opts.personas ?? [],
    profile: null,
    calibration: null,
    custom_context: opts.marker
      ? [{ source: "user", persona_evidence_link: "__subject_kind", note: opts.marker }]
      : null,
    created_at: "2026-06-28T00:00:00Z",
    updated_at: "2026-06-28T00:00:00Z",
  };
}

function makeStimulus(content = "Hey — circling back on the proposal, can we close by Friday?"): Stimulus {
  return { kind: "text", content, source: { origin: "text" }, tier: "flash" };
}

/** A mocked runFlashTextMode returning a fixed panel (PANEL path). */
function flashReturning(personas: FlashPersona[]) {
  return vi.fn(async () => ({ result: { personas }, warnings: [] as string[] }));
}

/** A mocked personReact returning a fixed reaction (PERSON path). */
function personReactReturning(reaction: PersonReaction) {
  return vi.fn(async () => reaction);
}

const READ: PersonReaction = {
  verdict: "resistant",
  reasoning: "A skeptical analyst wants the insight up front, not a file-transfer preamble.",
  quote: "Lead with the number that changes my mind — don't make me dig for it.",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runSimulate — panel (distribution + themes)", () => {
  it("returns band + fraction (from aggregateFlash) + themes + reactions; read absent", async () => {
    const personas = makePersonas(7); // 7/10 stop → Strong
    const flash = flashReturning(personas);
    const audience = makeAudience({ marker: "panel" });

    const block = await runSimulate({ audience, stimulus: makeStimulus() }, { flash });

    expect(block.type).toBe("reaction-distribution");
    expect(block.props.subjectKind).toBe("panel");
    // fraction is exactly what aggregateFlash returns — NEVER re-rolled.
    const agg = aggregateFlash(personas);
    expect(block.props.band).toBe(agg.band);
    expect(block.props.fraction).toBe(agg.fraction);
    expect(block.props.themes?.length).toBeGreaterThan(0);
    expect(block.props.reactions?.length).toBe(10);
    // panel → NO single read (a panel has a distribution, not one verdict).
    expect(block.props.read ?? null).toBeNull();
    expect(block.props.tier).toBe("Directional");
  });
});

describe("runSimulate — person (single MESSAGE-reaction, NOT a content critique)", () => {
  it("returns a single read from personReact; Flash NEVER called; band/fraction/themes suppressed", async () => {
    const flash = flashReturning(makePersonas(6));
    const personReact = personReactReturning(READ);
    const audience = makeAudience({
      marker: "person",
      personas: [calibratedPersona("loyalist", 0.7), calibratedPersona("tough_crowd", 0.3)],
    });

    const block = await runSimulate({ audience, stimulus: makeStimulus() }, { flash, personReact });

    expect(block.props.subjectKind).toBe("person");
    // The person path bypasses the content-critic engine entirely.
    expect(flash).not.toHaveBeenCalled();
    expect(personReact).toHaveBeenCalledTimes(1);
    // The read is the behavioral reaction, NOT a repurposed Flash persona quote.
    expect(block.props.read?.verdict).toBe("resistant");
    expect(block.props.read?.reasoning).toBe(READ.reasoning);
    expect(block.props.read?.quote).toBe(READ.quote);
    // Pitfall 2: a single human has no honest distribution.
    expect(block.props.band ?? null).toBeNull();
    expect(block.props.fraction ?? null).toBeNull();
    expect(block.props.themes ?? null).toBeNull();
  });

  it("feeds personReact the drafted message + a signature-grounded subject description", async () => {
    const personReact = personReactReturning(READ);
    const audience = makeAudience({
      marker: "person",
      personas: [calibratedPersona("tough_crowd", 0.6), calibratedPersona("loyalist", 0.4)],
    });
    const message = "Sending the data now — full cohort breakdown attached.";

    await runSimulate({ audience, stimulus: makeStimulus(message) }, { personReact });

    const arg = personReact.mock.calls[0]![0];
    expect(arg.message).toBe(message);
    // grounded from the audience: the name + the highest-share persona's reaction frame.
    expect(arg.subjectDescription).toContain("Alex");
    expect(arg.subjectDescription).toContain("tough_crowd judges directly");
  });

  it("truncates an over-long reaction quote to the block's 160-char cap", async () => {
    const longQuote = "x".repeat(400);
    const personReact = personReactReturning({ ...READ, quote: longQuote });
    const audience = makeAudience({ marker: "person", personas: [calibratedPersona("loyalist", 1)] });

    const block = await runSimulate({ audience, stimulus: makeStimulus() }, { personReact });

    expect(block.props.read?.quote.length).toBe(160);
    expect(ReactionDistributionBlockSchema.safeParse(block).success).toBe(true);
  });
});

describe("runSimulate — subjectKind is read from the marker, NOT persona count (D-02)", () => {
  it("a person-marked audience carrying >1 persona STILL renders a person read (no fraction)", async () => {
    const flash = flashReturning(makePersonas(8));
    const personReact = personReactReturning(READ);
    // 3 calibrated personas but the persisted marker says "person".
    const audience = makeAudience({
      marker: "person",
      personas: [
        calibratedPersona("loyalist", 0.5),
        calibratedPersona("tough_crowd", 0.3),
        calibratedPersona("saver", 0.2),
      ],
    });

    const block = await runSimulate({ audience, stimulus: makeStimulus() }, { flash, personReact });

    // Driven by the marker → person, NOT panel (despite 3 personas).
    expect(block.props.subjectKind).toBe("person");
    expect(block.props.read).not.toBeNull();
    expect(block.props.fraction ?? null).toBeNull();
    expect(flash).not.toHaveBeenCalled();
  });

  it("an explicit input.subjectKind overrides the marker", async () => {
    const flash = flashReturning(makePersonas(5));
    const audience = makeAudience({ marker: "person" });

    const block = await runSimulate(
      { audience, stimulus: makeStimulus(), subjectKind: "panel" },
      { flash },
    );

    expect(block.props.subjectKind).toBe("panel");
    expect(block.props.band).not.toBeNull();
  });

  it("defaults to person (honest-safe) when the marker is absent", async () => {
    const personReact = personReactReturning(READ);
    const audience = makeAudience({}); // no marker

    const block = await runSimulate({ audience, stimulus: makeStimulus() }, { personReact });

    expect(block.props.subjectKind).toBe("person");
    expect(block.props.read).not.toBeNull();
  });
});

describe("runSimulate — block validity", () => {
  it("emits a ReactionDistributionBlockSchema-valid block (panel)", async () => {
    const flash = flashReturning(makePersonas(3));
    const audience = makeAudience({ marker: "panel" });

    const block = await runSimulate({ audience, stimulus: makeStimulus() }, { flash });

    expect(ReactionDistributionBlockSchema.safeParse(block).success).toBe(true);
    expect(block.props.model).toBe("sim1-flash");
    expect(flash).toHaveBeenCalledTimes(1);
  });

  it("emits a ReactionDistributionBlockSchema-valid block (person)", async () => {
    const personReact = personReactReturning(READ);
    const audience = makeAudience({
      marker: "person",
      personas: [calibratedPersona("loyalist", 1)],
    });

    const block = await runSimulate({ audience, stimulus: makeStimulus() }, { personReact });

    expect(ReactionDistributionBlockSchema.safeParse(block).success).toBe(true);
    expect(block.props.model).toBe("sim1-flash");
  });
});
