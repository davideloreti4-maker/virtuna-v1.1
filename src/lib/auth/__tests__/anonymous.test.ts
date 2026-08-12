import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureAnonymousSession } from "../anonymous";

/**
 * The double-mint race (measured on a production build 2026-08-04).
 *
 * `free-entry-cta.tsx` fires `prewarm()` un-awaited on pointerenter/focus, then the
 * click awaits its OWN `ensureAnonymousSession()`. Before the in-flight guard both
 * calls read "no session" before either sign-in resolved, and both minted: one click
 * produced two `POST /auth/v1/signup` calls and two `auth.users` rows 14µs apart.
 *
 * These tests exist because that bug is invisible to a sequential test — awaiting the
 * first call before making the second passes against the BROKEN implementation. The
 * concurrency has to be in the test or the test is the accomplice, so every case here
 * starts both calls before awaiting either, and `signInAnonymously` is deliberately
 * SLOW so the overlap is real rather than a scheduling accident.
 */

let signInCalls: number;
let sessionUser: { id: string } | null;
let signInError: { message: string } | null;

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: sessionUser ? { user: sessionUser } : null },
        error: null,
      })),
      signInAnonymously: vi.fn(async () => {
        signInCalls += 1;
        // The real round-trip measured ~3s; any await at all is enough to let a
        // second caller reach `getSession` before this resolves.
        await new Promise((r) => setTimeout(r, 10));
        if (signInError) return { data: { user: null }, error: signInError };
        return { data: { user: { id: `anon-${signInCalls}` } }, error: null };
      }),
    },
  })),
}));

beforeEach(() => {
  signInCalls = 0;
  sessionUser = null;
  signInError = null;
});

describe("ensureAnonymousSession — concurrency", () => {
  it("mints exactly ONE user when prewarm and click overlap", async () => {
    // Exactly the production sequence: prewarm fires and is NOT awaited, the click
    // follows immediately.
    const prewarm = ensureAnonymousSession();
    const click = ensureAnonymousSession();

    const [a, b] = await Promise.all([prewarm, click]);

    expect(signInCalls).toBe(1);
    expect(a).toEqual({ ok: true, userId: "anon-1", created: true });
    // Both callers get the SAME user — the click must not hand back a different
    // identity from the one the prewarm just created, or the thread splits.
    expect(b).toEqual(a);
  });

  it("mints once across many simultaneous callers", async () => {
    // The entry is mounted in eight places on /go; a fast scroll can focus more
    // than one.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => ensureAnonymousSession()),
    );

    expect(signInCalls).toBe(1);
    expect(new Set(results.map((r) => (r.ok ? r.userId : "err"))).size).toBe(1);
  });

  it("reuses an existing session without minting", async () => {
    // A REAL logged-in user who lands on /go keeps their own account — the
    // pre-existing contract this file's header calls out.
    sessionUser = { id: "real-user" };

    const [a, b] = await Promise.all([
      ensureAnonymousSession(),
      ensureAnonymousSession(),
    ]);

    expect(signInCalls).toBe(0);
    expect(a).toEqual({ ok: true, userId: "real-user", created: false });
    expect(b).toEqual(a);
  });

  it("clears the in-flight guard so a later caller can still mint", async () => {
    await ensureAnonymousSession();
    expect(signInCalls).toBe(1);

    // The guard is per-overlap, not a once-per-page latch: a visitor whose session
    // was cleared (private mode eviction, sign-out) must be able to start again.
    sessionUser = null;
    await ensureAnonymousSession();
    expect(signInCalls).toBe(2);
  });

  it("does not cache a FAILURE — a retry can still succeed", async () => {
    // The CTA turns its own label into the retry affordance on failure, so a
    // sticky rejected promise would leave a permanently dead button.
    signInError = { message: "anonymous sign-ins disabled" };
    const failed = await ensureAnonymousSession();
    expect(failed).toEqual({ ok: false, error: "anonymous sign-ins disabled" });

    signInError = null;
    const retried = await ensureAnonymousSession();
    expect(retried.ok).toBe(true);
  });
});
