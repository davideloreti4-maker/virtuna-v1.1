import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordReading } from "../record-reading";

/**
 * Billing a Reading. Two properties carry the whole design:
 *   1. it is BEST-EFFORT — a ledger write must never fail a Reading the customer already has;
 *   2. it is a NO-OP before the migration lands, so the app runs identically either side of it.
 *
 * The third property — that a FAILED engine run never bills — is enforced by where this is
 * called (inside the success branch of route.ts, never at the placeholder INSERT), not by
 * anything in this module.
 */

function stubInsert(result: { error?: { code: string; message: string } } | "throws") {
  const insert = vi.fn(() => {
    if (result === "throws") return Promise.reject(new Error("socket hang up"));
    return Promise.resolve({ error: result.error ?? null });
  });
  const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;
  return { client, insert };
}

describe("recordReading", () => {
  it("writes one billed event against the delivered Reading", async () => {
    const { client, insert } = stubInsert({});

    await recordReading(client, {
      userId: "u1",
      analysisId: "abc123",
      mode: "score",
      tier: "starter",
    });

    expect(client.from).toHaveBeenCalledWith("reading_events");
    expect(insert).toHaveBeenCalledWith({
      user_id: "u1",
      analysis_id: "abc123",
      mode: "score",
      tier: "starter",
      billed: true,
    });
  });

  it("can record a delivered-but-unbilled Reading (a comp or a credit)", async () => {
    const { client, insert } = stubInsert({});
    await recordReading(client, { userId: "u1", analysisId: "abc123", billed: false });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ billed: false }));
  });

  it("is a silent no-op when the ledger table does not exist yet", async () => {
    // Pre-migration. Not a warning: the quota check is still counting analysis_results rows.
    const log = { warn: vi.fn() };
    const { client } = stubInsert({
      error: { code: "42P01", message: 'relation "reading_events" does not exist' },
    });

    await expect(
      recordReading(client, { userId: "u1", analysisId: "abc123" }, log)
    ).resolves.toBeUndefined();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("never throws — the customer has their Reading; losing the meter row must not fail it", async () => {
    const log = { warn: vi.fn() };
    const { client } = stubInsert("throws");

    await expect(
      recordReading(client, { userId: "u1", analysisId: "abc123" }, log)
    ).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(
      "reading_event_write_failed",
      expect.objectContaining({ analysisId: "abc123" })
    );
  });

  it("logs a real write failure rather than swallowing it", async () => {
    const log = { warn: vi.fn() };
    const { client } = stubInsert({ error: { code: "23503", message: "fk violation" } });

    await recordReading(client, { userId: "u1", analysisId: "abc123" }, log);
    expect(log.warn).toHaveBeenCalledWith(
      "reading_event_write_failed",
      expect.objectContaining({ error: "fk violation" })
    );
  });
});
