/**
 * POST /api/surfaces/lanes — the day-0 lane reveal route (v8 Phase 5).
 *
 * Locks the gate ORDER, which is the whole security/spend contract: flag 404 before
 * anything, auth 401 before any producer, a 400 on a blank answer before any model
 * call, and no drops spend when synthesis itself failed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const flag = vi.hoisted(() => ({ on: true }));
const stubs = vi.hoisted(() => ({
  getUser: vi.fn(),
  synthesizeLanes: vi.fn(),
  buildLaneDrops: vi.fn(),
}));

vi.mock("@/lib/flags/concept-v8", () => ({
  get CONCEPT_V8_ENABLED() {
    return flag.on;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: stubs.getUser } }),
}));
vi.mock("@/lib/engine/lanes/synthesize-lanes", () => ({
  synthesizeLanes: stubs.synthesizeLanes,
}));
vi.mock("@/lib/surfaces/lane-drops", () => ({ buildLaneDrops: stubs.buildLaneDrops }));

const { POST } = await import("../route");

function req(body: unknown): Request {
  return new Request("http://localhost/api/surfaces/lanes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  // Call history accumulates across tests otherwise, and the "never called" assertions
  // below would pass/fail on a NEIGHBOUR's call rather than their own.
  vi.clearAllMocks();
  flag.on = true;
  stubs.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  stubs.synthesizeLanes.mockResolvedValue([
    { name: "The skeptic", who: "calls it out", niche: "fintech criticism" },
  ]);
  stubs.buildLaneDrops.mockResolvedValue([
    { lane: { name: "The skeptic", who: "x", niche: "y" }, cards: [] },
  ]);
});

describe("POST /api/surfaces/lanes", () => {
  it("404s when the flag is off — no new spend surface exists flag-off", async () => {
    flag.on = false;
    const res = await POST(req({ answer: "budgeting" }));
    expect(res.status).toBe(404);
    expect(stubs.synthesizeLanes).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller before any producer runs", async () => {
    stubs.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ answer: "budgeting" }));
    expect(res.status).toBe(401);
    expect(stubs.synthesizeLanes).not.toHaveBeenCalled();
  });

  it("400s a blank answer without spending a model call", async () => {
    const res = await POST(req({ answer: "   " }));
    expect(res.status).toBe(400);
    expect(stubs.synthesizeLanes).not.toHaveBeenCalled();
  });

  it("400s a missing body field without spending a model call", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(stubs.synthesizeLanes).not.toHaveBeenCalled();
  });

  it("returns the shelves on the happy path", async () => {
    const res = await POST(req({ answer: "budgeting on a tight income" }));
    expect(res.status).toBe(200);
    expect((await res.json()).shelves).toHaveLength(1);
  });

  it("502s when synthesis returns null, and never calls the drops builder", async () => {
    stubs.synthesizeLanes.mockResolvedValue(null);
    const res = await POST(req({ answer: "budgeting" }));
    expect(res.status).toBe(502);
    expect(stubs.buildLaneDrops).not.toHaveBeenCalled();
  });

  it("502s when the drops builder throws", async () => {
    stubs.buildLaneDrops.mockRejectedValue(new Error("corpus down"));
    const res = await POST(req({ answer: "budgeting" }));
    expect(res.status).toBe(502);
  });
});
