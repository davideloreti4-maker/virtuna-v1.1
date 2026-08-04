/**
 * onboarding-store — completion ORDER, not just completion.
 *
 * The welcome page redirects to /home the instant `step` becomes "completed", and
 * middleware.ts:173 admits /home only when `onboarding_completed_at` is present in the
 * DATABASE. So flipping the step before the write lands races the redirect against its own
 * precondition, and middleware bounces the user back to /welcome — after a ~128s calibration.
 *
 * Reproduced live on the resume path (2026-08-02). These lock the sequence: DB first, step
 * second. A plain "does it complete" assertion cannot see this — both orderings end up
 * completed, which is exactly why the bug survived.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let resolveUpdate: (v: unknown) => void;
let updateCalls = 0;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      // A REAL user — with `null` here persistToSupabase returns before writing and the
      // ordering under test never happens.
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
    },
    from: () => ({
      update: () => ({
        eq: () => {
          updateCalls += 1;
          return new Promise((r) => {
            resolveUpdate = r;
          });
        },
      }),
    }),
  }),
}));

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
  updateCalls = 0;
  vi.resetModules();
});

describe("completeOnboarding — the DB write lands before the step flips", () => {
  it("holds step at 'connect' while the write is still in flight", async () => {
    const { useOnboardingStore } = await import("../onboarding-store");
    useOnboardingStore.setState({ step: "connect", tiktokHandle: "zachking" });

    const pending = useOnboardingStore.getState().completeOnboarding();
    await Promise.resolve(); // let persistToSupabase reach its awaited update

    // The window that used to break it: redirecting now sends the user to a /home that
    // middleware will refuse, because the row it reads is not written yet.
    expect(updateCalls).toBe(1);
    expect(useOnboardingStore.getState().step).toBe("connect");

    resolveUpdate({ error: null });
    await pending;

    expect(useOnboardingStore.getState().step).toBe("completed");
  });

  it("skipOnboarding holds the same order", async () => {
    const { useOnboardingStore } = await import("../onboarding-store");
    useOnboardingStore.setState({ step: "connect", tiktokHandle: "" });

    const pending = useOnboardingStore.getState().skipOnboarding();
    await Promise.resolve();

    expect(useOnboardingStore.getState().step).toBe("connect");

    resolveUpdate({ error: null });
    await pending;

    expect(useOnboardingStore.getState().step).toBe("completed");
  });
});
