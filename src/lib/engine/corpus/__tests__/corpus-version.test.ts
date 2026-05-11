import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadCorpusVersion,
  invalidateCorpusVersionCache,
} from "../corpus-version";

// Mock Supabase service client to return predictable row counts
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 10, error: null }),
      }),
    }),
  })),
}));

describe("loadCorpusVersion", () => {
  beforeEach(() => {
    invalidateCorpusVersionCache();
  });

  it("returns a snapshot with niche_thresholds and version for known version", async () => {
    const snap = await loadCorpusVersion("pilot.2026-05-12");
    expect(snap).not.toBeNull();
    expect(snap!.version).toBe("pilot.2026-05-12");
    expect(snap!.niche_thresholds).toBeDefined();
    expect(snap!.niche_thresholds.beauty).toBeDefined();
    expect(snap!.niche_thresholds.fitness).toBeDefined();
    expect(snap!.niche_thresholds.edu).toBeDefined();
    expect(snap!.niche_thresholds.comedy).toBeDefined();
    expect(snap!.niche_thresholds.lifestyle).toBeDefined();
    expect(snap!.row_count).toBe(10);
  });

  it("returns null for unknown version (does NOT throw)", async () => {
    const snap = await loadCorpusVersion("does-not-exist");
    expect(snap).toBeNull();
  });

  it("does not throw when version is unknown — mirrors ml.ts:475 pattern", async () => {
    await expect(loadCorpusVersion("unknown.version")).resolves.toBeNull();
  });

  it("returns 0 row_count when Supabase errors", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    vi.mocked(createServiceClient).mockImplementationOnce(() => ({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ count: null, error: { message: "DB error" } }),
        }),
      }),
    }) as never);

    invalidateCorpusVersionCache();
    const snap = await loadCorpusVersion("pilot.2026-05-12");
    expect(snap).not.toBeNull();
    expect(snap!.row_count).toBe(0);
  });

  it("uses cache on second call (niche_thresholds reference is stable)", async () => {
    const snap1 = await loadCorpusVersion("pilot.2026-05-12");
    const snap2 = await loadCorpusVersion("pilot.2026-05-12");
    // Both succeed
    expect(snap1).not.toBeNull();
    expect(snap2).not.toBeNull();
    // Thresholds are from the same snapshot object (D-13 immutable)
    expect(snap2!.niche_thresholds).toEqual(snap1!.niche_thresholds);
  });

  it("invalidateCorpusVersionCache clears the cache so next call refetches", async () => {
    await loadCorpusVersion("pilot.2026-05-12"); // prime cache
    invalidateCorpusVersionCache();
    const snap = await loadCorpusVersion("pilot.2026-05-12"); // fresh fetch
    expect(snap).not.toBeNull();
    expect(snap!.row_count).toBe(10);
  });
});
