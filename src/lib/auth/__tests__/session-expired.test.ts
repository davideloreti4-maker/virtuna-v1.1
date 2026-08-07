/** @vitest-environment happy-dom */

/**
 * THE CLIENT HALF OF THE 401 — announced, never navigated.
 *
 * The navigation half is deliberately absent and stays absent: `AuthGuard`
 * (components/app/auth-guard.tsx:42) is the declared single owner of the /login redirect, and
 * WR-04 records what two competing router calls did to the landing route. There is no test here
 * for "it redirects" because redirecting is the defect.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import {
  SESSION_EXPIRED_EVENT,
  raiseSessionExpired,
  reportSession401,
  SessionExpiredRefusal,
  isSessionExpiredRefusal,
} from "@/lib/auth/session-expired";
import { classifyRunFailure, resolveRunError, runErrorCopy } from "@/lib/net/run-failure";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Subscribe for the duration of one assertion, so a leaked listener cannot pass the next test. */
function withListener(run: (listener: ReturnType<typeof vi.fn>) => void) {
  const listener = vi.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  try {
    run(listener);
  } finally {
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  }
}

describe("reportSession401", () => {
  it("raises the event on a 401 and reports that it did", () => {
    withListener((listener) => {
      expect(reportSession401(401)).toBe(true);
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  it("ignores every other status, including the credit 402", () => {
    withListener((listener) => {
      for (const status of [200, 402, 403, 429, 500]) {
        expect(reportSession401(status), `status ${status} must not be a session refusal`).toBe(
          false,
        );
      }
      expect(listener).not.toHaveBeenCalled();
    });
  });

  /**
   * The module is imported by client components that also render on the server. Without the
   * `typeof window` guard this throws during SSR rather than no-opping — and a throw in a render
   * path is a blank page, not a missing dialog.
   */
  it("no-ops where there is no window at all (SSR), rather than throwing", () => {
    vi.stubGlobal("window", undefined);
    expect(() => raiseSessionExpired()).not.toThrow();
    expect(() => reportSession401(401)).not.toThrow();
  });
});

describe("SessionExpiredRefusal", () => {
  it("is identified by its flag, so the check survives module duplication", () => {
    expect(isSessionExpiredRefusal(new SessionExpiredRefusal())).toBe(true);
    expect(isSessionExpiredRefusal({ sessionExpired: true })).toBe(true);
    expect(isSessionExpiredRefusal(new Error("nope"))).toBe(false);
    expect(isSessionExpiredRefusal(null)).toBe(false);
  });

  /** Strictly `=== true`. A truthy check would call any populated field a dead session. */
  it("does not accept a merely truthy flag", () => {
    expect(isSessionExpiredRefusal({ sessionExpired: "yes" })).toBe(false);
    expect(isSessionExpiredRefusal({ sessionExpired: 1 })).toBe(false);
  });
});

/**
 * THE CONTRACT THE COPY ACTUALLY RESTS ON.
 *
 * `run-failure.ts` shipped with the offline half already classifying `sessionExpired === true` as
 * the "session" cause, and with the sentence a signed-out creator reads. Nothing in production set
 * that flag until this module existed, so every one of those assertions was guarding unreachable
 * code. These two tests are the join: they fail if either side moves. The flag is a cross-module
 * string contract with no compiler holding it together — `run-failure.ts` re-declares the check
 * rather than importing it (deliberately, so it survives module duplication), which is exactly the
 * arrangement that drifts silently.
 */
describe("the refusal reaches the glass as the session cause", () => {
  it("classifies as `session`, not as an anonymous engine error", () => {
    expect(classifyRunFailure(new SessionExpiredRefusal())).toBe("session");
  });

  it("resolves to copy that says signed out, and never blames the handle", () => {
    const message = resolveRunError(new SessionExpiredRefusal(), "Explore stream error");
    const copy = runErrorCopy(message, "explore");

    expect(copy.headline).toMatch(/signed out|session/i);
    expect(copy.body).not.toMatch(/handle/i);
    expect(copy.body).toMatch(/nothing was charged/i);
  });
});
