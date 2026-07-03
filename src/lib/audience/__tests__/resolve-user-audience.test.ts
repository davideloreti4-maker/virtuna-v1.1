/**
 * resolveUserAudience — the shared USER-level last-used audience read (sibling to
 * resolveThreadAudience). Asserts the contract the composer mount seed + surfaces rely on:
 *
 *  - no user_settings row / last_audience_id NULL → General, WITHOUT a getAudience DB hit
 *  - a stored id → getAudience(supabase, id) under the session; returns the loaded audience
 *  - getAudience → null (not found / RLS-invisible) → General fallback (never blocks)
 *  - getAudience throws (DB error) → General fallback, no rethrow (no regression)
 *  - the user_settings read throws → General fallback
 *  - CR-01: the id passed to getAudience is the STORED one; the row is keyed by the session userId
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience } from "../audience-types";

// Mock getAudience on audience-repo; keep the real GENERAL_AUDIENCE so the fallback identity is
// the genuine virtual constant (mirrors the resolve-thread-audience test).
vi.mock("../audience-repo", async () => {
  const actual = await vi.importActual<typeof import("../audience-repo")>("../audience-repo");
  return { ...actual, getAudience: vi.fn() };
});

import { resolveUserAudience } from "../resolve-user-audience";
import { getAudience, GENERAL_AUDIENCE } from "../audience-repo";

const getAudienceMock = getAudience as ReturnType<typeof vi.fn>;

/** A minimal chainable supabase stub: from(t).select(c).eq(k,v).maybeSingle() → { data }. */
function makeSupabase(
  maybeSingleResult: { data: { last_audience_id: string | null } | null } | Error,
): { supabase: SupabaseClient; eqArgs: () => [string, unknown] | null } {
  let captured: [string, unknown] | null = null;
  const maybeSingle = () =>
    maybeSingleResult instanceof Error
      ? Promise.reject(maybeSingleResult)
      : Promise.resolve(maybeSingleResult);
  const supabase = {
    from: () => ({
      select: () => ({
        eq: (col: string, val: unknown) => {
          captured = [col, val];
          return { maybeSingle };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { supabase, eqArgs: () => captured };
}

describe("resolveUserAudience", () => {
  beforeEach(() => {
    getAudienceMock.mockReset();
  });

  it("returns General WITHOUT a DB hit when there is no user_settings row", async () => {
    const { supabase } = makeSupabase({ data: null });
    const result = await resolveUserAudience(supabase, "user-1");
    expect(result).toBe(GENERAL_AUDIENCE);
    expect(getAudienceMock).not.toHaveBeenCalled();
  });

  it("returns General WITHOUT a getAudience hit when last_audience_id is null", async () => {
    const { supabase } = makeSupabase({ data: { last_audience_id: null } });
    const result = await resolveUserAudience(supabase, "user-1");
    expect(result).toBe(GENERAL_AUDIENCE);
    expect(getAudienceMock).not.toHaveBeenCalled();
  });

  it("loads the stored audience under the session (CR-01 — stored id + session userId)", async () => {
    const loaded = { id: "aud-9", is_general: false } as unknown as Audience;
    getAudienceMock.mockResolvedValue(loaded);
    const { supabase, eqArgs } = makeSupabase({ data: { last_audience_id: "aud-9" } });

    const result = await resolveUserAudience(supabase, "user-42");

    expect(result).toBe(loaded);
    expect(getAudienceMock).toHaveBeenCalledTimes(1);
    expect(getAudienceMock.mock.calls[0]![0]).toBe(supabase);
    expect(getAudienceMock.mock.calls[0]![1]).toBe("aud-9");
    // Keyed by the session user id, never a request-body value.
    expect(eqArgs()).toEqual(["user_id", "user-42"]);
  });

  it("falls back to General when the stored id resolves to null (deleted / RLS-invisible)", async () => {
    getAudienceMock.mockResolvedValue(null);
    const { supabase } = makeSupabase({ data: { last_audience_id: "gone" } });
    const result = await resolveUserAudience(supabase, "user-1");
    expect(result).toBe(GENERAL_AUDIENCE);
  });

  it("falls back to General (no rethrow) when getAudience throws", async () => {
    getAudienceMock.mockRejectedValue(new Error("db down"));
    const { supabase } = makeSupabase({ data: { last_audience_id: "aud-err" } });
    const result = await resolveUserAudience(supabase, "user-1");
    expect(result).toBe(GENERAL_AUDIENCE);
  });

  it("falls back to General when the user_settings read itself throws", async () => {
    const { supabase } = makeSupabase(new Error("settings read failed"));
    const result = await resolveUserAudience(supabase, "user-1");
    expect(result).toBe(GENERAL_AUDIENCE);
    expect(getAudienceMock).not.toHaveBeenCalled();
  });
});
