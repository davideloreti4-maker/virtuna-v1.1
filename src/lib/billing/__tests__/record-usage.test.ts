import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordUsage } from "../record-usage";
import { CREDIT_COSTS } from "@/lib/pricing";

/**
 * The one place credits are charged. The properties that matter:
 *   1. the row is stamped with the action's CREDIT_COSTS price AT DELIVERY — a later price
 *      change must never rewrite history;
 *   2. BEST-EFFORT: a ledger failure never throws into the route — the customer already has
 *      their result;
 *   3. migration-tolerant: missing table (42P01) is silent; missing `credits` column (42703)
 *      retries the write without it so the event is not lost.
 */

function stubService(errors: Array<{ code: string; message: string } | null>) {
  const inserts: Record<string, unknown>[] = [];
  let call = 0;
  const insert = vi.fn((row: Record<string, unknown>) => {
    inserts.push(row);
    const error = errors[call] ?? null;
    call += 1;
    return Promise.resolve({ error });
  });
  return {
    client: { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient,
    inserts,
    insert,
  };
}

describe("recordUsage — the credit ledger writer", () => {
  it("stamps the action's price from CREDIT_COSTS", async () => {
    const { client, inserts } = stubService([null]);
    await recordUsage(client, { userId: "u1", action: "hooks", tier: "pro" });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      user_id: "u1",
      mode: "hooks",
      credits: CREDIT_COSTS.hooks,
      billed: true,
      tier: "pro",
      analysis_id: null,
    });
  });

  it("a Reading costs 10 and carries its analysis id", async () => {
    const { client, inserts } = stubService([null]);
    await recordUsage(client, {
      userId: "u1",
      action: "score",
      analysisId: "abc123def456",
      tier: "starter",
    });
    expect(inserts[0]).toMatchObject({
      mode: "score",
      credits: 10,
      analysis_id: "abc123def456",
    });
  });

  it("honours a price override (explore that escalated to a live scrape)", async () => {
    const { client, inserts } = stubService([null]);
    await recordUsage(client, {
      userId: "u1",
      action: "explore",
      credits: CREDIT_COSTS.explore_scrape,
    });
    expect(inserts[0]).toMatchObject({ mode: "explore", credits: 5 });
  });

  it("writes unbilled comp rows too — an invisible free action is unauditable", async () => {
    const { client, inserts } = stubService([null]);
    await recordUsage(client, { userId: "u1", action: "score", billed: false });
    expect(inserts[0]).toMatchObject({ billed: false, credits: 10 });
  });

  it("is silent when the ledger table does not exist yet (42P01)", async () => {
    const { client } = stubService([{ code: "42P01", message: "no relation" }]);
    const log = { warn: vi.fn() };
    await expect(
      recordUsage(client, { userId: "u1", action: "score" }, log)
    ).resolves.toBeUndefined();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("retries WITHOUT the credits column when it does not exist yet (42703)", async () => {
    const { client, inserts } = stubService([
      { code: "42703", message: "column credits does not exist" },
      null,
    ]);
    await recordUsage(client, { userId: "u1", action: "score" });

    expect(inserts).toHaveLength(2);
    expect(inserts[0]).toHaveProperty("credits");
    expect(inserts[1]).not.toHaveProperty("credits"); // the retry drops only the new column
    expect(inserts[1]).toMatchObject({ mode: "score", user_id: "u1" });
  });

  it("NEVER throws into the route — a delivered result outranks our accounting", async () => {
    const boom = {
      from: vi.fn(() => ({
        insert: vi.fn(() => Promise.reject(new Error("network down"))),
      })),
    } as unknown as SupabaseClient;
    const log = { warn: vi.fn() };

    await expect(
      recordUsage(boom, { userId: "u1", action: "hooks" }, log)
    ).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(
      "usage_event_write_failed",
      expect.objectContaining({ action: "hooks" })
    );
  });

  it("logs (and survives) a real insert error", async () => {
    const { client } = stubService([{ code: "23514", message: "check violation" }]);
    const log = { warn: vi.fn() };
    await recordUsage(client, { userId: "u1", action: "ideas" }, log);
    expect(log.warn).toHaveBeenCalledWith(
      "usage_event_write_failed",
      expect.objectContaining({ action: "ideas" })
    );
  });
});
