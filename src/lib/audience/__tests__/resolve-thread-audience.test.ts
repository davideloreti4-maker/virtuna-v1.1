/**
 * resolveThreadAudience — the shared per-thread audience read (D-04 pin), extracted from the
 * six generative tool routes (E2 de-dup). These assert the contract every route relied on:
 *
 *  - active_audience_id NULL/absent → General default, WITHOUT a getAudience DB hit
 *  - non-null id → getAudience(supabase, id) under the session; returns the loaded audience
 *  - getAudience → null (not found) → General fallback (never blocks)
 *  - getAudience throws (DB error) → General fallback, no rethrow (no regression)
 *  - CR-01: the id passed to getAudience is the THREAD's, never anything else
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience } from "../audience-types";

// Mock getAudience on audience-repo; keep the real GENERAL_AUDIENCE (via importActual spread) so
// the fallback identity is the genuine virtual constant.
vi.mock("../audience-repo", async () => {
  const actual = await vi.importActual<typeof import("../audience-repo")>("../audience-repo");
  return { ...actual, getAudience: vi.fn() };
});

import { resolveThreadAudience } from "../resolve-thread-audience";
import { getAudience, GENERAL_AUDIENCE } from "../audience-repo";

const supabase = {} as SupabaseClient; // getAudience is mocked — the client is never touched.
const getAudienceMock = getAudience as ReturnType<typeof vi.fn>;

describe("resolveThreadAudience", () => {
  beforeEach(() => {
    getAudienceMock.mockReset();
  });

  it("returns General WITHOUT a DB hit when active_audience_id is null", async () => {
    const result = await resolveThreadAudience(supabase, { active_audience_id: null });
    expect(result).toBe(GENERAL_AUDIENCE);
    expect(getAudienceMock).not.toHaveBeenCalled();
  });

  it("returns General WITHOUT a DB hit when active_audience_id is absent", async () => {
    const result = await resolveThreadAudience(supabase, {});
    expect(result).toBe(GENERAL_AUDIENCE);
    expect(getAudienceMock).not.toHaveBeenCalled();
  });

  it("loads the audience under the session for a non-null id (CR-01 — thread id only)", async () => {
    const loaded = { id: "aud-1", is_general: false } as unknown as Audience;
    getAudienceMock.mockResolvedValue(loaded);

    const result = await resolveThreadAudience(supabase, { active_audience_id: "aud-1" });

    expect(result).toBe(loaded);
    expect(getAudienceMock).toHaveBeenCalledTimes(1);
    expect(getAudienceMock.mock.calls[0]![0]).toBe(supabase);
    expect(getAudienceMock.mock.calls[0]![1]).toBe("aud-1");
  });

  it("falls back to General when the id resolves to null (not found)", async () => {
    getAudienceMock.mockResolvedValue(null);
    const result = await resolveThreadAudience(supabase, { active_audience_id: "missing" });
    expect(result).toBe(GENERAL_AUDIENCE);
  });

  it("falls back to General (no rethrow) when getAudience throws", async () => {
    getAudienceMock.mockRejectedValue(new Error("db down"));
    const result = await resolveThreadAudience(supabase, { active_audience_id: "aud-err" });
    expect(result).toBe(GENERAL_AUDIENCE);
  });

  // ── AUD-SYNC-01: a NULL thread pin + a userId falls back to the user's LAST-USED audience ──
  // (resolveUserAudience reads user_settings.last_audience_id → getAudience). This keeps the runner
  // in sync with the composer pill; before the fix a fresh thread hard-defaulted to General.
  //
  // resolveUserAudience touches supabase.from("user_settings")…maybeSingle(), so these tests give a
  // minimal chainable stub for that ONE read (getAudience itself stays mocked on audience-repo).
  function supabaseWithLastAudience(lastAudienceId: string | null): SupabaseClient {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { last_audience_id: lastAudienceId } }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
  }

  it("falls back to the user's LAST-USED audience when the pin is null and a userId is given", async () => {
    const lastUsed = { id: "aud-last", is_general: false } as unknown as Audience;
    getAudienceMock.mockResolvedValue(lastUsed);
    const db = supabaseWithLastAudience("aud-last");

    const result = await resolveThreadAudience(db, { active_audience_id: null }, "user-1");

    expect(result).toBe(lastUsed);
    expect(getAudienceMock).toHaveBeenCalledWith(db, "aud-last");
  });

  it("resolves General when the pin is null, a userId is given, but last_audience_id is null", async () => {
    const db = supabaseWithLastAudience(null);
    const result = await resolveThreadAudience(db, { active_audience_id: null }, "user-1");
    expect(result).toBe(GENERAL_AUDIENCE);
    expect(getAudienceMock).not.toHaveBeenCalled();
  });

  it("keeps the legacy hard-General fallback when the pin is null and NO userId is given", async () => {
    const result = await resolveThreadAudience(supabase, { active_audience_id: null });
    expect(result).toBe(GENERAL_AUDIENCE);
    expect(getAudienceMock).not.toHaveBeenCalled();
  });
});
