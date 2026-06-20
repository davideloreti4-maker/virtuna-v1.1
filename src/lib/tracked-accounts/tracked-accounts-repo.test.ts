/**
 * Phase 11 Plan 03 — tracked-accounts-repo (EXPLORE-05 / D-08, the watchlist PRODUCER half).
 *
 * RED phase: these tests fail until tracked-accounts-repo.ts is implemented.
 *
 * Honesty + security spine (CR-01): user_id is ALWAYS session-derived, NEVER from
 * the request body; the write is an idempotent upsert on the UNIQUE(user_id,platform,handle)
 * constraint so re-tracking the same account is a no-op (returns the existing row).
 *
 * Assertions:
 *  - createTrackedAccount derives user_id from the session and IGNORES a body user_id (CR-01)
 *  - createTrackedAccount normalizes the handle ("@GymBeginner" → "gymbeginner")
 *  - createTrackedAccount throws "invalid tracked account input…" on a bad platform (400-mappable)
 *  - createTrackedAccount throws "unauthenticated" when there is no session
 *  - the insert is an idempotent upsert with onConflict "user_id,platform,handle"
 *  - listTrackedAccounts selects newest-first; deleteTrackedAccount deletes by id
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Supabase client mock: chainable query builder; tests override per-case.
function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  const client = {
    from: vi.fn().mockReturnValue(chain),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      }),
    },
    _chain: chain,
  };
  return client;
}

// ─── Imports (module under test) ──────────────────────────────────────────────

import {
  listTrackedAccounts,
  createTrackedAccount,
  deleteTrackedAccount,
} from "@/lib/tracked-accounts/tracked-accounts-repo";

// ─── createTrackedAccount — CR-01 (session-derived user_id) ────────────────────

describe("createTrackedAccount — CR-01 session-derived user_id", () => {
  it("derives user_id from the session, NEVER from the body", async () => {
    const supabase = makeSupabaseMock({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "row-1",
          user_id: "test-user-id",
          platform: "tiktok",
          handle: "gymbeginner",
          source_video_id: null,
          created_at: "2026-06-20T00:00:00Z",
        },
        error: null,
      }),
    });

    // A malicious body attempts to set a foreign user_id — it MUST be ignored.
    await createTrackedAccount(supabase as unknown as SupabaseClient, {
      platform: "tiktok",
      handle: "gymbeginner",
      // @ts-expect-error — user_id is not part of the writable input (CR-01)
      user_id: "attacker-user-id",
    });

    // The session was consulted for the identity.
    expect(supabase.auth.getUser).toHaveBeenCalled();

    // The payload written carries the SESSION user_id, never the body's.
    const writeArg = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(writeArg.user_id).toBe("test-user-id");
    expect(writeArg.user_id).not.toBe("attacker-user-id");
  });

  it("throws 'unauthenticated' when there is no session", async () => {
    const supabase = makeSupabaseMock();
    supabase.auth.getUser = vi
      .fn()
      .mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      createTrackedAccount(supabase as unknown as SupabaseClient, {
        platform: "tiktok",
        handle: "gymbeginner",
      }),
    ).rejects.toThrow("unauthenticated");
  });
});

// ─── createTrackedAccount — handle normalization ──────────────────────────────

describe("createTrackedAccount — handle normalization", () => {
  it("strips a leading '@' and lowercases the handle (@GymBeginner → gymbeginner)", async () => {
    const supabase = makeSupabaseMock({
      single: vi.fn().mockResolvedValue({
        data: { id: "row-1", user_id: "test-user-id", platform: "tiktok", handle: "gymbeginner", source_video_id: null, created_at: "2026-06-20T00:00:00Z" },
        error: null,
      }),
    });

    await createTrackedAccount(supabase as unknown as SupabaseClient, {
      platform: "tiktok",
      handle: "@GymBeginner",
    });

    const writeArg = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(writeArg.handle).toBe("gymbeginner");
  });
});

// ─── createTrackedAccount — validation (400-mappable) ─────────────────────────

describe("createTrackedAccount — zod validation", () => {
  it("throws an 'invalid tracked account input' error on a bad platform", async () => {
    const supabase = makeSupabaseMock();

    await expect(
      createTrackedAccount(supabase as unknown as SupabaseClient, {
        // @ts-expect-error — "linkedin" is not a valid platform
        platform: "linkedin",
        handle: "someone",
      }),
    ).rejects.toThrow(/^invalid tracked account input/);
  });
});

// ─── createTrackedAccount — idempotent upsert ─────────────────────────────────

describe("createTrackedAccount — idempotent upsert (UNIQUE constraint)", () => {
  it("uses an upsert with onConflict 'user_id,platform,handle'", async () => {
    const supabase = makeSupabaseMock({
      single: vi.fn().mockResolvedValue({
        data: { id: "row-1", user_id: "test-user-id", platform: "tiktok", handle: "gymbeginner", source_video_id: null, created_at: "2026-06-20T00:00:00Z" },
        error: null,
      }),
    });

    await createTrackedAccount(supabase as unknown as SupabaseClient, {
      platform: "tiktok",
      handle: "gymbeginner",
    });

    expect(supabase._chain.upsert).toHaveBeenCalledTimes(1);
    const onConflictArg = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(onConflictArg).toMatchObject({ onConflict: "user_id,platform,handle" });
  });
});

// ─── listTrackedAccounts / deleteTrackedAccount ───────────────────────────────

describe("listTrackedAccounts", () => {
  it("selects from tracked_accounts ordered newest-first", async () => {
    const supabase = makeSupabaseMock({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    await listTrackedAccounts(supabase as unknown as SupabaseClient);

    expect(supabase.from).toHaveBeenCalledWith("tracked_accounts");
    expect(supabase._chain.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("throws when the query errors", async () => {
    const supabase = makeSupabaseMock({
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    });

    await expect(
      listTrackedAccounts(supabase as unknown as SupabaseClient),
    ).rejects.toThrow(/boom/);
  });
});

describe("deleteTrackedAccount", () => {
  it("deletes by id", async () => {
    const supabase = makeSupabaseMock({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await deleteTrackedAccount(supabase as unknown as SupabaseClient, "row-1");

    expect(supabase.from).toHaveBeenCalledWith("tracked_accounts");
    expect(supabase._chain.delete).toHaveBeenCalled();
    expect(supabase._chain.eq).toHaveBeenCalledWith("id", "row-1");
  });
});
