/** @vitest-environment happy-dom */
/**
 * The Library's chats, a page at a time: `GET /api/threads/library`, keyset-paged on `next`, one cache
 * entry per (trimmed) search text. Only the network (`fetch`) is stood in for; TanStack Query and the
 * hook are real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { LibraryChat, LibraryPage } from "@/lib/library/library-page";
import { libraryKeys, useLibraryChats, useLibraryRecent } from "../use-library";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const chat = (id: string): LibraryChat => ({
  id,
  title: `Chat ${id}`,
  updatedAt: "2026-11-21T10:00:00.123456+00:00",
  pinned: false,
  summary: {
    counts: { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 },
    lead: "chat",
    stage: "chat",
    sim: null,
    frame: null,
    videoPath: null,
    posted: null,
  },
});
const page = (ids: string[], next: string | null): LibraryPage => ({ chats: ids.map(chat), next });

/** The query string of the n-th request. */
const paramsOf = (mock: ReturnType<typeof vi.fn>, n: number) => {
  const url = new URL(String(mock.mock.calls[n]![0]), "http://localhost");
  expect(url.pathname).toBe("/api/threads/library");
  return url.searchParams;
};

beforeEach(() => {
  // No retries: a refused request is an error at once (the app's default retries three times).
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

describe("libraryKeys", () => {
  it("one namespace, one entry per trimmed search text", () => {
    expect(libraryKeys.all).toEqual(["library"]);
    expect(libraryKeys.chats("  meal prep ")).toEqual(["library", "chats", "meal prep"]);
    expect(libraryKeys.chats("")).toEqual(["library", "chats", ""]);
  });
});

describe("useLibraryChats", () => {
  it("loads the first page, with no cursor and no search", async () => {
    const fetchMock = vi.fn(async () => json(page(["a", "b"], "CURSOR-1")));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLibraryChats(""), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toEqual([page(["a", "b"], "CURSOR-1")]);
    expect(result.current.hasNextPage).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([...paramsOf(fetchMock, 0).keys()]).toEqual([]);
  });

  it("the next page sends the cursor of the page before; the last page has no next", async () => {
    const answers = [page(["a", "b"], "CURSOR-1"), page(["c"], null)];
    const fetchMock = vi.fn(async () => json(answers[fetchMock.mock.calls.length - 1]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLibraryChats("meal"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Read the pages, as a screen does: TanStack re-renders only for the result fields that were read.
    expect(result.current.data?.pages).toHaveLength(1);
    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(paramsOf(fetchMock, 1).get("cursor")).toBe("CURSOR-1");
    expect(paramsOf(fetchMock, 1).get("q")).toBe("meal");
    expect(result.current.data?.pages.flatMap((p) => p.chats.map((c) => c.id))).toEqual(["a", "b", "c"]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("a search is sent trimmed, and a different search is a different cache entry", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const q = new URL(url, "http://localhost").searchParams.get("q");
      return json(page([q === "meal" ? "m1" : "p1"], null));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ q }) => useLibraryChats(q), { wrapper, initialProps: { q: "  meal " } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(paramsOf(fetchMock, 0).get("q")).toBe("meal");

    // The same text with other spaces is the same entry: nothing is asked again.
    rerender({ q: "meal" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ q: "pasta" });
    await waitFor(() => expect(result.current.data?.pages[0]?.chats[0]?.id).toBe("p1"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(paramsOf(fetchMock, 1).get("q")).toBe("pasta");

    const meal = client.getQueryData<{ pages: LibraryPage[] }>(libraryKeys.chats("meal"));
    const pasta = client.getQueryData<{ pages: LibraryPage[] }>(libraryKeys.chats("pasta"));
    expect(meal?.pages[0]?.chats[0]?.id).toBe("m1");
    expect(pasta?.pages[0]?.chats[0]?.id).toBe("p1");
  });

  it("a superseded search is aborted: its request's signal fires when the text changes", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const signal = init?.signal;
      if (!signal) throw new Error("no signal passed to fetch");
      signals.push(signal);
      const q = new URL(url, "http://localhost").searchParams.get("q");
      if (q === "pasta") return Promise.resolve(json(page(["p1"], null)));
      // "meal" never answers on its own; it ends only when aborted.
      return new Promise<Response>((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ q }) => useLibraryChats(q), { wrapper, initialProps: { q: "meal" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(signals[0]!.aborted).toBe(false);

    rerender({ q: "pasta" });
    await waitFor(() => expect(signals[0]!.aborted).toBe(true));
    await waitFor(() => expect(result.current.data?.pages[0]?.chats[0]?.id).toBe("p1"));
    expect(signals[1]!.aborted).toBe(false);
  });

  it("a new search keeps the rows on screen while it loads", async () => {
    let answerPasta: (r: Response) => void = () => {};
    const fetchMock = vi.fn((url: string) => {
      const q = new URL(url, "http://localhost").searchParams.get("q");
      if (q === "meal") return Promise.resolve(json(page(["m1"], null)));
      return new Promise<Response>((resolve) => {
        answerPasta = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ q }) => useLibraryChats(q), { wrapper, initialProps: { q: "meal" } });
    await waitFor(() => expect(result.current.data?.pages[0]?.chats[0]?.id).toBe("m1"));
    expect(result.current.isPlaceholderData).toBe(false);

    rerender({ q: "pasta" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // Still the previous rows, marked as such, while "pasta" is in the air.
    expect(result.current.data?.pages[0]?.chats[0]?.id).toBe("m1");
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.isFetching).toBe(true);

    await act(async () => answerPasta(json(page(["p1"], null))));
    await waitFor(() => expect(result.current.data?.pages[0]?.chats[0]?.id).toBe("p1"));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("a refused answer puts the query in error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Server error" }, 500)));
    const { result } = renderHook(() => useLibraryChats(""), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe("useLibraryRecent (Home's Recent, Library plan Task 7 fix round 1)", () => {
  it("has its own key, apart from the Library's pages", () => {
    expect(libraryKeys.recent).toEqual(["library", "recent"]);
  });

  it("one GET of the first page: no cursor, no search, the abort signal passed", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json(page(["a", "b", "c", "d"], "CURSOR-1")));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLibraryRecent(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(page(["a", "b", "c", "d"], "CURSOR-1"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([...paramsOf(fetchMock, 0).keys()]).toEqual([]);
    expect(fetchMock.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("with the Library's own entry holding three pages, a refetch sends one request, not three", async () => {
    client.setQueryData(libraryKeys.chats(""), {
      pages: [page(["a"], "CURSOR-1"), page(["b"], "CURSOR-2"), page(["c"], null)],
      pageParams: [null, "CURSOR-1", "CURSOR-2"],
    });
    const fetchMock = vi.fn(async () => json(page(["a", "b", "c"], "CURSOR-1")));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLibraryRecent(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect([...paramsOf(fetchMock, 1).keys()]).toEqual([]);
    // The Library's pages are left as they were.
    expect(client.getQueryData<{ pages: LibraryPage[] }>(libraryKeys.chats(""))?.pages).toHaveLength(3);
  });

  it.each([404, 500])("a %i is one request and no retry, even where queries retry by default", async (status) => {
    // As the app's client: three retries by default (here a millisecond apart).
    client = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });
    const fetchMock = vi.fn(async () => json({ error: "nope" }, status));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLibraryRecent(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeUndefined();
  });
});
