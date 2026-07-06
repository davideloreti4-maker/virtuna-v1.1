/**
 * predicted-pin.test.ts — TDD for pinPredictedSignature (10-03 Task 1, FLYWHEEL-02).
 *
 * The pin is the "predict" half of predict→post→measure→reconcile. At SIM run time
 * the PREDICTED disposition vector + the audience_id the run used are pinned (Pitfall 6),
 * never recomputed later. Covers:
 *  - predictedSignature is computed on the run's personas and a row is attempted
 *    carrying the run's audience_id + analysis_id (the pinned prediction).
 *  - A null/General audience still pins a vector (audience_id: null).
 *  - Persistence failure is NON-FATAL — pinPredictedSignature never throws, returns false,
 *    and does not block the SIM card path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";

// Mock the outcome repo so no DB is touched; capture the insert payload.
const insertOutcomeSignature = vi.fn();
vi.mock("@/lib/flywheel/outcome-repo", () => ({
  insertOutcomeSignature: (...args: unknown[]) => insertOutcomeSignature(...args),
}));

import { pinPredictedSignature } from "@/lib/tools/runners/predicted-pin";
import { predictedSignature } from "@/lib/flywheel/signature";

// A fake SupabaseClient — never actually used (repo is mocked).
const fakeSupabase = {} as never;

const persona = (archetype: string, verdict: "stop" | "scroll"): FlashPersona => ({
  archetype,
  verdict,
  quote: "x",
});

// Three stops across known archetypes → a non-trivial predicted vector.
const personas: FlashPersona[] = [
  persona("saver", "stop"), // → collector
  persona("sharer", "stop"), // → connector
  persona("niche_deep_buyer", "stop"), // → converter
  persona("lurker", "scroll"), // scroll → ignored
];

describe("pinPredictedSignature (FLYWHEEL-02, Pitfall 6)", () => {
  beforeEach(() => {
    insertOutcomeSignature.mockReset();
    insertOutcomeSignature.mockResolvedValue({ id: "row-1" });
  });

  it("pins predictedSignature(personas) with the run's audience_id + analysis_id", async () => {
    const ok = await pinPredictedSignature(fakeSupabase, personas, {
      audienceId: "aud-123",
      analysisId: "an-456",
    });

    expect(ok).toBe(true);
    expect(insertOutcomeSignature).toHaveBeenCalledTimes(1);

    const [, payload] = insertOutcomeSignature.mock.calls[0]!;
    // The predicted vector written is EXACTLY predictedSignature(personas) (computed once).
    expect(payload.predicted_vector).toEqual(predictedSignature(personas));
    // The run's audience_id + analysis_id are pinned alongside the prediction.
    expect(payload.audience_id).toBe("aud-123");
    expect(payload.analysis_id).toBe("an-456");
  });

  it("pins a vector for a General/null audience (audience_id null, analysis_id null)", async () => {
    const ok = await pinPredictedSignature(fakeSupabase, personas, {
      audienceId: null,
    });

    expect(ok).toBe(true);
    const [, payload] = insertOutcomeSignature.mock.calls[0]!;
    expect(payload.audience_id).toBeNull();
    expect(payload.analysis_id).toBeNull();
    expect(payload.predicted_vector).toEqual(predictedSignature(personas));
  });

  it("is non-fatal: a persistence failure never throws and returns false", async () => {
    insertOutcomeSignature.mockRejectedValueOnce(new Error("db down"));

    let result: boolean | undefined;
    await expect(
      (async () => {
        result = await pinPredictedSignature(fakeSupabase, personas, {
          audienceId: "aud-123",
        });
      })(),
    ).resolves.toBeUndefined();

    expect(result).toBe(false);
  });
});
