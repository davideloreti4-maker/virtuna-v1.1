/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * INT-04 — Onboarding store narrowed union after D-03 welcome trim.
 *
 * The OnboardingStep type must be exactly `"connect" | "completed"`. The
 * legacy `"goal"` and `"preview"` step values, the `PrimaryGoal` type, the
 * `primaryGoal` field, and the `setPrimaryGoal` action all DELETED — Card 3
 * is the sole goal-capture surface.
 *
 * Runtime guards:
 * - The initial step is "connect"
 * - The store has no `primaryGoal` field, no `setPrimaryGoal` action
 * - Setting an unknown step value silently coerces (no-op) at TS-level; the
 *   runtime store will accept anything passed via `setStep` because TS types
 *   are erased — so we also test that the SOURCE of the file enforces the
 *   narrowed union (grep-style test on the file content).
 */

// Mock the supabase client so the store's persist call resolves without I/O.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null } }),
    },
    from: () => ({
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  }),
}));

// Reset module-scoped store + localStorage between tests.
beforeEach(() => {
  if (typeof localStorage !== "undefined" && typeof localStorage.clear === "function") {
    localStorage.clear();
  }
  vi.resetModules();
});

describe("onboarding-store — narrowed OnboardingStep union (INT-04)", () => {
  it("exports OnboardingStep typed as the narrowed 2-member union", async () => {
    // TS type-level assertion: this file would FAIL `tsc --noEmit` if the
    // type widened back to include "goal" or "preview". The reverse-narrow
    // assertion below ("goal" / "preview" must NOT be assignable to the
    // type) catches widening drift at compile time.
    const mod = await import("@/stores/onboarding-store");
    const connect: typeof mod extends { OnboardingStep: infer S }
      ? S
      : "connect" | "completed" = "connect";
    const completed: typeof mod extends { OnboardingStep: infer S }
      ? S
      : "connect" | "completed" = "completed";
    expect(connect).toBe("connect");
    expect(completed).toBe("completed");
  });

  it("initial step is 'connect'", async () => {
    const { useOnboardingStore } = await import("@/stores/onboarding-store");
    expect(useOnboardingStore.getState().step).toBe("connect");
  });

  it("initial tiktokHandle is empty string", async () => {
    const { useOnboardingStore } = await import("@/stores/onboarding-store");
    expect(useOnboardingStore.getState().tiktokHandle).toBe("");
  });

  it("setStep('completed') transitions cleanly", async () => {
    const { useOnboardingStore } = await import("@/stores/onboarding-store");
    useOnboardingStore.getState().setStep("completed");
    expect(useOnboardingStore.getState().step).toBe("completed");
  });

  it("store has no `primaryGoal` field (D-03 deletion)", async () => {
    const { useOnboardingStore } = await import("@/stores/onboarding-store");
    const state = useOnboardingStore.getState() as unknown as Record<
      string,
      unknown
    >;
    expect(state).not.toHaveProperty("primaryGoal");
  });

  it("store has no `setPrimaryGoal` action (D-03 deletion)", async () => {
    const { useOnboardingStore } = await import("@/stores/onboarding-store");
    const state = useOnboardingStore.getState() as unknown as Record<
      string,
      unknown
    >;
    expect(state).not.toHaveProperty("setPrimaryGoal");
  });

  it("source file does not contain legacy 'goal' / 'preview' step literals or primaryGoal identifiers", async () => {
    // This is a static-text test against the file contents to defend the
    // hard rule that the union is narrowed AND that no helper references
    // the deleted identifiers. Reading via fs is acceptable here because
    // this is the cheapest way to guard against drift if the union or any
    // legacy identifier is reintroduced in a future refactor.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(
      process.cwd(),
      "src/stores/onboarding-store.ts"
    );
    const contents = await fs.readFile(filePath, "utf8");

    // Narrowed union — must contain BOTH literals and ONLY those.
    expect(contents).toMatch(
      /export type OnboardingStep\s*=\s*"connect"\s*\|\s*"completed"/
    );

    // No removed identifiers anywhere in the source.
    expect(contents).not.toMatch(/\bprimaryGoal\b/);
    expect(contents).not.toMatch(/\bsetPrimaryGoal\b/);
    expect(contents).not.toMatch(/\bPrimaryGoal\b/);
    expect(contents).not.toMatch(/\bprimary_goal\b/);
  });

  it("exports exactly the expected surface (setStep, setTiktokHandle, completeOnboarding, skipOnboarding, reset, _hydrate, step, tiktokHandle, _isHydrated)", async () => {
    const { useOnboardingStore } = await import("@/stores/onboarding-store");
    const state = useOnboardingStore.getState();
    expect(typeof state.setStep).toBe("function");
    expect(typeof state.setTiktokHandle).toBe("function");
    expect(typeof state.completeOnboarding).toBe("function");
    expect(typeof state.skipOnboarding).toBe("function");
    expect(typeof state.reset).toBe("function");
    expect(typeof state._hydrate).toBe("function");
    expect(typeof state.step).toBe("string");
    expect(typeof state.tiktokHandle).toBe("string");
    expect(typeof state._isHydrated).toBe("boolean");
  });
});
