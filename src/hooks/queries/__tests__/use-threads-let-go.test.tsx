/** @vitest-environment happy-dom */
/**
 * The chat list follows a run the creator left: a run let go (a thread switch, or leaving /home
 * mid-run, which unmounts the composer) ends in the background, its route stores it, and the list on
 * screen is read again, wherever the creator is. The real hook; `fetch` the only stand-in.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useThreadList } from "@/hooks/queries/use-threads";
import { reportLetGoRunEnded } from "@/lib/thread-next/let-go-runs";

let lists = 0;
beforeEach(() => {
  lists = 0;
  global.fetch = vi.fn(async () => {
    lists += 1;
    return { ok: true, status: 200, json: async () => ({ threads: [] }) } as unknown as Response;
  }) as typeof fetch;
});

function wrapperFor(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useThreadList follows the runs let go", () => {
  it("reads the list again when one ends, once for many mounted lists, and not after they are gone", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
    const wrapper = wrapperFor(qc);
    const a = renderHook(() => useThreadList(), { wrapper });
    const b = renderHook(() => useThreadList(), { wrapper });
    await waitFor(() => expect(lists).toBe(1));

    await act(async () => {
      reportLetGoRunEnded();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(lists).toBe(2);

    a.unmount();
    b.unmount();
    await act(async () => {
      reportLetGoRunEnded();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(lists).toBe(2);
  });
});
