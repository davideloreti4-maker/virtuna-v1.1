/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFireSim } from "../use-fire-sim";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useFireSim", () => {
  it("fires one real reaction and seals the snapshot", async () => {
    const fetchMock = stubFetch({
      fraction: "8/10 stop",
      personas: [{ archetype: "a", verdict: "stop", quote: "yes" }],
      population: null,
    });
    const { result } = renderHook(() => useFireSim());
    await act(async () => {
      await result.current.fireSim("card-1", "a hook", "hook");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/tools/react");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
      text: "a hook",
      framing: "hook",
    });
    expect(result.current.snapshots["card-1"]!.stopPct).toBe(80);
    expect(result.current.watching).toBe(false);
  });

  it("IGNORES a second fire while one is in flight — the debounce that protects credits", async () => {
    let release!: (v: unknown) => void;
    const gate = new Promise((r) => (release = r));
    const fetchMock = vi.fn().mockImplementation(async () => {
      await gate;
      return { ok: true, json: async () => ({ fraction: "5/10 stop", personas: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useFireSim());
    act(() => {
      void result.current.fireSim("card-1", "a hook");
      void result.current.fireSim("card-2", "another hook");
    });
    await waitFor(() => expect(result.current.watching).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(null);
      await Promise.resolve();
    });
  });

  it("never fires on empty text", async () => {
    const fetchMock = stubFetch({});
    const { result } = renderHook(() => useFireSim());
    await act(async () => {
      await result.current.fireSim("card-1", "   ");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a refused run seals NOTHING and clears the watcher", async () => {
    stubFetch({ error: "insufficient_credits" }, false);
    const { result } = renderHook(() => useFireSim());
    await act(async () => {
      await result.current.fireSim("card-1", "a hook");
    });
    expect(result.current.snapshots["card-1"]).toBeUndefined();
    expect(result.current.watching).toBe(false);
  });
});
