/**
 * Phase 7 Plan 03 — audiences route tests (route.ts + [id]/route.ts + calibrate/route.ts).
 *
 * Assertions:
 *  - 401 when unauthenticated (all routes)
 *  - GET /api/audiences returns General+presets+user rows
 *  - POST /api/audiences: RLS-scoped create with session user_id (never body)
 *  - DELETE /api/audiences/general → refused (cannot_delete_general)
 *  - calibrate: thin → fallback event emitted (no createAudience call)
 *  - calibrate: success → createAudience called + done event emitted
 *  - calibrate: scrape_failed → error event emitted
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (required for vi.mock factories to access top-level vars) ──

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockListAudiences = vi.fn();
  const mockCreateAudience = vi.fn();
  const mockUpdateAudience = vi.fn();
  const mockDeleteAudience = vi.fn();
  const mockGetAudience = vi.fn();
  const mockCalibrateFromScrape = vi.fn();

  const GENERAL_AUDIENCE = {
    id: "general",
    user_id: "__virtual__",
    name: "General",
    type: "target",
    platform: "tiktok",
    goal_label: null,
    goal_intent: null,
    is_general: true,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
    personas: [],
    profile: null,
    calibration: null,
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  };

  const PRESET_AUDIENCES = [
    {
      id: "preset-growth",
      user_id: "__virtual__",
      name: "Growth Audience",
      type: "target",
      platform: "tiktok",
      goal_label: "Grow my following",
      goal_intent: "grow",
      is_general: false,
      is_preset: true,
      persona_weights: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
      personas: [],
      profile: null,
      calibration: null,
      created_at: "1970-01-01T00:00:00Z",
      updated_at: "1970-01-01T00:00:00Z",
    },
    {
      id: "preset-conversion",
      user_id: "__virtual__",
      name: "Conversion Audience",
      type: "target",
      platform: "tiktok",
      goal_label: "Drive sales & conversions",
      goal_intent: "sell",
      is_general: false,
      is_preset: true,
      persona_weights: { fyp: 0.30, niche: 0.55, loyalist: 0.10, cross_niche: 0.05 },
      personas: [],
      profile: null,
      calibration: null,
      created_at: "1970-01-01T00:00:00Z",
      updated_at: "1970-01-01T00:00:00Z",
    },
  ];

  return {
    mockGetUser,
    mockListAudiences,
    mockCreateAudience,
    mockUpdateAudience,
    mockDeleteAudience,
    mockGetAudience,
    mockCalibrateFromScrape,
    GENERAL_AUDIENCE,
    PRESET_AUDIENCES,
  };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mocks.mockGetUser },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    }),
  ),
}));

vi.mock("@/lib/audience/audience-repo", () => ({
  listAudiences: mocks.mockListAudiences,
  createAudience: mocks.mockCreateAudience,
  updateAudience: mocks.mockUpdateAudience,
  deleteAudience: mocks.mockDeleteAudience,
  getAudience: mocks.mockGetAudience,
  GENERAL_AUDIENCE: mocks.GENERAL_AUDIENCE,
  PRESET_AUDIENCES: mocks.PRESET_AUDIENCES,
  // mirror the real repo's sentinel set so the route's WR-05 virtual-delete guard resolves
  SENTINEL_IDS: new Set([
    mocks.GENERAL_AUDIENCE.id,
    ...mocks.PRESET_AUDIENCES.map((p) => p.id),
    "template-analyst",
    "template-hiring",
  ]),
}));

vi.mock("@/lib/audience/calibration", () => ({
  calibrateFromScrape: mocks.mockCalibrateFromScrape,
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET, POST } from "../route";
import { GET as GET_ID, PATCH, DELETE } from "../[id]/route";
import { POST as POST_CALIBRATE } from "../calibrate/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuthenticatedUser(id = "user-123") {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  });
}

function makeUnauthenticated() {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

/** Parse SSE stream into events */
async function parseSseEvents(
  response: Response,
): Promise<{ event: string; data: unknown }[]> {
  const text = await response.text();
  const events: { event: string; data: unknown }[] = [];
  const blocks = text.split("\n\n").filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "message";
    let data: unknown = null;
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      if (line.startsWith("data: ")) {
        try {
          data = JSON.parse(line.slice(6));
        } catch {
          data = line.slice(6);
        }
      }
    }
    events.push({ event, data });
  }
  return events;
}

// ─── Tests: GET /api/audiences ────────────────────────────────────────────────

describe("GET /api/audiences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    makeUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns audience list including General + presets + user rows", async () => {
    makeAuthenticatedUser();
    const mockAudiences = [
      { id: "general", name: "General" },
      { id: "preset-growth", name: "Growth Audience" },
      { id: "preset-conversion", name: "Conversion Audience" },
      { id: "user-aud-1", name: "My Audience" },
    ];
    mocks.mockListAudiences.mockResolvedValue(mockAudiences);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audiences).toHaveLength(4);
    expect(body.audiences[0].id).toBe("general");
  });
});

// ─── Tests: POST /api/audiences ───────────────────────────────────────────────

describe("POST /api/audiences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    makeUnauthenticated();
    const req = new Request("http://localhost/api/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Audience", type: "target", platform: "tiktok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates an audience with session user_id (never from body)", async () => {
    makeAuthenticatedUser("session-user-id");
    const created = {
      id: "new-aud-uuid",
      user_id: "session-user-id",
      name: "My Audience",
      type: "target",
      platform: "tiktok",
      goal_intent: "grow",
      is_general: false,
      is_preset: false,
      persona_weights: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
      personas: [],
      profile: null,
      calibration: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mocks.mockCreateAudience.mockResolvedValue(created);

    const req = new Request("http://localhost/api/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Audience",
        type: "target",
        platform: "tiktok",
        goal_intent: "grow",
        user_id: "attacker-user-id", // should be ignored — never from body
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.audience.user_id).toBe("session-user-id");
    expect(mocks.mockCreateAudience).toHaveBeenCalledOnce();
  });

  it("returns 400 for invalid input (missing required name)", async () => {
    makeAuthenticatedUser();
    const req = new Request("http://localhost/api/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "target", platform: "tiktok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_audience_input");
  });

  it("returns 400 for weights that don't sum to 1.0", async () => {
    makeAuthenticatedUser();
    const req = new Request("http://localhost/api/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad Audience",
        type: "target",
        platform: "tiktok",
        persona_weights: { fyp: 0.5, niche: 0.5, loyalist: 0.5, cross_niche: 0.5 },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("accepts + sanitizes mode / success_criterion / custom_context into the create payload (POP-05/TRUST-02)", async () => {
    makeAuthenticatedUser("session-user-id");
    mocks.mockCreateAudience.mockResolvedValue({ id: "new-aud", user_id: "session-user-id" });

    const req = new Request("http://localhost/api/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "General Audience",
        type: "target",
        platform: "tiktok",
        mode: "general",
        success_criterion: "  Engagement over reach  ", // control char + outer ws
        custom_context: [
          { source: "user", note: "  Founder-led  brand  ", persona_evidence_link: "skeptic" },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const passed = mocks.mockCreateAudience.mock.calls[0]![1] as {
      mode: string;
      success_criterion: string;
      custom_context: { source: string; note: string }[];
    };
    expect(passed.mode).toBe("general");
    // sanitizeText strips control chars + trims
    expect(passed.success_criterion).toBe("Engagement over reach");
    expect(passed.custom_context[0]!.source).toBe("user");
    expect(passed.custom_context[0]!.note).toBe("Founder-led brand");
  });

  it("rejects an over-cap custom_context array (>50 entries, T-03-14)", async () => {
    makeAuthenticatedUser();
    const tooMany = Array.from({ length: 51 }, () => ({ source: "user", note: "x" }));
    const req = new Request("http://localhost/api/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "DoS Audience",
        type: "target",
        platform: "tiktok",
        custom_context: tooMany,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects an over-length success_criterion (>2000 chars, T-03-12)", async () => {
    makeAuthenticatedUser();
    const req = new Request("http://localhost/api/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Long Audience",
        type: "target",
        platform: "tiktok",
        success_criterion: "a".repeat(2001),
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── Tests: GET /api/audiences/[id] ──────────────────────────────────────────

describe("GET /api/audiences/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    makeUnauthenticated();
    const req = new Request("http://localhost/api/audiences/some-id", { method: "GET" });
    const res = await GET_ID(req, { params: Promise.resolve({ id: "some-id" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when audience not found", async () => {
    makeAuthenticatedUser();
    mocks.mockGetAudience.mockResolvedValue(null);
    const req = new Request("http://localhost/api/audiences/nonexistent", { method: "GET" });
    const res = await GET_ID(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("returns the audience when found", async () => {
    makeAuthenticatedUser();
    const aud = { id: "aud-uuid", name: "My Audience" };
    mocks.mockGetAudience.mockResolvedValue(aud);
    const req = new Request("http://localhost/api/audiences/aud-uuid", { method: "GET" });
    const res = await GET_ID(req, { params: Promise.resolve({ id: "aud-uuid" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audience.id).toBe("aud-uuid");
  });
});

// ─── Tests: PATCH /api/audiences/[id] ────────────────────────────────────────

describe("PATCH /api/audiences/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    makeUnauthenticated();
    const req = new Request("http://localhost/api/audiences/aud-uuid", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "aud-uuid" }) });
    expect(res.status).toBe(401);
  });

  it("updates an audience and returns it", async () => {
    makeAuthenticatedUser();
    const updated = { id: "aud-uuid", name: "Updated Name" };
    mocks.mockUpdateAudience.mockResolvedValue(updated);
    const req = new Request("http://localhost/api/audiences/aud-uuid", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "aud-uuid" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audience.name).toBe("Updated Name");
  });

  it("accepts + sanitizes success_criterion / custom_context on PATCH (POP-05/TRUST-02)", async () => {
    makeAuthenticatedUser();
    mocks.mockUpdateAudience.mockResolvedValue({ id: "aud-uuid", name: "X" });

    const req = new Request("http://localhost/api/audiences/aud-uuid", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success_criterion: "  Saves over likes  ",
        custom_context: [{ source: "user", note: "  Niche founder  " }],
      }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "aud-uuid" }) });
    expect(res.status).toBe(200);

    const passed = mocks.mockUpdateAudience.mock.calls[0]![2] as {
      success_criterion: string;
      custom_context: { source: string; note: string }[];
    };
    expect(passed.success_criterion).toBe("Saves over likes");
    expect(passed.custom_context[0]!.note).toBe("Niche founder");
  });

  it("rejects an over-cap custom_context array on PATCH (>50 entries, T-03-14)", async () => {
    makeAuthenticatedUser();
    const tooMany = Array.from({ length: 51 }, () => ({ source: "user", note: "x" }));
    const req = new Request("http://localhost/api/audiences/aud-uuid", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_context: tooMany }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "aud-uuid" }) });
    expect(res.status).toBe(400);
  });
});

// ─── Tests: DELETE /api/audiences/[id] ───────────────────────────────────────

describe("DELETE /api/audiences/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    makeUnauthenticated();
    const req = new Request("http://localhost/api/audiences/some-id", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "some-id" }) });
    expect(res.status).toBe(401);
  });

  it("refuses DELETE on General sentinel (D-04 — cannot delete locked default)", async () => {
    makeAuthenticatedUser();
    const req = new Request("http://localhost/api/audiences/general", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "general" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("cannot_delete_virtual");
  });

  it("refuses DELETE on preset + general-template sentinels with a clean 400 (WR-05)", async () => {
    makeAuthenticatedUser();
    for (const id of ["preset-growth", "template-analyst"]) {
      const req = new Request(`http://localhost/api/audiences/${id}`, { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id }) });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("cannot_delete_virtual");
    }
    // never reaches the repo — refused at the route layer (was a generic 500 before)
    expect(mocks.mockDeleteAudience).not.toHaveBeenCalled();
  });

  it("deletes a user-owned audience successfully", async () => {
    makeAuthenticatedUser();
    mocks.mockDeleteAudience.mockResolvedValue(undefined);
    const req = new Request("http://localhost/api/audiences/user-aud-uuid", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "user-aud-uuid" }) });
    expect(res.status).toBe(204);
  });
});

// ─── Tests: POST /api/audiences/calibrate ────────────────────────────────────

describe("POST /api/audiences/calibrate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    makeUnauthenticated();
    const req = new Request("http://localhost/api/audiences/calibrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: "creator",
        type: "personal",
        platform: "tiktok",
        goalIntent: "grow",
        name: "Test",
      }),
    });
    const res = await POST_CALIBRATE(req);
    expect(res.status).toBe(401);
  });

  it("emits fallback event on thin data (no createAudience call)", async () => {
    makeAuthenticatedUser();
    mocks.mockCalibrateFromScrape.mockResolvedValue({
      fallback: "general",
      reason: "thin",
    });

    const req = new Request("http://localhost/api/audiences/calibrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: "testcreator",
        type: "personal",
        platform: "tiktok",
        goalIntent: "grow",
        name: "My Audience",
      }),
    });

    const res = await POST_CALIBRATE(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const events = await parseSseEvents(res);
    const fallbackEvent = events.find((e) => e.event === "fallback");
    expect(fallbackEvent).toBeDefined();
    expect((fallbackEvent!.data as { reason: string }).reason).toBe("thin");

    // Honesty spine: createAudience must NOT be called on fallback path
    expect(mocks.mockCreateAudience).not.toHaveBeenCalled();
  });

  it("emits error event on scrape_failed", async () => {
    makeAuthenticatedUser();
    mocks.mockCalibrateFromScrape.mockResolvedValue({
      error: "scrape_failed",
      message: "Network timeout",
    });

    const req = new Request("http://localhost/api/audiences/calibrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: "testcreator",
        type: "personal",
        platform: "tiktok",
        goalIntent: "grow",
        name: "My Audience",
      }),
    });

    const res = await POST_CALIBRATE(req);
    const events = await parseSseEvents(res);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    expect(mocks.mockCreateAudience).not.toHaveBeenCalled();
  });

  it("emits status events + done event with persisted audience on success", async () => {
    makeAuthenticatedUser();

    const mockAudienceInput = {
      user_id: "",
      name: "My Audience",
      type: "personal" as const,
      platform: "tiktok" as const,
      goal_label: null,
      goal_intent: "grow" as const,
      is_general: false,
      is_preset: false,
      persona_weights: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
      personas: [],
      profile: {
        temperature_mix: { cold: 0.3, warm: 0.5, hot: 0.2 },
        top_dispositions: ["connector", "scanner", "collector"],
        follower_tier: "micro",
      },
      calibration: {
        source: "scrape" as const,
        handle: "testcreator",
        scraped_at: "2026-06-18T00:00:00Z",
        thin: false,
      },
    };

    // The route no longer GUESSES the stages — it renders whatever the pipeline announces via
    // onStage. So the fake pipeline has to announce, exactly as the real one does. (Before
    // 2026-07-14 the route sent "Reading your followers…", awaited ALL the work, then sent
    // "Building your audience profile…" — so the copy on screen described the wrong phase for
    // 126 of 128 seconds. This mock is now the shape the real caller drives.)
    mocks.mockCalibrateFromScrape.mockImplementation(async (_input, deps) => {
      deps?.onStage?.("scraping");
      deps?.onStage?.("watching");
      deps?.onStage?.("synthesizing");
      return { audience: mockAudienceInput };
    });

    const persistedAudience = {
      id: "new-uuid",
      ...mockAudienceInput,
      user_id: "user-123",
      created_at: "2026-06-18T00:00:00Z",
      updated_at: "2026-06-18T00:00:00Z",
    };
    mocks.mockCreateAudience.mockResolvedValue(persistedAudience);

    const req = new Request("http://localhost/api/audiences/calibrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: "testcreator",
        type: "personal",
        platform: "tiktok",
        goalIntent: "grow",
        name: "My Audience",
      }),
    });

    const res = await POST_CALIBRATE(req);
    expect(res.status).toBe(200);

    const events = await parseSseEvents(res);
    const statusEvents = events.filter((e) => e.event === "status");
    const doneEvent = events.find((e) => e.event === "done");

    // Each stage the pipeline announces becomes one status frame, in order — and the copy names
    // the phase that is ACTUALLY starting, which is the whole point of the fix.
    expect(statusEvents.map((e) => (e.data as { message: string }).message)).toEqual([
      "Reading your followers…",
      "Watching your top videos…",
      "Building your audience profile…",
    ]);

    expect(doneEvent).toBeDefined();
    expect((doneEvent!.data as { audience: { id: string } }).audience.id).toBe("new-uuid");

    // createAudience called exactly once
    expect(mocks.mockCreateAudience).toHaveBeenCalledOnce();
  });

  it("A7: updates the draft row (no second insert) when audienceId is supplied", async () => {
    makeAuthenticatedUser();

    const mockAudienceInput = {
      user_id: "",
      name: "My Audience",
      type: "personal" as const,
      platform: "tiktok" as const,
      goal_label: null,
      goal_intent: "grow" as const,
      is_general: false,
      is_preset: false,
      persona_weights: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
      personas: [],
      profile: null,
      calibration: {
        source: "scrape" as const,
        handle: "testcreator",
        scraped_at: "2026-06-18T00:00:00Z",
        thin: false,
      },
    };
    mocks.mockCalibrateFromScrape.mockResolvedValue({ audience: mockAudienceInput });

    const draftId = "11111111-1111-4111-8111-111111111111";
    mocks.mockUpdateAudience.mockResolvedValue({
      id: draftId,
      ...mockAudienceInput,
      user_id: "user-123",
      created_at: "2026-06-18T00:00:00Z",
      updated_at: "2026-06-18T00:00:00Z",
    });

    const req = new Request("http://localhost/api/audiences/calibrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audienceId: draftId,
        handle: "testcreator",
        type: "personal",
        platform: "tiktok",
        goalIntent: "grow",
        name: "My Audience",
      }),
    });

    const res = await POST_CALIBRATE(req);
    expect(res.status).toBe(200);

    const events = await parseSseEvents(res);
    const doneEvent = events.find((e) => e.event === "done");
    expect((doneEvent!.data as { audience: { id: string } }).audience.id).toBe(draftId);

    // A7: the draft is enriched in place — UPDATE called, INSERT never (no orphan dupe).
    expect(mocks.mockUpdateAudience).toHaveBeenCalledOnce();
    expect(mocks.mockUpdateAudience).toHaveBeenCalledWith(expect.anything(), draftId, mockAudienceInput);
    expect(mocks.mockCreateAudience).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input (missing required fields)", async () => {
    makeAuthenticatedUser();
    const req = new Request("http://localhost/api/audiences/calibrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "personal" /* missing required fields */ }),
    });
    const res = await POST_CALIBRATE(req);
    expect(res.status).toBe(400);
  });
});
