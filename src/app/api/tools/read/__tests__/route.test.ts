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
 *   - Default path (P3): POST { concept } with no audienceIds reads the SELECTED
 *     audience ALONE — the pinned audience when the thread carries one, General when
 *     nothing is pinned. NEVER a forced [active, General] pair (the killed double-score).
 *   - Orphaned pin (P3): a pinned id whose row is GONE falls back to General AND the
 *     block carries fallback: "audience-removed" — said out loud, never silent. A
 *     transient getAudience THROW keeps the silent General fallback (not "removed").
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
    mode: "general",
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
    mode: "socials",
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

describe("POST /api/tools/read — single-audience default (P3)", () => {
  it("reads General ALONE when nothing is pinned — no forced pair", async () => {
    // No audienceIds → default path. active_audience_id is null → General, alone.
    const res = await callPOST({ concept: "a calm morning routine" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("block");

    // ONE audience reaches the runner. The old route always passed [active, General].
    expect(mockRunTwoAudienceRead).toHaveBeenCalledTimes(1);
    const [, audiences] = mockRunTwoAudienceRead.mock.calls[0]!;
    expect(audiences).toHaveLength(1);
    expect(audiences[0].is_general).toBe(true);
  });

  it("reads the PINNED audience alone — General is not dragged in as a second side", async () => {
    const pinned = makeAudience("aud-pinned", "Growth");
    mockCreateOpenThreadLazy.mockResolvedValue({
      id: "thread-1",
      type: "open",
      user_id: "user-1",
      reading_id: null,
      active_audience_id: "aud-pinned",
    });
    mockGetAudience.mockImplementation(async (_supabase: unknown, id: string) =>
      id === "aud-pinned" ? pinned : null,
    );

    const res = await callPOST({ concept: "a calm morning routine" });

    expect(res.status).toBe(200);
    // The killed double-score: exactly ONE audience, the pinned one, no General.
    const [, audiences] = mockRunTwoAudienceRead.mock.calls[0]!;
    expect(audiences).toHaveLength(1);
    expect(audiences[0].id).toBe("aud-pinned");
    // And no fallback marker — the pin resolved.
    const body = await res.json();
    expect(body.block.props.fallback).toBeUndefined();
  });

  it("returns 400 when concept is missing (default-path validation intact)", async () => {
    const res = await callPOST({});

    expect(res.status).toBe(400);
    expect(mockRunTwoAudienceRead).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/read — orphaned pin says so out loud (P3)", () => {
  it("marks the block fallback: 'audience-removed' when the pinned row is GONE", async () => {
    mockCreateOpenThreadLazy.mockResolvedValue({
      id: "thread-1",
      type: "open",
      user_id: "user-1",
      reading_id: null,
      active_audience_id: "aud-deleted",
    });
    // getAudience resolves NULL — the row was deleted (or the account disconnected).
    mockGetAudience.mockResolvedValue(null);

    const res = await callPOST({ concept: "a calm morning routine" });

    expect(res.status).toBe(200);
    const body = await res.json();

    // Fell back to General — but SAID SO on the block, not silently.
    const [, audiences] = mockRunTwoAudienceRead.mock.calls[0]!;
    expect(audiences).toHaveLength(1);
    expect(audiences[0].is_general).toBe(true);
    expect(body.block.props.fallback).toBe("audience-removed");

    // The persisted block carries the marker too (what the thread re-renders).
    const [, , persistedBlocks] = mockInsertMessage.mock.calls[0]!;
    expect(persistedBlocks[0].props.fallback).toBe("audience-removed");
  });

  it("does NOT claim 'removed' on a transient load error — silent General fallback (D-04)", async () => {
    mockCreateOpenThreadLazy.mockResolvedValue({
      id: "thread-1",
      type: "open",
      user_id: "user-1",
      reading_id: null,
      active_audience_id: "aud-flaky",
    });
    // getAudience THROWS — a real DB error, not a missing row. The audience may
    // still exist, so "Audience removed" would be a false statement.
    mockGetAudience.mockRejectedValue(new Error("audiences get failed: timeout"));

    const res = await callPOST({ concept: "a calm morning routine" });

    expect(res.status).toBe(200);
    const body = await res.json();
    const [, audiences] = mockRunTwoAudienceRead.mock.calls[0]!;
    expect(audiences[0].is_general).toBe(true);
    expect(body.block.props.fallback).toBeUndefined();
  });
});
