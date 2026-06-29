/**
 * route.test.ts — POST /api/tools/predict security + honesty-guard spine (Wave 0, → 06-06).
 *
 * RED by design: imports `POST` from `@/app/api/tools/predict/route`, which does NOT exist
 * until 06-06 (module-not-found = the intended Nyquist RED). 06-06 turns it GREEN.
 *
 * Locks the route contract (mirrors simulate/route.test + the D-08 / WR-03 fold):
 *   - no user → 401 (before any getAudience / runPredict);
 *   - bad/missing CSRF content-type → 415;
 *   - empty scenario → 400;
 *   - `audience.mode !== "general"` → 400 `predict_requires_general_panel` (D-03);
 *   - a person-marked audience → 400 `predict_requires_panel` + a redirect nudge body (D-03);
 *   - the DEFAULT `template-analyst` (mode general, `custom_context:[]`, NO marker) is NOT
 *     mis-rejected — it proceeds past the guards and runs (Pattern 4 landmine / Pitfall 3);
 *   - a thrown internal error → a GENERIC 500 that NEVER echoes `err.message` (WR-02).
 *
 * getAudience / normalizeStimulus / runPredict are mocked — no LLM/DB runs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Audience } from "@/lib/audience/audience-types";
import type { Stimulus } from "@/lib/engine/stimulus/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/threads/threads", () => ({ createOpenThreadLazy: vi.fn() }));
vi.mock("@/lib/threads/messages", () => ({ insertMessage: vi.fn() }));
vi.mock("@/lib/engine/stimulus/normalize", () => ({ normalizeStimulus: vi.fn() }));
vi.mock("@/lib/audience/audience-repo", () => ({ getAudience: vi.fn() }));
// Partial-mock: stub only the networked `runPredict`; keep the REAL pure, deterministic
// `readSubjectKind` export (the route imports it for its person-reject — D-03/D-08). Mocking
// the marker helper out would defeat the very person/template-analyst distinction under test.
vi.mock("@/lib/tools/runners/predict-runner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tools/runners/predict-runner")>();
  return { ...actual, runPredict: vi.fn() };
});
vi.mock("@/lib/kc/kc-stamp", () => ({ kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })) }));

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { normalizeStimulus } from "@/lib/engine/stimulus/normalize";
import { getAudience } from "@/lib/audience/audience-repo";
import { runPredict } from "@/lib/tools/runners/predict-runner";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateOpenThreadLazy = createOpenThreadLazy as ReturnType<typeof vi.fn>;
const mockInsertMessage = insertMessage as ReturnType<typeof vi.fn>;
const mockNormalizeStimulus = normalizeStimulus as ReturnType<typeof vi.fn>;
const mockGetAudience = getAudience as ReturnType<typeof vi.fn>;
const mockRunPredict = runPredict as ReturnType<typeof vi.fn>;

// ─── Helpers ────────────────────────────────────────────────────────────────────────

function makeSupabase(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

/** A General panel with an optional subjectKind marker / mode override. */
function makeAudience(over: Partial<Audience> = {}): Audience {
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
    persona_weights: { fyp: 0.25, niche: 0.25, loyalist: 0.25, cross_niche: 0.25 },
    personas: [],
    profile: null,
    calibration: null,
    custom_context: [],
    created_at: "2026-06-29T00:00:00Z",
    updated_at: "2026-06-29T00:00:00Z",
    ...over,
  } as unknown as Audience;
}

function makeStimulus(): Stimulus {
  return { kind: "text", content: "a scenario", source: { origin: "text" }, tier: "flash" };
}

function makePredictBlock() {
  return {
    type: "prediction-gauge" as const,
    props: {
      audienceName: "Analyst Panel",
      scenario: "a scenario",
      band: "Lean yes",
      range: { min: 35, max: 90 },
      confidence: "Medium",
      factors: [{ analystArchetype: "tough_crowd", driver: "x", direction: "against" }],
      panel: [{ archetype: "tough_crowd", lean: "lean_no", reasoning: "r" }],
      assumptions: [],
      successCriterion: null,
      caveat: "Directional — a synthetic panel, not a guarantee.",
      model: "sim1-flash",
      tier: "Directional",
    },
  };
}

async function callPOST(body: unknown, headers?: Record<string, string>): Promise<Response> {
  const { POST } = await import("../route");
  const req = new Request("http://localhost/api/tools/predict", {
    method: "POST",
    headers: headers ?? { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
  mockCreateOpenThreadLazy.mockResolvedValue({ id: "thread-1", type: "open", user_id: "user-1" });
  mockInsertMessage.mockResolvedValue(undefined);
  mockNormalizeStimulus.mockResolvedValue(makeStimulus());
  mockGetAudience.mockResolvedValue(makeAudience());
  mockRunPredict.mockResolvedValue(makePredictBlock());
});

// ─── Auth gate ────────────────────────────────────────────────────────────────────

describe("POST /api/tools/predict — auth gate", () => {
  it("returns 401 when not authenticated, before any getAudience / runPredict", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null));
    const res = await callPOST({ audienceId: "template-analyst", scenario: "a scenario" });
    expect(res.status).toBe(401);
    expect(mockGetAudience).not.toHaveBeenCalled();
    expect(mockRunPredict).not.toHaveBeenCalled();
  });
});

// ─── CSRF guard ───────────────────────────────────────────────────────────────────

describe("POST /api/tools/predict — CSRF guard", () => {
  it("returns 415 on a non-application/json content-type", async () => {
    const res = await callPOST(
      { audienceId: "template-analyst", scenario: "a scenario" },
      { "content-type": "text/plain" },
    );
    expect(res.status).toBe(415);
    expect(mockRunPredict).not.toHaveBeenCalled();
  });
});

// ─── Scenario cap ───────────────────────────────────────────────────────────────────

describe("POST /api/tools/predict — scenario validation", () => {
  it("returns 400 on an empty scenario and does NOT run", async () => {
    const res = await callPOST({ audienceId: "template-analyst", scenario: "   " });
    expect(res.status).toBe(400);
    expect(mockRunPredict).not.toHaveBeenCalled();
  });
});

// ─── D-03 panel guards (the WR-03 fold — 400, never 500) ────────────────────────────

describe("POST /api/tools/predict — panel guards (D-03)", () => {
  it("returns 400 predict_requires_general_panel when mode !== general", async () => {
    mockGetAudience.mockResolvedValue(makeAudience({ mode: "socials" }));
    const res = await callPOST({ audienceId: "aud-socials", scenario: "a scenario" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("predict_requires_general_panel");
    expect(mockRunPredict).not.toHaveBeenCalled();
  });

  it("returns 400 predict_requires_panel + a nudge body for a person-marked SIM", async () => {
    mockGetAudience.mockResolvedValue(
      makeAudience({
        custom_context: [
          { source: "user", persona_evidence_link: "__subject_kind", note: "person" },
        ],
      } as Partial<Audience>),
    );
    const res = await callPOST({ audienceId: "aud-person", scenario: "a scenario" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("predict_requires_panel");
    expect(typeof data.message).toBe("string");
    expect(data.message.length).toBeGreaterThan(0);
    expect(mockRunPredict).not.toHaveBeenCalled();
  });

  it("does NOT mis-reject the default template-analyst (general, no marker) — it runs (Pitfall 3)", async () => {
    // Default Analyst Panel: mode general, custom_context [] → no __subject_kind marker.
    const res = await callPOST({ audienceId: "template-analyst", scenario: "a scenario" });
    expect(res.status).toBe(200);
    expect(mockRunPredict).toHaveBeenCalledTimes(1);
    const data = await res.json();
    expect(data.block.type).toBe("prediction-gauge");
  });
});

// ─── Generic 500 (WR-02 — no err.message echo) ──────────────────────────────────────

describe("POST /api/tools/predict — internal error", () => {
  it("returns a generic 500 that NEVER echoes the thrown err.message", async () => {
    const secret = "SECRET_DB_DETAIL_xyz";
    mockRunPredict.mockRejectedValue(new Error(secret));
    const res = await callPOST({ audienceId: "template-analyst", scenario: "a scenario" });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(JSON.stringify(data)).not.toContain(secret);
  });
});
