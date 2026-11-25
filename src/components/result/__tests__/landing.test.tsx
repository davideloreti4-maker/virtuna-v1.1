/** @vitest-environment happy-dom */
/** The landing's window: real hook, the clock stood in. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { LANDING_MS, useLanding, useLandingWindow } from "../landing";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useLandingWindow", () => {
  it("is open from the arrival for its length, then closed, and is longer than the landing's longest part", () => {
    // The fill ends 1.7 s in; the window leaves room for a slow first paint.
    expect(LANDING_MS).toBeGreaterThanOrEqual(2200);
    const { result } = renderHook(() => useLandingWindow(true));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(LANDING_MS - 1));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(false);
  });

  it("never opens without an arrival", () => {
    const { result } = renderHook(() => useLandingWindow(false));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(LANDING_MS * 2));
    expect(result.current).toBe(false);
  });

  it("another arrival in the same page opens a new window", () => {
    const { result, rerender } = renderHook(({ on }) => useLandingWindow(on), { initialProps: { on: true } });
    act(() => vi.advanceTimersByTime(LANDING_MS));
    expect(result.current).toBe(false);
    rerender({ on: false });
    expect(result.current).toBe(false);
    rerender({ on: true });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(LANDING_MS));
    expect(result.current).toBe(false);
  });

  it("an arrival that is taken back before its window ends leaves no timer running", () => {
    const { result, rerender, unmount } = renderHook(({ on }) => useLandingWindow(on), { initialProps: { on: true } });
    rerender({ on: false });
    expect(result.current).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });
});

describe("useLanding", () => {
  it("is false for a part drawn outside the result page", () => {
    expect(renderHook(() => useLanding()).result.current).toBe(false);
  });
});
