/**
 * open-thread.test.ts — createOpenThreadLazy idempotency + ownership tests.
 *
 * Mirrors the createGroundedThreadLazy test pattern from threads.test.ts.
 *
 * Covers:
 *   - First-open: inserts and returns a new open thread (type:"open", reading_id:null).
 *   - Idempotent re-open: 23505 unique_violation → re-select returns existing thread.
 *   - CR-01 cross-user guard: re-select scoped by user_id → throw on mismatch.
 *   - Non-conflict insert error → throws.
 *   - type:"open" and reading_id:null are set on the insert (not sourced from request body).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/service";
import { createOpenThreadLazy } from "../threads";
import type { ThreadRow } from "../threads";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeOpenRow(overrides: Partial<ThreadRow> = {}): ThreadRow {
  return {
    id: "00000000-0000-0000-0000-0000000000bb",
    user_id: USER_A,
    type: "open",
    reading_id: null,
    created_at: "2026-06-17T00:00:00Z",
    updated_at: "2026-06-17T00:00:00Z",
    ...overrides,
  };
}

/**
 * Build a chainable mock client that supports:
 *   .from().insert().select().single()
 *   .from().select().eq().eq().is().maybeSingle()
 */
function buildChain() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
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
    const insertArg = chain.insert.mock.calls[0][0];
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
