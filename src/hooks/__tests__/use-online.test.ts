/** @vitest-environment happy-dom */

/**
 * `useOnline` — the ambient connection state every offline surface reads.
 *
 * The unsubscribe case is here because a store hook that keeps listening after unmount is the
 * classic React leak: it does not fail, it just updates a dead tree forever.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

import { useOnline } from "@/hooks/use-online";

afterEach(() => {
  cleanup();
  // happy-dom keeps navigator.onLine across tests in a file; restore the default.
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

describe("useOnline", () => {
  it("reports the browser's current state on first render", () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it("flips to false when the browser fires `offline`", () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });

  it("flips back to true when the browser fires `online`", () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
  });

  /**
   * Asserted against the LISTENER REGISTRY, not against `result.current`.
   *
   * The obvious version of this test — unmount, dispatch `offline`, expect `result.current` to
   * still be `true` — passes with the unsubscribe deleted entirely. `result.current` is frozen
   * at the last render either way, so it cannot observe the leak it claims to be guarding.
   * Mutation-tested: removing both `removeEventListener` calls left that version green.
   */
  it("removes both listeners on unmount — the leak is invisible from the returned value", () => {
    setOnLine(true);
    // `vi.spyOn` calls through by default — the real listeners are still installed, so the hook
    // behaves normally while every (add|remove) is recorded.
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const types = (spy: typeof addSpy) => spy.mock.calls.map(([type]) => type);

    const { unmount } = renderHook(() => useOnline());
    expect(types(addSpy).filter((t) => t === "online" || t === "offline")).toHaveLength(2);

    unmount();

    expect(types(removeSpy)).toContain("online");
    expect(types(removeSpy)).toContain("offline");

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
