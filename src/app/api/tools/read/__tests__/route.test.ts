/**
 * route.test.ts — POST /api/tools/read tests (Plan 12-03, Task 2).
 *
 * Locks the NEW arbitrary explicit two-audience pair path (AUD-EDIT-02 / D-05) added
 * to the read route, alongside the shipped active-vs-General default path (08-06).
 *
 * Tests:
 *   - Arbitrary pair: POST { concept, audienceIds: [a, b] } → 200 { block }, and
 *     runTwoAudienceRead is called with the TWO resolved audiences (both ids resolved
 *     via getAudience — NOT General-as-second).
 *   - Bad explicit id: POST { concept, audienceIds: [a, missing] } → 400
 *     { error: "audience_not_found" } and runTwoAudienceRead is NOT called (no silent
 *     General fallback for an explicit pick, CR-01).
 *   - Default path preserved: POST { concept } with no audienceIds → 200 (the shipped
 *     active-vs-General path still runs).
 *   - Unauthorized: no user → 401 (auth-first, T-03-07).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Audience } from "@/lib/audience/audience-types";
import type { MultiAudienceReadBlock } from "@/lib/tools/blocks";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/audience/audience-repo", () => ({
  getAudience: vi.fn(),
  // GENERAL_AUDIENCE is imported by the route's default path — provide a stub sentinel.
  GENERAL_AUDIENCE: {
    id: "general",
    user_id: "__virtual__",
    name: "General",
    type: "target",
    platform: "tiktok",
    goal_label: null,
    goal_intent: null,
    is_general: true,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [],
    profile: null,
    calibration: null,
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  } satisfies Audience,
}));

vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
}));

vi.mock("@/lib/threads/messages", () => ({
  insertMessage: vi.fn(),
}));

vi.mock("@/lib/engine/flash/two-audience-read", () => ({
  runTwoAudienceRead: vi.fn(),
}));

vi.mock("@/lib/kc/kc-stamp", () => ({
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
}));

import { createClient } from "@/lib/supabase/server";
import { getAudience } from "@/lib/audience/audience-repo";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runTwoAudienceRead } from "@/lib/engine/flash/two-audience-read";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockGetAudience = getAudience as ReturnType<typeof vi.fn>;
const mockCreateOpenThreadLazy = createOpenThreadLazy as ReturnType<typeof vi.fn>;
const mockInsertMessage = insertMessage as ReturnType<typeof vi.fn>;
const mockRunTwoAudienceRead = runTwoAudienceRead as ReturnType<typeof vi.fn>;

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

/** A distinct calibrated audience for a given id (NOT General). */
function makeAudience(id: string, name: string): Audience {
  return {
    id,
    user_id: "user-1",
    name,
    type: "target",
    platform: "tiktok",
    goal_label: "Grow my following",
    goal_intent: "grow",
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.5, niche: 0.3, loyalist: 0.15, cross_niche: 0.05 },
    personas: [],
    profile: null,
    calibration: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

/** A deterministic 2-entry multi-audience-read block (no real Flash call). */
function makeReadBlock(): MultiAudienceReadBlock {
  return {
    type: "multi-audience-read",
    props: {
      audiences: [
        {
          name: "Audience A",
          band: "Strong",
          fraction: "8/10 stop",
          interpretation: "Audience A wins (Strong) — Audience B bombs (Weak).",
          lever: "Strong for Audience A. To also land Audience B, add a beat.",
          whoNotFor: "",
          personas: [],
        },
        {
          name: "Audience B",
          band: "Weak",
          fraction: "2/10 stop",
          interpretation: "Audience B bombs (Weak) — Audience A wins (Strong).",
          lever: "Soft for Audience B. Keep what works for Audience A.",
          whoNotFor: "",
          personas: [],
        },
      ],
      model: "sim1-flash",
    },
  };
}

async function callPOST(body: unknown): Promise<Response> {
  const { POST } = await import("../route");
  // Content-Type application/json satisfies the csrf-guard; no Origin header so the
  // cross-origin check is skipped (csrfGuard returns null when Origin is absent).
  const req = new Request("http://localhost/api/tools/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  // Default-good wiring: authed user, an open thread (no pinned audience → General),
  // a no-op insert, and a deterministic Read block.
  mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
  mockCreateOpenThreadLazy.mockResolvedValue({
    id: "thread-1",
    type: "open",
    user_id: "user-1",
    reading_id: null,
    active_audience_id: null,
  });
  mockInsertMessage.mockResolvedValue(undefined);
  mockRunTwoAudienceRead.mockResolvedValue(makeReadBlock());
});

describe("POST /api/tools/read — auth gate (T-03-07)", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null));

    const res = await callPOST({ concept: "a calm morning routine", audienceIds: ["aud-a", "aud-b"] });

    expect(res.status).toBe(401);
    expect(mockRunTwoAudienceRead).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/read — arbitrary explicit pair (AUD-EDIT-02)", () => {
  it("resolves BOTH ids and runs the pair (not General-as-second)", async () => {
    const audA = makeAudience("aud-a", "Audience A");
    const audB = makeAudience("aud-b", "Audience B");
    mockGetAudience.mockImplementation(async (_supabase: unknown, id: string) =>
      id === "aud-a" ? audA : id === "aud-b" ? audB : null,
    );

    const res = await callPOST({ concept: "a calm morning routine", audienceIds: ["aud-a", "aud-b"] });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("block");
    expect(body.block.type).toBe("multi-audience-read");

    // Both explicit ids were resolved via getAudience.
    expect(mockGetAudience).toHaveBeenCalledWith(expect.anything(), "aud-a");
    expect(mockGetAudience).toHaveBeenCalledWith(expect.anything(), "aud-b");

    // runTwoAudienceRead received the concept + the TWO resolved audiences —
    // NOT General as the second (the arbitrary-pair contract).
    expect(mockRunTwoAudienceRead).toHaveBeenCalledTimes(1);
    const [concept, audiences] = mockRunTwoAudienceRead.mock.calls[0]!;
    expect(concept).toBe("a calm morning routine");
    expect(audiences).toHaveLength(2);
    expect(audiences[0].id).toBe("aud-a");
    expect(audiences[1].id).toBe("aud-b");
    expect(audiences[1].is_general).toBe(false);

    // The Read block is persisted to the open thread.
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/tools/read — bad explicit id (no silent General fallback, CR-01)", () => {
  it("returns 400 audience_not_found and does NOT run the Read", async () => {
    const audA = makeAudience("aud-a", "Audience A");
    mockGetAudience.mockImplementation(async (_supabase: unknown, id: string) =>
      id === "aud-a" ? audA : null,
    );

    const res = await callPOST({ concept: "a calm morning routine", audienceIds: ["aud-a", "missing"] });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "audience_not_found" });

    // No Read run and no persistence for an unresolved explicit pick.
    expect(mockRunTwoAudienceRead).not.toHaveBeenCalled();
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/read — default path preserved (08-06 smoke)", () => {
  it("runs the active-vs-General path when no audienceIds are supplied", async () => {
    // No audienceIds → default path. active_audience_id is null → General active.
    const res = await callPOST({ concept: "a calm morning routine" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("block");

    // The default path did not break: the Read ran exactly once.
    expect(mockRunTwoAudienceRead).toHaveBeenCalledTimes(1);
    const [, audiences] = mockRunTwoAudienceRead.mock.calls[0]!;
    expect(audiences).toHaveLength(2);
  });

  it("returns 400 when concept is missing (default-path validation intact)", async () => {
    const res = await callPOST({});

    expect(res.status).toBe(400);
    expect(mockRunTwoAudienceRead).not.toHaveBeenCalled();
  });
});
