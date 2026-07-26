/**
 * corpus-durable-cover.test.ts — corpus writes persist a DURABLE cover, never the raw CDN URL.
 *
 * Why this guard exists (2026-07-24): every ProofReceipt on every skill card rendered its grey
 * play-tile placeholder instead of a thumbnail. Root cause: the durable-cover mechanism shipped
 * 2026-07-10 (`rehostCover`) was wired into the three Discover/`scraped_videos` writers but NOT
 * into the grounding corpus. The corpus is "extract once / cache forever", so it stored the raw
 * signed CDN URL (TikTok `x-expires`, Instagram `oe=`), which 403s on every later read — the
 * receipt is dead the moment the signature lapses.
 *
 * These assertions fail by construction against the pre-fix writers, which passed `input.coverUrl`
 * straight into the row.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const rehostCover = vi.fn();
vi.mock("@/lib/scraping/rehost-cover", () => ({
  rehostCover: (...args: unknown[]) => rehostCover(...args),
}));

const { upsertOutlierTeardown, upsertPersonalTeardown } = await import("../corpus");

const EPHEMERAL =
  "https://scontent.cdninstagram.com/v/t51.82787-15/574737794.jpg?oe=691605EB";
const DURABLE =
  "https://qyxvxleheckijapurisj.supabase.co/storage/v1/object/public/covers/corpus/instagram/ABC123.jpg";

/** Captures the row handed to `.upsert(...)` so we can assert on what actually gets persisted. */
function fakeSupabase() {
  const rows: Array<Record<string, unknown>> = [];
  const upsert = vi.fn((row: Record<string, unknown>) => {
    rows.push(row);
    return {
      select: () => ({ single: async () => ({ data: { id: "row-1" }, error: null }) }),
    };
  });
  return { supabase: { from: () => ({ upsert }) } as unknown as SupabaseClient, upsert, rows };
}

const SHARED = {
  platform: "instagram",
  platformVideoId: "ABC123",
  sourcePool: "curated" as const,
  coverUrl: EPHEMERAL,
};

const PERSONAL = { ...SHARED, userId: "user-1" };

beforeEach(() => {
  rehostCover.mockReset();
});

describe("corpus writes rehost the cover before persisting", () => {
  it("stores the rehosted URL on a SHARED teardown, keyed stably by platform + video id", async () => {
    rehostCover.mockResolvedValue(DURABLE);
    const { supabase, rows } = fakeSupabase();

    await upsertOutlierTeardown(supabase, SHARED);

    expect(rehostCover).toHaveBeenCalledWith(
      supabase,
      EPHEMERAL,
      "corpus/instagram/ABC123",
    );
    expect(rows[0]).toMatchObject({ cover_url: DURABLE });
  });

  it("stores the rehosted URL on a PERSONAL teardown too", async () => {
    rehostCover.mockResolvedValue(DURABLE);
    const { supabase, rows } = fakeSupabase();

    await upsertPersonalTeardown(supabase, PERSONAL);

    expect(rows[0]).toMatchObject({ cover_url: DURABLE });
  });

  it("degrades to the ephemeral URL when rehosting fails — never worse than before, never a throw", async () => {
    rehostCover.mockResolvedValue(null);
    const { supabase, rows } = fakeSupabase();

    await upsertOutlierTeardown(supabase, SHARED);

    expect(rows[0]).toMatchObject({ cover_url: EPHEMERAL });
  });

  it("does not attempt a rehost when the source row carries no cover", async () => {
    const { supabase, rows } = fakeSupabase();

    await upsertOutlierTeardown(supabase, { ...SHARED, coverUrl: null });

    expect(rehostCover).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ cover_url: null });
  });
});
