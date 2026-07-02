/**
 * route.test.ts — POST /api/tools/simulate tests (Phase 5 Plan 05, Task 2).
 *
 * Locks the security spine + same-thread persistence of the Simulate route:
 *   - Unauthorized: no user → 401, BEFORE getAudience/normalizeStimulus/runSimulate (T-05-14).
 *   - Empty / over-cap message → 400 (T-05-16 / DoS), runSimulate not called.
 *   - Unresolvable audienceId → 400 audience_not_found (T-05-14), runSimulate not called.
 *   - Happy path → 200 { block } with block.type "reaction-distribution"; insertMessage once
 *     on the open thread (SIMU-03).
 *
 * getAudience + normalizeStimulus + runSimulate are mocked so no LLM/DB runs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactionDistributionBlock } from "@/lib/tools/profile-blocks";
import type { Stimulus } from "@/lib/engine/stimulus/types";
import type { Audience } from "@/lib/audience/audience-types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
}));

vi.mock("@/lib/threads/messages", () => ({
  insertMessage: vi.fn(),
}));

vi.mock("@/lib/engine/stimulus/normalize", () => ({
  normalizeStimulus: vi.fn(),
}));

vi.mock("@/lib/audience/audience-repo", () => ({
  getAudience: vi.fn(),
}));

vi.mock("@/lib/tools/runners/simulate-runner", () => ({
  runSimulate: vi.fn(),
}));

vi.mock("@/lib/kc/kc-stamp", () => ({
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
}));

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { normalizeStimulus } from "@/lib/engine/stimulus/normalize";
import { getAudience } from "@/lib/audience/audience-repo";
import { runSimulate } from "@/lib/tools/runners/simulate-runner";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateOpenThreadLazy = createOpenThreadLazy as ReturnType<typeof vi.fn>;
const mockInsertMessage = insertMessage as ReturnType<typeof vi.fn>;
const mockNormalizeStimulus = normalizeStimulus as ReturnType<typeof vi.fn>;
const mockGetAudience = getAudience as ReturnType<typeof vi.fn>;
const mockRunSimulate = runSimulate as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function makeAudience(): Audience {
  return {
    id: "aud-1",
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
    custom_context: [{ source: "user", persona_evidence_link: "__subject_kind", note: "person" }],
    created_at: "2026-06-28T00:00:00Z",
    updated_at: "2026-06-28T00:00:00Z",
  };
}

function makeReactionBlock(): ReactionDistributionBlock {
  return {
    type: "reaction-distribution",
    props: {
      audienceName: "Alex",
      subjectKind: "person",
      read: { verdict: "receptive", reasoning: "lands", quote: "sounds good" },
      model: "sim1-flash",
      tier: "Directional",
    },
  };
}

function makeStimulus(): Stimulus {
  return { kind: "text", content: "a reply", source: { origin: "text" }, tier: "flash" };
}

async function callPOST(body: unknown): Promise<Response> {
  const { POST } = await import("../route");
  const req = new Request("http://localhost/api/tools/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  mockRunSimulate.mockResolvedValue(makeReactionBlock());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/tools/simulate — auth gate (T-05-14)", () => {
  it("returns 401 when not authenticated, before any run", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null));

    const res = await callPOST({ audienceId: "aud-1", message: "a reply" });

    expect(res.status).toBe(401);
    expect(mockGetAudience).not.toHaveBeenCalled();
    expect(mockNormalizeStimulus).not.toHaveBeenCalled();
    expect(mockRunSimulate).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/simulate — message cap (T-05-16)", () => {
  it("returns 400 on empty message and does NOT run", async () => {
    const res = await callPOST({ audienceId: "aud-1", message: "   " });
    expect(res.status).toBe(400);
    expect(mockRunSimulate).not.toHaveBeenCalled();
  });

  it("returns 400 on over-cap message and does NOT run", async () => {
    const res = await callPOST({ audienceId: "aud-1", message: "x".repeat(2001) });
    expect(res.status).toBe(400);
    expect(mockRunSimulate).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/simulate — audience resolution (T-05-14)", () => {
  it("returns 400 audience_not_found on an unresolvable audienceId and does NOT run", async () => {
    mockGetAudience.mockResolvedValue(null);

    const res = await callPOST({ audienceId: "nope", message: "a reply" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("audience_not_found");
    expect(mockRunSimulate).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/simulate — audience eligibility (WR-03)", () => {
  it("returns 400 audience_not_eligible on a resolvable NON-General audience and does NOT run (not a 500)", async () => {
    // A socials-mode audience resolves fine but is ineligible for Simulate (Directional-only).
    // Pre-fix the runner threw → the route's catch mapped it to a 500; now it's a boundary 400.
    mockGetAudience.mockResolvedValue({ ...makeAudience(), mode: "socials" });

    const res = await callPOST({ audienceId: "aud-socials", message: "a reply" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("audience_not_eligible");
    expect(mockRunSimulate).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/simulate — happy path (SIMU-03)", () => {
  it("returns 200 { block } reaction-distribution and persists once to the open thread", async () => {
    const res = await callPOST({ audienceId: "aud-1", message: "Sounds good — Friday works." });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("block");
    expect(data.block.type).toBe("reaction-distribution");

    expect(mockRunSimulate).toHaveBeenCalledTimes(1);
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks] = mockInsertMessage.mock.calls[0]!;
    expect(threadId).toBe("thread-1");
    expect(role).toBe("assistant");
    expect(blocks[0].type).toBe("reaction-distribution");
  });
});
