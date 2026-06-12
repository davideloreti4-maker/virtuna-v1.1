/**
 * waitlist-count.test.ts — Wave-0 Nyquist scaffold for PROOF-01 (getWaitlistCount).
 *
 * RED until Plan 03-05 ships `@/lib/waitlist-count`. Mocks `@/lib/supabase/server`
 * so `rpc("waitlist_count")` is a spy — no real DB or network (mocked boundary).
 *
 * Two unit cases encode the count-read contract:
 *  1. Passthrough — rpc `{ data: 42, error: null }` → getWaitlistCount() resolves 42.
 *  2. Fail-soft — rpc `{ data: null, error: {...} }` → resolves 0 (never throws;
 *     the proof block degrades to its below-threshold copy, never a broken page).
 *
 * Module imported dynamically inside each test so the file is RED on the missing
 * `@/lib/waitlist-count` module, not on an assertion typo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcSpy = vi.fn(async () => ({ data: 0 as number | null, error: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: rpcSpy,
  })),
}));

describe("getWaitlistCount — PROOF-01 count read (RED until Plan 03-05)", () => {
  beforeEach(() => {
    rpcSpy.mockClear();
  });

  it("passes the RPC number straight through (data: 42 → 42)", async () => {
    rpcSpy.mockResolvedValueOnce({ data: 42, error: null });
    const { getWaitlistCount } = await import("@/lib/waitlist-count");
    await expect(getWaitlistCount()).resolves.toBe(42);
  });

  it("fail-soft: rpc error resolves 0, never throws", async () => {
    rpcSpy.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const { getWaitlistCount } = await import("@/lib/waitlist-count");
    await expect(getWaitlistCount()).resolves.toBe(0);
  });
});
