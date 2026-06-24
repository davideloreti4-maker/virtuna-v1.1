/**
 * Track B step 9 — audience-drift cron RE-BAKE tests (§P.1: this cron is the ONLY place the
 * frozen signature re-bakes).
 *
 * Covers:
 *   - Test 1: clean re-scrape with NO composition shift → re-bake STILL persists the fresh
 *             signature (every clean re-scrape refreshes), but NO drift outcome/reconciliation.
 *   - Test 2: clean re-scrape WITH a composition shift → re-bake persists AND the drift
 *             outcome_signatures + reconciliations rows are written (same D-01 path).
 *   - Test 3: re-bake payload writes signature/creator_persona/profile/personas/calibration
 *             ONLY — never persona_weights or the flat fyp/niche/loyalist/cross_niche cols
 *             (the flywheel owns weights; the two loops stay orthogonal).
 *   - Test 4: a thin/failed re-scrape writes NEITHER a re-bake NOR a drift row (honesty spine).
 *   - Test 5: a re-bake DB failure is logged but does NOT block drift detection (independent).
 *
 * Mocking pattern mirrors src/app/api/cron/calculate-trends/__tests__/route.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyCronAuth, mockCreateServiceClient, mockCalibrateFromScrape, mockReconcile } =
  vi.hoisted(() => ({
    mockVerifyCronAuth: vi.fn(),
    mockCreateServiceClient: vi.fn(),
    mockCalibrateFromScrape: vi.fn(),
    mockReconcile: vi.fn(),
  }));

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const stub = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => stub,
    };
    return stub;
  },
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronAuth: mockVerifyCronAuth }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mockCreateServiceClient }));
vi.mock("@/lib/audience/calibration", () => ({ calibrateFromScrape: mockCalibrateFromScrape }));
vi.mock("@/lib/flywheel/reconcile", () => ({ reconcile: mockReconcile }));

interface MockState {
  audiences: unknown[];
  audiencesError: { message: string } | null;
  rebakeUpdates: unknown[];
  rebakeError: { message: string } | null;
  outcomeError: { message: string } | null;
  reconciliations: unknown[];
  reconciliationError: { message: string } | null;
}

let state: MockState;

function buildSupabaseClient(): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "audiences") {
        return {
          // List path: .select().eq("type").eq("is_general").eq("is_preset")
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({ data: state.audiences, error: state.audiencesError }),
              }),
            }),
          }),
          // Re-bake path: .update(payload).eq("id", id)
          update: (payload: unknown) => {
            state.rebakeUpdates.push(payload);
            return { eq: () => Promise.resolve({ error: state.rebakeError }) };
          },
        };
      }
      if (table === "outcome_signatures") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "outcome-1" }, error: state.outcomeError }),
            }),
          }),
        };
      }
      if (table === "reconciliations") {
        return {
          insert: (row: unknown) => {
            state.reconciliations.push(row);
            return Promise.resolve({ error: state.reconciliationError });
          },
        };
      }
      return {};
    }),
  };
}

/** A personal own-account audience row with a stored composition (the "predicted" mix). */
function audienceRow(storedPersonas: Array<{ disposition: string; share: number }>) {
  return {
    id: "aud-1",
    user_id: "user-1",
    type: "personal",
    is_general: false,
    is_preset: false,
    goal_intent: "grow",
    personas: storedPersonas,
    calibration: { handle: "doctormike" },
    platform: "tiktok",
    name: "Mike",
  };
}

/** A CalibrationSuccess with a fresh signature + a fresh composition (the "realized" mix). */
function calibrationSuccess(freshPersonas: Array<{ disposition: string; share: number }>) {
  return {
    audience: {
      personas: freshPersonas,
      signature: { summary: "fresh", audience: { personas: freshPersonas } },
      creator_persona: { content_description: "fresh creator" },
      profile: { follower_tier: "mid" },
      calibration: { source: "scrape", handle: "doctormike", scraped_at: "2026-06-24", thin: false },
    },
  };
}

function makeRequest(): Request {
  return new Request("https://example.com/api/cron/audience-drift", { method: "GET" });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockVerifyCronAuth.mockReturnValue(null);
  mockReconcile.mockReturnValue({
    divergenceVector: { collector: 0.2 },
    classification: "shift",
  });
  state = {
    audiences: [],
    audiencesError: null,
    rebakeUpdates: [],
    rebakeError: null,
    outcomeError: null,
    reconciliations: [],
    reconciliationError: null,
  };
  mockCreateServiceClient.mockReturnValue(buildSupabaseClient());
  vi.resetModules();
});

describe("audience-drift cron — re-bake (Track B step 9)", () => {
  it("Test 1: clean re-scrape, NO shift → re-bakes the signature but writes no drift row", async () => {
    const stored = [
      { disposition: "collector", share: 0.5 },
      { disposition: "converter", share: 0.5 },
    ];
    state.audiences = [audienceRow(stored)];
    // Fresh == stored composition → no shift.
    mockCalibrateFromScrape.mockResolvedValue(calibrationSuccess(stored));

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;

    expect(state.rebakeUpdates).toHaveLength(1); // re-baked despite no shift
    expect(state.reconciliations).toHaveLength(0); // no drift row
    expect(body.rebaked).toBe(1);
    expect(body.drifted).toBe(0);
  });

  it("Test 2: clean re-scrape WITH a shift → re-bakes AND writes the drift outcome + reconciliation", async () => {
    state.audiences = [
      audienceRow([
        { disposition: "collector", share: 0.7 },
        { disposition: "converter", share: 0.3 },
      ]),
    ];
    // Fresh composition differs → shift.
    mockCalibrateFromScrape.mockResolvedValue(
      calibrationSuccess([
        { disposition: "collector", share: 0.4 },
        { disposition: "converter", share: 0.6 },
      ]),
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = (await res.json()) as Record<string, number>;

    expect(state.rebakeUpdates).toHaveLength(1);
    expect(state.reconciliations).toHaveLength(1);
    expect(body.rebaked).toBe(1);
    expect(body.drifted).toBe(1);
  });

  it("Test 3: re-bake writes the signature fields ONLY — never persona_weights / flat weight cols", async () => {
    const stored = [{ disposition: "collector", share: 1.0 }];
    state.audiences = [audienceRow(stored)];
    mockCalibrateFromScrape.mockResolvedValue(calibrationSuccess(stored));

    const { GET } = await import("../route");
    await GET(makeRequest());

    const payload = state.rebakeUpdates[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(
      ["calibration", "creator_persona", "personas", "profile", "signature"].sort(),
    );
    // The flywheel owns weights — the re-bake must NOT touch them.
    expect(payload).not.toHaveProperty("persona_weights");
    expect(payload).not.toHaveProperty("fyp");
    expect(payload).not.toHaveProperty("niche");
    expect(payload).not.toHaveProperty("loyalist");
    expect(payload).not.toHaveProperty("cross_niche");
  });

  it("Test 4: thin/failed re-scrape → no re-bake and no drift row (honesty spine)", async () => {
    state.audiences = [audienceRow([{ disposition: "collector", share: 1.0 }])];
    // Fallback/error result (no `audience` key) → honesty gate skips everything.
    mockCalibrateFromScrape.mockResolvedValue({ fallback: "general" });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = (await res.json()) as Record<string, number>;

    expect(state.rebakeUpdates).toHaveLength(0);
    expect(state.reconciliations).toHaveLength(0);
    expect(body.rebaked).toBe(0);
    expect(body.skipped).toBe(1);
  });

  it("Test 5: re-bake DB failure is logged but does NOT block drift detection", async () => {
    state.audiences = [
      audienceRow([
        { disposition: "collector", share: 0.7 },
        { disposition: "converter", share: 0.3 },
      ]),
    ];
    mockCalibrateFromScrape.mockResolvedValue(
      calibrationSuccess([
        { disposition: "collector", share: 0.4 },
        { disposition: "converter", share: 0.6 },
      ]),
    );
    state.rebakeError = { message: "update failed" };

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = (await res.json()) as Record<string, number>;

    expect(res.status).toBe(200);
    expect(body.rebaked).toBe(0); // re-bake failed
    expect(state.reconciliations).toHaveLength(1); // drift STILL written
    expect(body.drifted).toBe(1);
  });
});
