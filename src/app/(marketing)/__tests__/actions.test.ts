/**
 * actions.test.ts — Wave-0 Nyquist scaffold for CTA-02 (joinWaitlist server action).
 *
 * RED until Plan 03-05 ships `@/app/(marketing)/actions`. Mocks
 * `@/lib/supabase/server`'s `createClient` so `from("waitlist").insert(...)` is a
 * spy and no real DB or network is touched (T-03-01 trust boundary: mocked).
 *
 * Three unit cases encode the joinWaitlist contract Plan 05 implements against:
 *  1. Honeypot — a filled `company` field resolves success WITHOUT inserting (bot
 *     silently dropped; no error leak).
 *  2. Invalid email — "notanemail" resolves `{ status: "error" }` WITHOUT inserting.
 *  3. Duplicate — insert returns Postgres unique-violation `23505` → resolves
 *     `{ status: "success" }` (dup-as-success: T-03-01 no-enumeration-leak — the
 *     scaffold is the guard so Plan 05 cannot ship an existence-leak GREEN).
 *
 * The module is imported dynamically INSIDE each test (repo scaffold idiom) so the
 * file fails on the missing target module now — RED on `@/app/(marketing)/actions`,
 * not on an assertion typo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Spy the waitlist insert; default resolves no error (happy path / honeypot drop).
const insertSpy = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({ insert: insertSpy })),
  })),
}));

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("joinWaitlist — CTA-02 server-action seam (RED until Plan 03-05)", () => {
  beforeEach(() => {
    insertSpy.mockClear();
    insertSpy.mockResolvedValue({ error: null });
  });

  it("honeypot: a filled `company` field resolves success and never inserts", async () => {
    const { joinWaitlist } = await import("@/app/(marketing)/actions");
    const result = await joinWaitlist(
      { status: "idle" },
      fd({ email: "real@example.com", company: "bot-filled-this" }),
    );
    expect(result.status).toBe("success");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("invalid email: 'notanemail' resolves error and never inserts", async () => {
    const { joinWaitlist } = await import("@/app/(marketing)/actions");
    const result = await joinWaitlist({ status: "idle" }, fd({ email: "notanemail" }));
    expect(result.status).toBe("error");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("duplicate: insert returns 23505 → success (dup-as-success, no enumeration leak)", async () => {
    insertSpy.mockResolvedValueOnce({ error: { code: "23505" } });
    const { joinWaitlist } = await import("@/app/(marketing)/actions");
    const result = await joinWaitlist(
      { status: "idle" },
      fd({ email: "already@example.com" }),
    );
    expect(result.status).toBe("success");
    expect(insertSpy).toHaveBeenCalled();
  });
});
