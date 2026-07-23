/**
 * sim-seals.test.ts — Ambient v2 Phase D seal persistence helpers.
 *
 * Locks: readSimSeals parses + validates (never fabricates from a corrupt row); writeSimSeal
 * merges (never clobbers other seals) and is NON-FATAL (a DB failure returns false, never throws —
 * a seal-write must never break the reaction it came from).
 */
import { describe, it, expect, vi } from "vitest";
import { readSimSeals, writeSimSeal, sealKey } from "../sim-seals";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("sealKey", () => {
  it("is the trimmed stimulus (matches the client lookup)", () => {
    expect(sealKey("  a hook  ")).toBe("a hook");
  });
});

describe("readSimSeals", () => {
  it("parses valid entries", () => {
    const map = readSimSeals({
      sim_seals: { "a hook": { pct: 80, band: "Strong", at: "2026-07-23T00:00:00Z" } },
    });
    expect(map["a hook"]).toEqual({ pct: 80, band: "Strong", at: "2026-07-23T00:00:00Z" });
  });

  it("drops malformed entries (no numeric pct) — never fabricates a seal", () => {
    const map = readSimSeals({
      sim_seals: {
        good: { pct: 42, band: "Mixed", at: "x" },
        bad1: { band: "Strong" }, // no pct
        bad2: "not an object",
        bad3: { pct: "80" }, // pct not a number
      } as never,
    });
    expect(Object.keys(map)).toEqual(["good"]);
    expect(map.good!.pct).toBe(42);
  });

  it("coerces a missing band to null and a missing at to empty", () => {
    const map = readSimSeals({ sim_seals: { k: { pct: 10 } } as never });
    expect(map.k).toEqual({ pct: 10, band: null, at: "" });
  });

  it("returns {} for null / array / non-object", () => {
    expect(readSimSeals({ sim_seals: null })).toEqual({});
    expect(readSimSeals({ sim_seals: [] as never })).toEqual({});
    expect(readSimSeals({ sim_seals: "nope" as never })).toEqual({});
  });
});

/** A supabase mock whose update→eq resolves { error }, capturing the update payload. */
function mockSupabase(error: { message: string } | null = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { client: { from } as unknown as SupabaseClient, from, update, eq };
}

describe("writeSimSeal", () => {
  it("MERGES the new seal into the existing map (never clobbers siblings)", async () => {
    const { client, update, eq } = mockSupabase();
    const thread = { id: "t1", sim_seals: { existing: { pct: 30, band: "Weak", at: "old" } } };

    const ok = await writeSimSeal(client, thread, "  new hook  ", { pct: 90, band: "Strong", at: "now" });

    expect(ok).toBe(true);
    // trimmed key + both seals present
    expect(update).toHaveBeenCalledWith({
      sim_seals: {
        existing: { pct: 30, band: "Weak", at: "old" },
        "new hook": { pct: 90, band: "Strong", at: "now" },
      },
    });
    expect(eq).toHaveBeenCalledWith("id", "t1");
  });

  it("returns false + writes NOTHING for an empty stimulus", async () => {
    const { client, update } = mockSupabase();
    const ok = await writeSimSeal(client, { id: "t1", sim_seals: {} }, "   ", { pct: 1, band: null, at: "x" });
    expect(ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("is NON-FATAL — a DB error returns false, never throws", async () => {
    const { client } = mockSupabase({ message: "db down" });
    const ok = await writeSimSeal(client, { id: "t1", sim_seals: {} }, "hook", { pct: 5, band: null, at: "x" });
    expect(ok).toBe(false);
  });
});
