/**
 * The honesty core: what a run failure was, and what we are entitled to say about it.
 *
 * Runs in the default `node` environment, so `navigator` is installed per-test rather than
 * assumed — the classifier must also work where it does not exist at all (SSR).
 */

import { describe, it, expect, afterEach } from "vitest";

import {
  classifyRunFailure,
  isAbort,
  runErrorCopy,
  RUN_FAILURE_SENTINEL,
} from "@/lib/net/run-failure";

const hadNavigator = "navigator" in globalThis;
const originalNavigator = hadNavigator ? globalThis.navigator : undefined;

function setOnLine(value: boolean) {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: value },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  if (hadNavigator) {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  } else {
    delete (globalThis as { navigator?: unknown }).navigator;
  }
});

describe("classifyRunFailure", () => {
  it("calls a fetch TypeError OFFLINE only when the browser also says so", () => {
    setOnLine(false);
    expect(classifyRunFailure(new TypeError("Failed to fetch"))).toBe("offline");
  });

  it("does NOT call a TypeError offline while the browser reports a connection", () => {
    // CORS, DNS and an unreachable host all throw TypeError with navigator.onLine === true.
    // Saying "you're offline" there is a fabricated diagnosis, and the user acts on it.
    setOnLine(true);
    expect(classifyRunFailure(new TypeError("Failed to fetch"))).toBeNull();
  });

  it("never classifies an AbortError — that is the user tapping Stop, not a failure", () => {
    setOnLine(false);
    const abort = new DOMException("The operation was aborted.", "AbortError");
    expect(classifyRunFailure(abort)).toBeNull();
    expect(isAbort(abort)).toBe(true);
  });

  /**
   * Pins the PRECEDENCE, not just the common case. A real AbortError is a DOMException, so the
   * `instanceof TypeError` branch already misses it and the abort guard reads as redundant —
   * mutation-tested: deleting it left every other test green. It stops being redundant the
   * moment anyone widens the network check (matching on message text, say), and then an aborted
   * run offline would report "You're offline" for a run the USER cancelled. Name beats type.
   */
  it("an abort is never a network failure, even when it IS a TypeError", () => {
    setOnLine(false);
    const abortShapedTypeError = Object.assign(new TypeError("Failed to fetch"), {
      name: "AbortError",
    });
    expect(classifyRunFailure(abortShapedTypeError)).toBeNull();
  });

  it("classifies the session refusal by its flag, surviving module duplication", () => {
    setOnLine(true);
    expect(classifyRunFailure({ sessionExpired: true })).toBe("session");
  });

  it("returns null for an ordinary engine error", () => {
    setOnLine(true);
    expect(classifyRunFailure(new Error("Ideas request failed"))).toBeNull();
  });

  it("does not throw where `navigator` does not exist at all (SSR)", () => {
    delete (globalThis as { navigator?: unknown }).navigator;
    expect(() => classifyRunFailure(new TypeError("Failed to fetch"))).not.toThrow();
    expect(classifyRunFailure(new TypeError("Failed to fetch"))).toBeNull();
  });
});

describe("runErrorCopy — cause beats skill", () => {
  it("an OFFLINE explore run does not blame the handle", () => {
    const copy = runErrorCopy(RUN_FAILURE_SENTINEL.offline, "explore");
    expect(copy.body).not.toMatch(/handle/i);
    expect(copy.headline).toMatch(/offline|connection/i);
  });

  it("an ONLINE explore failure keeps the skill's own copy", () => {
    const copy = runErrorCopy("some engine error", "explore");
    expect(copy.body).toMatch(/handle or niche/i);
  });

  it("falls back to the generic copy for a skill with no override", () => {
    const copy = runErrorCopy("some engine error", "hooks");
    expect(copy.body).toMatch(/dropped out/i);
  });

  it("the session sentinel outranks every skill's copy too", () => {
    const copy = runErrorCopy(RUN_FAILURE_SENTINEL.session, "account");
    expect(copy.body).not.toMatch(/handle/i);
    expect(copy.headline).toMatch(/session|signed out/i);
  });

  it("states nothing was charged for both causes — neither reached the engine", () => {
    for (const cause of ["offline", "session"] as const) {
      expect(runErrorCopy(RUN_FAILURE_SENTINEL[cause], "ideas").body).toMatch(
        /nothing was charged/i,
      );
    }
  });

  it("handles a null/undefined error without inventing a cause", () => {
    expect(runErrorCopy(null, "explore").body).toMatch(/handle or niche/i);
    expect(runErrorCopy(undefined, "hooks").body).toMatch(/dropped out/i);
  });
});
