/** @vitest-environment happy-dom */

/**
 * The HOOK half of cause-aware failures — the join that makes the feature work.
 *
 * `thread-turn` can resolve copy by cause all it likes; if the hook never records the cause,
 * every run still renders the generic "dropped out". That gap is invisible from either side's
 * own tests, which is exactly how a green suite covers a broken feature.
 *
 * `fetch` is mocked because it is a real I/O boundary. The unit under test is the hook's own
 * catch block, which runs for real.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

import { useIdeasStream } from "@/hooks/queries/use-ideas-stream";
import { RUN_FAILURE_SENTINEL } from "@/lib/net/run-failure";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

describe("use-ideas-stream records WHY a run failed", () => {
  it("writes the offline sentinel when the device is offline", async () => {
    setOnLine(false);
    // What a real fetch does with no connection: it rejects, it does not resolve non-ok.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start("a draft", "tiktok");
    });

    expect(result.current.error).toBe(RUN_FAILURE_SENTINEL.offline);
  });

  it("keeps the raw message when the same rejection happens ONLINE — no invented diagnosis", async () => {
    setOnLine(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start("a draft", "tiktok");
    });

    // The identical rejection, and the only difference is what the browser reports. It must NOT
    // be diagnosed as offline — CORS, DNS and an unreachable host land here too.
    expect(result.current.error).not.toBe(RUN_FAILURE_SENTINEL.offline);
    expect(result.current.error).toBe("Failed to fetch");
  });

  it("records NO error at all when the run was aborted", async () => {
    setOnLine(false);
    const abort = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start("a draft", "tiktok");
    });

    expect(result.current.error).toBeNull();
  });
});
