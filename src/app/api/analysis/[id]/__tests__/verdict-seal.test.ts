/**
 * verdict-seal.test.ts — GET /api/analysis/[id] under the funnel wall
 * (ONBOARDING-FUNNEL-DESIGN.md §0b②).
 *
 * The permalink read serves the persisted row (plus runtime shims). To an anonymous
 * session it must arrive WITHOUT the reception read. The sneaky path: when the row
 * has no persisted heatmap the route SYNTHESIZES one from `personas` — the seal has
 * to run AFTER that enrichment, or the synthesized curve walks straight through.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/engine/optimal-post", () => ({
  computeOptimalPostWindow: vi.fn().mockResolvedValue(null),
}));

import { createClient } from "@/lib/supabase/server";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient(user: Record<string, unknown> | null, row: Record<string, unknown> | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              single: vi.fn().mockResolvedValue(
                row ? { data: row, error: null } : { data: null, error: { message: "no row" } },
              ),
            })),
          })),
        })),
      })),
    })),
  };
}

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "an-1",
    user_id: "u-1",
    overall_score: 74,
    confidence: 0.8,
    engine_version: "3.21.0",
    signal_availability: { gemini: true, behavioral: true },
    heatmap: { segments: [], personas: [], weighted_curve: [0.8, 0.4] },
    personas: [
      { persona_id: "p1", slot_type: "fyp", watch_through_pct: 60, scroll_past_second: 4 },
    ],
    persona_behavioral_aggregate: { share_pct: 30 },
    behavioral_predictions: { completion_pct: 55 },
    optimal_post_window: { start_hour: 18, end_hour: 21 },
    content_text: "a test caption",
    created_at: "2026-07-26T12:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

async function callGET(): Promise<Response> {
  const { GET } = await import("../route");
  const req = new Request("http://localhost/api/analysis/an-1");
  return GET(req, { params: Promise.resolve({ id: "an-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/analysis/[id] — the funnel wall (verdict seal, §0b②)", () => {
  it("an anonymous session receives NO reception read, stamped verdict_sealed", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: "anon-1", is_anonymous: true }, makeRow()));

    const res = await callGET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.verdict_sealed).toBe(true);
    expect(body.heatmap).toBeNull();
    expect(body.personas).toBeNull();
    expect(body.persona_behavioral_aggregate).toBeNull();
    expect(body.behavioral_predictions).toBeNull();
    // The craft half survives.
    expect(body.overall_score).toBe(74);
  });

  it("seals the SYNTHESIZED heatmap too — the shim runs before the wall, not around it", async () => {
    // No persisted heatmap: the route builds one from `personas`. It must still be absent.
    mockCreateClient.mockResolvedValue(
      makeClient({ id: "anon-1", is_anonymous: true }, makeRow({ heatmap: null })),
    );

    const res = await callGET();
    const body = await res.json();

    expect(body.heatmap).toBeNull();
    expect(body.personas).toBeNull();
    expect(JSON.stringify(body)).not.toContain("weighted_curve");
  });

  it("a REAL session keeps the full row — the wall never narrows a customer", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: "u-1" }, makeRow()));

    const res = await callGET();
    const body = await res.json();

    expect(body.verdict_sealed).toBeUndefined();
    expect(body.heatmap.weighted_curve).toEqual([0.8, 0.4]);
    expect(body.personas).toHaveLength(1);
  });
});
