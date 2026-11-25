/** @vitest-environment happy-dom */
/**
 * The result page reads its row the way the board always has: `GET /api/analysis/[id]`, under the
 * same cache key, polled every 2 seconds while the run is in flight. Only the network (`fetch`)
 * and the route param are stood in for; TanStack Query and both hooks are real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "run-1" }) }));

import { queryKeys } from "@/lib/queries/query-keys";
import { usePermalinkAnalysis } from "../use-permalink-analysis";
import { useSimulationRow } from "../use-simulation-row";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  client = new QueryClient();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  client.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useSimulationRow", () => {
  it("polls every 2 seconds while the run is in flight and stops once it is done", async () => {
    const answers = [
      { id: "run-1", processing: true },
      { id: "run-1", processing: true },
      { id: "run-1", processing: false, engine_version: "3.25.0" },
    ];
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("/api/analysis/run-1");
      return json(answers[Math.min(fetchMock.mock.calls.length - 1, answers.length - 1)]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSimulationRow("run-1"), { wrapper });

    await waitFor(() => expect(result.current.row?.processing).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(2000));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(() => vi.advanceTimersByTimeAsync(2000));
    await waitFor(() => expect(result.current.row?.processing).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Done: no more requests.
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.notFound).toBe(false);
  });

  it("says not found when the row cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "not found" }, 404)));
    const { result } = renderHook(() => useSimulationRow("gone"), { wrapper });

    expect(result.current.notFound).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(5000));
    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.row).toBeUndefined();
  });

  it("stops asking for a run that is not there (found in review: it polled every 2 seconds forever)", async () => {
    const fetchMock = vi.fn(async () => json({ error: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSimulationRow("gone"), { wrapper });

    await act(() => vi.advanceTimersByTimeAsync(5000));
    await waitFor(() => expect(result.current.notFound).toBe(true));
    const asked = fetchMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(fetchMock.mock.calls.length).toBe(asked);
  });

  it("keeps asking when a poll of a run in flight fails, and shows the result when it lands", async () => {
    // Seen on a real run: one poll answered 401 and another 404 while the run was fine.
    const answers = [
      () => json({ id: "run-1", processing: true }),
      () => json({ error: "unauthorized" }, 401),
      () => json({ error: "not found" }, 404),
      () => json({ id: "run-1", processing: false, engine_version: "3.25.0" }),
    ];
    const fetchMock = vi.fn(async () => answers[Math.min(fetchMock.mock.calls.length - 1, answers.length - 1)]!());
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSimulationRow("run-1"), { wrapper });
    await waitFor(() => expect(result.current.row?.processing).toBe(true));

    // The second poll and its one retry both fail; the run is still in flight as far as we know.
    await act(() => vi.advanceTimersByTimeAsync(12_000));
    await waitFor(() => expect(result.current.row?.processing).toBe(false));
    expect(result.current.notFound).toBe(false);
  });

  it("asks again on opening for a row last seen in flight, also past the polling ceiling", async () => {
    // Opened while it simulated, left, opened again 7 minutes after the start: the cached row
    // still says processing and polling has stopped (six-minute ceiling). Without asking again the
    // page would say "did not finish" about a run that finished.
    const startedAt = new Date(Date.now() - 7 * 60_000).toISOString();
    client.setQueryData(queryKeys.analysis.detail("run-1"), { id: "run-1", processing: true, created_at: startedAt });
    const fetchMock = vi.fn(async () => json({ id: "run-1", processing: false, created_at: startedAt, engine_version: "3.25.0" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSimulationRow("run-1"), { wrapper });

    await waitFor(() => expect(result.current.row?.processing).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again on opening for a finished row that was marked out of date while no page was open", async () => {
    // The board's stream invalidates the row's entry when a run finishes, with no page open; the
    // page opened afterwards must not keep the out-of-date payload.
    client.setQueryData(queryKeys.analysis.detail("run-1"), { id: "run-1", processing: false, engine_version: "old" });
    await client.invalidateQueries({ queryKey: queryKeys.analysis.detail("run-1") });
    const fetchMock = vi.fn(async () => json({ id: "run-1", processing: false, engine_version: "3.25.0" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSimulationRow("run-1"), { wrapper });

    await waitFor(() => expect(result.current.row?.engine_version).toBe("3.25.0"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not ask again on opening for a finished row it holds", async () => {
    client.setQueryData(queryKeys.analysis.detail("run-1"), { id: "run-1", processing: false, engine_version: "3.25.0" });
    const fetchMock = vi.fn(async () => json({ id: "run-1", processing: false }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSimulationRow("run-1"), { wrapper });

    expect(result.current.row?.processing).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares one cache entry with the board's hook: one request for both", async () => {
    const fetchMock = vi.fn(async () => json({ id: "run-1", processing: false }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(
      () => ({ page: useSimulationRow("run-1"), board: usePermalinkAnalysis() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.page.row?.id).toBe("run-1"));
    expect(result.current.board.data).toEqual({ id: "run-1", processing: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
