/**
 * profile-runner.test.ts — Phase 5 Plan 04 Task 1 (PROF-01/02/03).
 *
 * Locks the fused Profile verb: ONE bake → the forensic behavioral READ (hero card)
 * AND the saved person/panel General SIM, from a single runProfile call.
 *
 * Coverage (the <behavior> + acceptance_criteria):
 *   - Flash tier (text) → forensic null/absent, model "sim1-flash"; READ uses
 *     QWEN_REASONING_MODEL (NEVER omni — Pitfall 1).
 *   - Max tier (person-video) → forensic present (band word + cues), model "sim1-max".
 *   - D-08 isolation: the READ system message is BEHAVIORAL_SYSTEM_PROMPT_FLASH/_MAX
 *     byte-for-byte (no evidence/goal/successCriterion bytes); the untrusted data lives
 *     only in the USER message.
 *   - The bake is saved via createAudience(mode:"general"); block.savedAudienceId is the
 *     returned id; block.tier === "Directional".
 *   - The saved audience custom_context carries the reserved subjectKind marker
 *     { persona_evidence_link:"__subject_kind", note:<subjectKind> } — and a person bake
 *     with >1 persona STILL persists note:"person" (D-02 / Pitfall 2).
 *   - The emitted block passes ProfileReadBlockSchema.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AudienceSignature, Audience } from "@/lib/audience/audience-types";
import {
  BEHAVIORAL_SYSTEM_PROMPT_FLASH,
  BEHAVIORAL_SYSTEM_PROMPT_MAX,
} from "@/lib/engine/behavioral-core";
import { QWEN_REASONING_MODEL, QWEN_OMNI_MODEL } from "@/lib/engine/qwen/client";
import { ProfileReadBlockSchema } from "@/lib/tools/profile-blocks";
import type { Stimulus } from "@/lib/engine/stimulus/types";

// ─── Mock the Qwen client (the READ call) — everything else real or injected ────

const mockCreate = vi.fn();

vi.mock("@/lib/engine/qwen/client", async (orig) => {
  const actual = await orig<typeof import("@/lib/engine/qwen/client")>();
  return {
    ...actual,
    getQwenClient: vi.fn(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

import { runProfile } from "../profile-runner";

// ─── Sentinels — to prove D-08 isolation (no user bytes in the system prompt) ───

const EVIDENCE_SENTINEL = "SENTINEL_EVIDENCE_zzz_close-by-friday-or-i-walk";
const GOAL_SENTINEL = "SENTINEL_GOAL_zzz_close-the-deal";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeSignature(personaCount: number): AudienceSignature {
  const pool = [
    { archetype: "tough_crowd" as const, temperature: "warm" as const, disposition: "skeptic" as const },
    { archetype: "purposeful_viewer" as const, temperature: "warm" as const, disposition: "collector" as const },
    { archetype: "loyalist" as const, temperature: "hot" as const, disposition: "connector" as const },
  ];
  const slice = pool.slice(0, Math.max(1, personaCount));
  const share = 1 / slice.length;
  return {
    creator_persona: {
      content_description: "a person",
      context: "ctx",
      writing_style_sample: "sample",
      format_signature: "fmt",
    },
    audience: {
      follower_tier: null,
      maturity: "growing",
      temperature_mix: { cold: 0.2, warm: 0.5, hot: 0.3 },
      interest_tags: ["x"],
      what_resonates: "r",
      what_falls_flat: "f",
      persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
      personas: slice.map((p) => ({
        ...p,
        share,
        reaction_frame: "judges directly",
        evidence: "verbatim quote",
      })),
    },
    summary: "a read",
    provenance: {
      handle: "",
      scraped_at: "1970-01-01T00:00:00Z",
      videos_analyzed: 0,
      videos_watched: 0,
      sub_coverage: "evidence",
    },
  };
}

function makeSavedAudience(id: string): Audience {
  return {
    id,
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
    personas: [],
    profile: null,
    calibration: null,
    created_at: "2026-06-28T00:00:00Z",
    updated_at: "2026-06-28T00:00:00Z",
  };
}

const FLASH_READ = {
  subjectName: "Alex",
  identity: { traits: ["assertive"], commStyle: "direct", drivers: ["control"] },
  tells: [{ tell: "pushes deadlines", evidence: "close by Friday or I walk" }],
  howTheyReact: "reacts defensively to pressure",
  goalScope: "close the deal",
  caveat: "Directional read drawn from limited evidence.",
};

const MAX_READ = {
  ...FLASH_READ,
  forensic: {
    deceptionLikelihood: "Medium",
    cues: [{ timestamp: "0:42", observation: "shoulder shift", inference: "discomfort" }],
  },
};

function mockReadReturns(json: unknown) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(json) } }],
  });
}

function flashStimulus(): Stimulus {
  return {
    kind: "text",
    content: EVIDENCE_SENTINEL,
    source: { origin: "text" },
    tier: "flash",
    subject: { isProfiledSubject: true, goal: GOAL_SENTINEL },
  };
}

function maxStimulus(): Stimulus {
  return {
    kind: "video",
    content: "",
    source: { origin: "video", storagePath: "user-1/clip.mp4" },
    tier: "max",
    subject: { isProfiledSubject: true, goal: GOAL_SENTINEL },
  };
}

const fakeSupabase = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runProfile — tier-gated forensic (D-03)", () => {
  it("flash tier: forensic null/absent + model sim1-flash", async () => {
    mockReadReturns(FLASH_READ);
    const bake = vi.fn(async () => ({ signature: makeSignature(1), subjectKind: "person" as const }));
    const saveAudience = vi.fn(async (_supabase: unknown, _input: Partial<Audience>) => makeSavedAudience("aud-1"));

    const block = await runProfile(
      { supabase: fakeSupabase, stimulus: flashStimulus() },
      { bake, saveAudience },
    );

    expect(block.props.forensic ?? null).toBeNull();
    expect(block.props.model).toBe("sim1-flash");
  });

  it("max tier (person-video): forensic present + model sim1-max", async () => {
    mockReadReturns(MAX_READ);
    const bake = vi.fn(async () => ({ signature: makeSignature(1), subjectKind: "person" as const }));
    const saveAudience = vi.fn(async (_supabase: unknown, _input: Partial<Audience>) => makeSavedAudience("aud-2"));
    const watch = vi.fn(async () => ({ signal: "at 0:42 a shoulder shift", transcript: "spoken words" }));

    const block = await runProfile(
      { supabase: fakeSupabase, stimulus: maxStimulus() },
      { bake, saveAudience, watch },
    );

    expect(block.props.forensic).not.toBeNull();
    expect(block.props.forensic?.deceptionLikelihood).toBe("Medium");
    expect(block.props.forensic?.cues[0]?.timestamp).toBe("0:42");
    expect(block.props.model).toBe("sim1-max");
    expect(watch).toHaveBeenCalledWith("user-1/clip.mp4", GOAL_SENTINEL);
  });
});

describe("runProfile — D-08 isolation + Pitfall 1 model routing", () => {
  it("READ system carries no user bytes; flash READ uses QWEN_REASONING_MODEL (never omni)", async () => {
    mockReadReturns(FLASH_READ);
    const bake = vi.fn(async () => ({ signature: makeSignature(1), subjectKind: "person" as const }));
    const saveAudience = vi.fn(async (_supabase: unknown, _input: Partial<Audience>) => makeSavedAudience("aud-3"));

    await runProfile({ supabase: fakeSupabase, stimulus: flashStimulus() }, { bake, saveAudience });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const params = mockCreate.mock.calls[0]![0] as {
      model: string;
      messages: { role: string; content: string }[];
    };

    // Pitfall 1: flash READ rides the reasoning model, NEVER omni.
    expect(params.model).toBe(QWEN_REASONING_MODEL);
    expect(params.model).not.toBe(QWEN_OMNI_MODEL);

    const system = params.messages[0]!.content;
    const user = params.messages[1]!.content;

    // System is the cached behavioral prompt byte-for-byte (no user bytes — D-08).
    expect(system).toBe(BEHAVIORAL_SYSTEM_PROMPT_FLASH);
    expect(system).not.toContain(EVIDENCE_SENTINEL);
    expect(system).not.toContain(GOAL_SENTINEL);

    // Untrusted evidence + goal live ONLY in the USER data block.
    expect(user).toContain(EVIDENCE_SENTINEL);
    expect(user).toContain(GOAL_SENTINEL);
  });

  it("max READ uses BEHAVIORAL_SYSTEM_PROMPT_MAX as the byte-stable system message", async () => {
    mockReadReturns(MAX_READ);
    const bake = vi.fn(async () => ({ signature: makeSignature(1), subjectKind: "person" as const }));
    const saveAudience = vi.fn(async (_supabase: unknown, _input: Partial<Audience>) => makeSavedAudience("aud-4"));
    const watch = vi.fn(async () => ({ signal: "cue", transcript: "words" }));

    await runProfile({ supabase: fakeSupabase, stimulus: maxStimulus() }, { bake, saveAudience, watch });

    const params = mockCreate.mock.calls[0]![0] as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(params.model).toBe(QWEN_OMNI_MODEL);
    expect(params.messages[0]!.content).toBe(BEHAVIORAL_SYSTEM_PROMPT_MAX);
  });
});

describe("runProfile — saved General SIM + subjectKind marker (PROF-03 / D-02)", () => {
  it("saves via createAudience(mode:general); block carries savedAudienceId + Directional tier", async () => {
    mockReadReturns(FLASH_READ);
    const bake = vi.fn(async () => ({ signature: makeSignature(1), subjectKind: "person" as const }));
    const saveAudience = vi.fn(async (_supabase: unknown, _input: Partial<Audience>) => makeSavedAudience("aud-saved-99"));

    const block = await runProfile(
      { supabase: fakeSupabase, stimulus: flashStimulus() },
      { bake, saveAudience },
    );

    expect(saveAudience).toHaveBeenCalledTimes(1);
    const [, payload] = saveAudience.mock.calls[0]!;
    expect(payload.mode).toBe("general");
    expect(block.props.savedAudienceId).toBe("aud-saved-99");
    expect(block.props.tier).toBe("Directional");
  });

  it("persists the reserved subjectKind marker; a person bake with >1 persona STILL notes 'person' (Pitfall 2)", async () => {
    mockReadReturns(FLASH_READ);
    // person bake that produced 3 personas — must NOT mis-branch to "panel".
    const bake = vi.fn(async () => ({ signature: makeSignature(3), subjectKind: "person" as const }));
    const saveAudience = vi.fn(async (_supabase: unknown, _input: Partial<Audience>) => makeSavedAudience("aud-5"));

    await runProfile({ supabase: fakeSupabase, stimulus: flashStimulus() }, { bake, saveAudience });

    const [, payload] = saveAudience.mock.calls[0]!;
    const marker = (payload.custom_context ?? []).find(
      (c) => c.persona_evidence_link === "__subject_kind",
    );
    expect(marker).toBeDefined();
    expect(marker!.note).toBe("person");
    expect(marker!.source).toBe("user");
  });
});

describe("runProfile — block validity", () => {
  it("emits a ProfileReadBlockSchema-valid block", async () => {
    mockReadReturns(FLASH_READ);
    const bake = vi.fn(async () => ({ signature: makeSignature(1), subjectKind: "person" as const }));
    const saveAudience = vi.fn(async (_supabase: unknown, _input: Partial<Audience>) => makeSavedAudience("aud-6"));

    const block = await runProfile(
      { supabase: fakeSupabase, stimulus: flashStimulus() },
      { bake, saveAudience },
    );

    expect(ProfileReadBlockSchema.safeParse(block).success).toBe(true);
    expect(block.props.subjectKind).toBe("person");
  });
});
