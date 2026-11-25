/** @vitest-environment happy-dom */

/**
 * useOncePerBurst — a paid action behind a tap runs once when the tap lands twice. The hook is real;
 * the clock (`Date.now`) is driven by hand.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { BURST_MS, useOncePerBurst } from "../use-once-per-burst";

afterEach(() => vi.restoreAllMocks());

describe("useOncePerBurst", () => {
  it("drops the same call again inside the burst, and takes it after", () => {
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const action = vi.fn();
    const { result } = renderHook(() => useOncePerBurst(action));
    result.current!("hook", "");
    result.current!("hook", "");
    now += BURST_MS - 1;
    result.current!("hook", "");
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("hook", "");
    now += 1;
    result.current!("another", "");
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("no action, no function (the button it feeds stays disabled)", () => {
    expect(renderHook(() => useOncePerBurst(undefined)).result.current).toBeUndefined();
    expect(renderHook(() => useOncePerBurst(null)).result.current).toBeUndefined();
  });

  it("keeps its memory across re-renders with the same action", () => {
    vi.spyOn(Date, "now").mockImplementation(() => 10_000);
    const action = vi.fn();
    const { result, rerender } = renderHook(() => useOncePerBurst(action));
    result.current!();
    rerender();
    result.current!();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
