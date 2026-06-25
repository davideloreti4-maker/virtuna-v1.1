/**
 * open-thread.test.ts — createOpenThreadLazy idempotency + ownership tests.
 *
 * Covers:
 *   - First-open: inserts and returns a new open thread (type:"open", reading_id:null).
 *   - Idempotent re-open: 23505 unique_violation → re-select returns existing thread.
 *   - CR-01 cross-user guard: re-select scoped by user_id → throw on mismatch.
 *   - Non-conflict insert error → throws.
 *   - type:"open" and reading_id:null are set on the insert (not sourced from request body).
 *   - getOpenThread does NOT throw when multiple rows exist (duplicate-tolerance regression).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/service";
import { createOpenThreadLazy, getOpenThread } from "../threads";
import type { ThreadRow } from "../threads";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeOpenRow(overrides: Partial<ThreadRow> = {}): ThreadRow {
  return {
    id: "00000000-0000-0000-0000-0000000000bb",
    user_id: USER_A,
    type: "open",
    reading_id: null,
    active_audience_id: null,
    created_at: "2026-06-17T00:00:00Z",
    updated_at: "2026-06-17T00:00:00Z",
    ...overrides,
  };
}

/**
 * Build a chainable mock client that supports:
 *   .from().insert().select().single()
 *   .from().select().eq().eq().is().order().limit().maybeSingle()
 *
 * NOTE: getOpenThread now uses .order().limit().maybeSingle() (not bare
 * .maybeSingle()) so the chain must include order + limit returning `this`.
 */
function buildChain() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return chain;
}

describe("createOpenThreadLazy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts and returns a new open thread on first open", async () => {
    const row = makeOpenRow();
    const chain = buildChain();
    chain.single.mockResolvedValueOnce({ data: row, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await createOpenThreadLazy(USER_A);

    expect(result).toEqual(row);
    expect(chain.insert).toHaveBeenCalledTimes(1);
    // insert should set type:"open" and reading_id:null
    const insertArg = chain.insert.mock.calls[0]![0];
    expect(insertArg.type).toBe("open");
    expect(insertArg.reading_id).toBeNull();
    expect(insertArg.user_id).toBe(USER_A);
  });

  it("recovers existing open thread on 23505 unique_violation (idempotent re-open)", async () => {
    const existing = makeOpenRow();
    const chain = buildChain();
    // Insert collides (concurrent open) → 23505
    chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    // Re-select via getOpenThread (which uses .maybeSingle())
    chain.maybeSingle.mockResolvedValueOnce({ data: existing, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await createOpenThreadLazy(USER_A);

    expect(result).toEqual(existing);
    // Ownership scoped by user_id (CR-01)
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_A);
  });

  it("denies access if concurrent open thread belongs to another user (CR-01)", async () => {
    const chain = buildChain();
    chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    // user_id-scoped re-select finds nothing for USER_B → denied
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(createOpenThreadLazy(USER_B)).rejects.toThrow(/not owned by userId|open thread/);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_B);
  });

  it("throws on a non-conflict insert error", async () => {
    const chain = buildChain();
    chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23503", message: "fk violation" },
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(createOpenThreadLazy(USER_A)).rejects.toThrow(/failed to create/);
    // No conflict recovery attempted
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(chain.maybeSingle).not.toHaveBeenCalled();
  });
});

// ─── Regression: getOpenThread duplicate tolerance ─────────────────────────
// Root-cause fix: before migration 20260618000000 multiple open threads could
// exist per user. Using bare .maybeSingle() would throw PGRST116 in that
// state. The fix uses .order("created_at", asc).limit(1).maybeSingle() so
// the call always resolves to at most one row regardless of how many exist.

describe("getOpenThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns oldest row without throwing when multiple open threads exist (duplicate tolerance)", async () => {
    const oldest = makeOpenRow({
      id: "00000000-0000-0000-0000-000000000001",
      created_at: "2026-06-01T00:00:00Z",
    });
    const chain = buildChain();
    // Simulates DB returning a single row after server-side order+limit — the
    // mock just resolves to the oldest row as the DB would after ORDER BY + LIMIT 1.
    chain.maybeSingle.mockResolvedValueOnce({ data: oldest, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await getOpenThread(USER_A);

    expect(result).toEqual(oldest);
    // Verify order + limit are part of the query chain (the shape that prevents
    // PGRST116 when duplicates exist).
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(chain.maybeSingle).toHaveBeenCalledTimes(1);
    // Must NOT throw — this is the regression assertion.
  });

  it("returns null when no open thread exists", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await getOpenThread(USER_A);

    expect(result).toBeNull();
  });

  it("throws on a real query error (not on duplicate rows)", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(getOpenThread(USER_A)).rejects.toThrow(/getOpenThread: failed/);
  });

  it("scopes query by user_id (CR-01 ownership enforcement)", async () => {
    const row = makeOpenRow({ user_id: USER_B });
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: row, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await getOpenThread(USER_B);

    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_B);
    expect(chain.eq).toHaveBeenCalledWith("type", "open");
    expect(chain.is).toHaveBeenCalledWith("reading_id", null);
  });
});
