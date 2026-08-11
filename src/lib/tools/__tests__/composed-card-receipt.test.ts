import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeReceipts } from "@/lib/tools/composed-card-receipt";
import { MAX_PRINTABLE_MULTIPLIER } from "@/lib/grounding/outlier-gate";

/**
 * A hand-rolled stand-in for the ONE I/O boundary this module has. Deliberately not a mock of
 * our own code: the unit under test is the mapping + the honesty rules, and those must run for
 * real. The fake also records its calls, so "returns early without querying" can be asserted
 * instead of merely asserted-about.
 */
interface FakeQuery {
  table: string;
  columns: string;
  column: string;
  ids: readonly unknown[];
}

function fakeSupabase(rows: Array<Record<string, unknown>>) {
  const calls: FakeQuery[] = [];
  const client = {
    calls,
    from: (table: string) => ({
      select: (columns: string) => ({
        in: async (column: string, ids: readonly unknown[]) => {
          calls.push({ table, columns, column, ids });
          return { data: rows, error: null };
        },
      }),
    }),
  };
  return client as unknown as SupabaseClient & { calls: FakeQuery[] };
}

const row = {
  id: "row-1",
  creator_handle: "corporate.bro",
  video_url: "https://tiktok.com/@corporate.bro/video/1",
  cover_url: "https://cdn/cover.jpg",
  hook_template: "The [thing] nobody tells you about [topic]",
  hook_archetype: "secret-reveal-breakdown",
  outlier_multiplier: 5.7,
  views: 1_400_000,
  baseline_label: "vs their usual views",
};

describe("materializeReceipts", () => {
  it("maps a corpus row onto a HookProof", async () => {
    const out = await materializeReceipts(["row-1"], { supabase: fakeSupabase([row]) });
    const proof = out.get("row-1");
    expect(proof?.handle).toBe("corporate.bro");
    expect(proof?.multiplier).toBe(5.7);
    expect(proof?.baselineLabel).toBe("vs their usual views");
    expect(proof?.videoUrl).toBe("https://tiktok.com/@corporate.bro/video/1");
    expect(proof?.coverUrl).toBe("https://cdn/cover.jpg");
    expect(proof?.hookTemplate).toBe("The [thing] nobody tells you about [topic]");
    expect(proof?.archetype).toBe("secret-reveal-breakdown");
    expect(proof?.views).toBe(1_400_000);
  });

  it("reads the teardown table by id", async () => {
    const supabase = fakeSupabase([row]);
    await materializeReceipts(["row-1", "row-1"], { supabase });
    expect(supabase.calls).toHaveLength(1);
    expect(supabase.calls[0]?.table).toBe("outlier_teardowns");
    expect(supabase.calls[0]?.column).toBe("id");
    // De-duplicated: one id in, one id queried.
    expect(supabase.calls[0]?.ids).toEqual(["row-1"]);
  });

  it("omits an id the corpus does not have — a fabricated ref renders no receipt", async () => {
    const out = await materializeReceipts(["nope"], { supabase: fakeSupabase([]) });
    expect(out.has("nope")).toBe(false);
  });

  it("drops the number when the row cannot name its basis (D9)", async () => {
    const out = await materializeReceipts(["row-1"], {
      supabase: fakeSupabase([{ ...row, baseline_label: null }]),
    });
    expect(out.get("row-1")?.multiplier).toBeNull();
    expect(out.get("row-1")?.baselineLabel).toBeNull();
  });

  it("clamps an above-band multiplier rather than printing 20154x (B1)", async () => {
    const out = await materializeReceipts(["row-1"], {
      supabase: fakeSupabase([{ ...row, outlier_multiplier: 20154.7 }]),
    });
    expect(out.get("row-1")?.multiplier).toBe(MAX_PRINTABLE_MULTIPLIER);
  });

  it("leaves an in-band multiplier untouched", async () => {
    const out = await materializeReceipts(["row-1"], {
      supabase: fakeSupabase([{ ...row, outlier_multiplier: 57 }]),
    });
    expect(out.get("row-1")?.multiplier).toBe(57);
  });

  it("drops a zero or negative multiplier rather than claiming 0x", async () => {
    // Mirrors honestMultiplier in retrieve.ts: absent is honest, zero asserts the video
    // performed zero times its own baseline.
    for (const bad of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const out = await materializeReceipts(["row-1"], {
        supabase: fakeSupabase([{ ...row, outlier_multiplier: bad }]),
      });
      expect(out.get("row-1")?.multiplier, String(bad)).toBeNull();
    }
  });

  it("never claims a fit it did not measure", async () => {
    const out = await materializeReceipts(["row-1"], { supabase: fakeSupabase([row]) });
    expect(out.get("row-1")?.fitLabel).toBeNull();
  });

  it("refuses a row with no handle — an unattributable source is not a receipt", async () => {
    const out = await materializeReceipts(["row-1"], {
      supabase: fakeSupabase([{ ...row, creator_handle: null }]),
    });
    expect(out.has("row-1")).toBe(false);
  });

  it("keeps a receipt whose views are missing", async () => {
    const out = await materializeReceipts(["row-1"], {
      supabase: fakeSupabase([{ ...row, views: null }]),
    });
    expect(out.get("row-1")?.views).toBeNull();
    expect(out.get("row-1")?.multiplier).toBe(5.7);
  });

  it("returns an empty map for an empty id list without querying", async () => {
    const supabase = fakeSupabase([]);
    const out = await materializeReceipts([], { supabase });
    expect(out.size).toBe(0);
    expect(supabase.calls).toHaveLength(0);
  });

  it("returns an empty map when the query errors rather than throwing at the card", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          in: async () => ({ data: null, error: { message: "boom" } }),
        }),
      }),
    } as unknown as SupabaseClient;
    const out = await materializeReceipts(["row-1"], { supabase });
    expect(out.size).toBe(0);
  });
});
