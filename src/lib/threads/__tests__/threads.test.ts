/**
 * threads.test.ts — createGroundedThreadLazy idempotency + ownership tests.
 *
 * Covers the two code-review Criticals fixed in threads.ts:
 *   CR-01 — the conflict read-back is scoped by user_id, so a caller passing
 *           another user's reading_id is denied (service client bypasses RLS).
 *   CR-02 — no ON CONFLICT against the partial unique index; a duplicate open
 *           surfaces as unique_violation (23505) and is recovered by re-select.
 *
 * Mocks createServiceClient so no live DB is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/service";
import { createGroundedThreadLazy } from "../threads";
import type { ThreadRow } from "../threads";

const READING_ID = "a414dfa2-9fc7-4c02-947d-7488ab5a9716";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function makeRow(overrides: Partial<ThreadRow> = {}): ThreadRow {
  return {
    id: "00000000-0000-0000-0000-0000000000aa",
    user_id: USER_A,
    type: "grounded",
    reading_id: READING_ID,
    created_at: "2026-06-17T00:00:00Z",
    updated_at: "2026-06-17T00:00:00Z",
    ...overrides,
  };
}

/**
 * Chain mock: every builder method returns `this`; `single` is queued so the
 * insert path's single() (call 1) and the conflict re-select's single() (call 2)
 * can be configured independently.
 */
function buildChain() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return chain;
}

describe("createGroundedThreadLazy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the freshly-inserted row on first open", async () => {
    const row = makeRow();
    const chain = buildChain();
    chain.single.mockResolvedValueOnce({ data: row, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await createGroundedThreadLazy(READING_ID, USER_A);

    expect(result).toEqual(row);
    expect(chain.insert).toHaveBeenCalledTimes(1);
    // No conflict path: single() called exactly once (the insert read-back).
    expect(chain.single).toHaveBeenCalledTimes(1);
  });

  it("recovers the existing row on a unique_violation (CR-02, idempotent re-open)", async () => {
    const existing = makeRow();
    const chain = buildChain();
    // Insert collides on the partial unique index → 23505.
    chain.single.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key" } });
    // Re-select returns the existing thread for this (reading_id, user_id).
    chain.single.mockResolvedValueOnce({ data: existing, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await createGroundedThreadLazy(READING_ID, USER_A);

    expect(result).toEqual(existing);
    // Re-select is scoped by BOTH reading_id and user_id (CR-01 ownership guard).
    expect(chain.eq).toHaveBeenCalledWith("reading_id", READING_ID);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_A);
  });

  it("denies a reading_id owned by another user (CR-01 cross-user guard)", async () => {
    const chain = buildChain();
    // A thread for this reading_id exists → insert raises 23505...
    chain.single.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key" } });
    // ...but the user_id-scoped re-select finds nothing for USER_B → denied.
    chain.single.mockResolvedValueOnce({ data: null, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(createGroundedThreadLazy(READING_ID, USER_B)).rejects.toThrow(
      /not owned by userId/,
    );
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_B);
  });

  it("throws on a non-conflict insert error", async () => {
    const chain = buildChain();
    chain.single.mockResolvedValueOnce({ data: null, error: { code: "23503", message: "fk violation" } });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(createGroundedThreadLazy(READING_ID, USER_A)).rejects.toThrow(
      /failed to create thread/,
    );
    // Did not attempt a conflict re-select.
    expect(chain.single).toHaveBeenCalledTimes(1);
  });
});
