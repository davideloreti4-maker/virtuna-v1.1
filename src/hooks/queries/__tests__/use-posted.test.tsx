/** @vitest-environment happy-dom */
/**
 * use-posted — a piece's posted link (plan 2026-11-24-after-posting, Task 3): read, add, remove, and the
 * reads of the post's numbers. TanStack Query and the hooks are real; the network (`fetch`) is the only
 * stand-in. Every handle, id and link is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  ANALYSIS,
  KEY,
  POSTED_ID,
  THREAD,
  deferred,
  json,
  posted,
  reading,
  sentOf,
  soFar,
  unread,
} from "@/components/posted-next/__tests__/posted-fixtures";
import { ToastProvider } from "@/components/ui/toast";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";
import { libraryKeys } from "../use-library";
import {
  postedKeys,
  useAddPosted,
  usePosted,
  useRefreshPosted,
  useRefreshWhenDue,
  useRemovePosted,
  type PostedPiece,
} from "../use-posted";

const TEXT: PostedPiece = { kind: "text", threadId: THREAD, key: KEY };
const VIDEO: PostedPiece = { kind: "video", analysisId: ANALYSIS };
const LINK = "https://www.tiktok.com/@nia.cooks/video/7301444403323456789";

let client: QueryClient;
// The toast's provider as the (app) layout has it: a refused remove says so there.
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>
    <ToastProvider>{children}</ToastProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient();
});

afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

/** A stand-in for the routes: each answer by method and path (the query string left out). */
function serve(answers: Record<string, (body: unknown) => Response | Promise<Response>>) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const path = String(input).split("?")[0];
    const answer = answers[`${method} ${path}`];
    if (!answer) return json({ error: "Not found" }, 404);
    return answer(typeof init?.body === "string" ? JSON.parse(init.body) : undefined);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** The Library's entry, loaded, so an invalidation of it can be seen. */
function seedLibrary() {
  client.setQueryData(libraryKeys.recent, { chats: [], next: null });
}
const libraryInvalidated = () => client.getQueryState(libraryKeys.recent)?.isInvalidated === true;

describe("postedKeys", () => {
  it("one namespace, one entry per piece", () => {
    expect(postedKeys.all).toEqual(["posted"]);
    expect(postedKeys.piece(TEXT)).toEqual(["posted", "piece", "text", THREAD, KEY]);
    expect(postedKeys.piece(VIDEO)).toEqual(["posted", "piece", "video", ANALYSIS]);
  });
});

describe("usePosted", () => {
  it("a text piece: GET /api/posted?threadId=&key=, the posted piece", async () => {
    const fetchMock = serve({ "GET /api/posted": () => json({ posted: posted() }) });
    const { result } = renderHook(() => usePosted(TEXT), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(posted());
    const url = new URL(String(fetchMock.mock.calls[0]![0]), "http://localhost");
    expect(url.pathname).toBe("/api/posted");
    expect(Object.fromEntries(url.searchParams)).toEqual({ threadId: THREAD, key: KEY });
  });

  it("a video: GET /api/posted?analysisId=; none posted is null", async () => {
    const fetchMock = serve({ "GET /api/posted": () => json({ posted: null }) });
    const { result } = renderHook(() => usePosted(VIDEO), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    const url = new URL(String(fetchMock.mock.calls[0]![0]), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ analysisId: ANALYSIS });
  });

  it("a refusal is an error at once, not asked again (a 404 does not get better)", async () => {
    const fetchMock = serve({ "GET /api/posted": () => json({ error: "Not found" }, 404) });
    const { result } = renderHook(() => usePosted(TEXT), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no piece: asks nothing", async () => {
    const fetchMock = serve({});
    const { result } = renderHook(() => usePosted(null), { wrapper });
    await act(async () => {});
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useAddPosted", () => {
  it("POSTs the piece and the link as JSON, keeps the answer for the piece, and starts ONE read of it", async () => {
    seedLibrary();
    const read = deferred<Response>();
    const fetchMock = serve({
      "POST /api/posted": () => json({ posted: reading() }, 201),
      "POST /api/posted/refresh": () => read.promise,
      "GET /api/posted": () => json({ posted: reading() }),
    });
    const { result } = renderHook(() => ({ add: useAddPosted(), refresh: useRefreshPosted() }), { wrapper });

    await act(async () => {
      await result.current.add.mutateAsync({ piece: TEXT, url: LINK });
    });

    const [post, ...rest] = sentOf(fetchMock);
    expect(post).toEqual({ method: "POST", url: "/api/posted", body: { kind: "text", threadId: THREAD, key: KEY, url: LINK } });
    expect(fetchMock.mock.calls[0]![1]!.headers).toEqual({ "Content-Type": "application/json" });
    expect(client.getQueryData(postedKeys.piece(TEXT))).toEqual(reading());
    expect(libraryInvalidated()).toBe(true);
    const refreshes = rest.filter((s) => s.url === "/api/posted/refresh");
    expect(refreshes).toEqual([{ method: "POST", url: "/api/posted/refresh", body: { id: POSTED_ID } }]);
    expect(result.current.refresh.isRefreshing(POSTED_ID)).toBe(true);

    // The read comes back: the piece's entry holds its numbers.
    await act(async () => {
      read.resolve(json({ posted: [soFar()] }));
    });
    await waitFor(() => expect(result.current.refresh.isRefreshing(POSTED_ID)).toBe(false));
    expect(sentOf(fetchMock).filter((s) => s.url === "/api/posted/refresh")).toHaveLength(1);
  });

  it("a video: { kind: video, analysisId, url }", async () => {
    const fetchMock = serve({
      "POST /api/posted": () => json({ posted: reading({ pieceKey: ANALYSIS }) }, 201),
      "POST /api/posted/refresh": () => json({ posted: [] }),
      "GET /api/posted": () => json({ posted: reading({ pieceKey: ANALYSIS }) }),
    });
    const { result } = renderHook(() => useAddPosted(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ piece: VIDEO, url: LINK });
    });
    expect(sentOf(fetchMock)[0]).toEqual({ method: "POST", url: "/api/posted", body: { kind: "video", analysisId: ANALYSIS, url: LINK } });
    expect(client.getQueryData(postedKeys.piece(VIDEO))).toEqual(reading({ pieceKey: ANALYSIS }));
  });

  it.each([
    ["not a TikTok link", 400, { error: "not_tiktok" }, POSTED_STRINGS.notTiktok],
    ["already linked", 409, { error: "already_linked" }, POSTED_STRINGS.alreadyLinked],
    ["20 links today", 429, { error: "too_many" }, POSTED_STRINGS.tooMany],
    ["no number", 422, { error: "no_number" }, POSTED_STRINGS.addFailed],
    ["signed out", 401, { error: "Unauthorized" }, POSTED_STRINGS.addFailed],
    ["not the caller's piece", 404, { error: "Not found" }, POSTED_STRINGS.addFailed],
    ["a server error", 500, {}, POSTED_STRINGS.addFailed],
    ["a 409 with no body", 409, null, POSTED_STRINGS.alreadyLinked],
    // Ruling 32: only the day's allowance says "20 links today"; the shared rate limiter's 429 does not.
    ["a 429 with no body", 429, null, POSTED_STRINGS.addFailed],
    ["the shared rate limit", 429, { error: "Rate limit exceeded — please slow down and try again in a moment." }, POSTED_STRINGS.addFailed],
    ["a 400 that is not the link's", 400, { error: "invalid_body" }, POSTED_STRINGS.addFailed],
  ])("refused (%s): the error says what to show; nothing is kept, nothing is read", async (_name, status, body, words) => {
    seedLibrary();
    const fetchMock = serve({ "POST /api/posted": () => (body === null ? new Response(null, { status }) : json(body, status)) });
    const { result } = renderHook(() => useAddPosted(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ piece: TEXT, url: LINK })).rejects.toThrow(words);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(postedKeys.piece(TEXT))).toBeUndefined();
    expect(libraryInvalidated()).toBe(false);
  });

  it("offline: Couldn't add the link. Try again.", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const { result } = renderHook(() => useAddPosted(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ piece: TEXT, url: LINK })).rejects.toThrow(POSTED_STRINGS.addFailed);
    });
  });
});

describe("useRemovePosted", () => {
  it("DELETE /api/posted/<id>: the piece's entry becomes null and the Library is read again", async () => {
    seedLibrary();
    client.setQueryData(postedKeys.piece(TEXT), posted());
    const fetchMock = serve({
      [`DELETE /api/posted/${POSTED_ID}`]: () => new Response(null, { status: 204 }),
      "GET /api/posted": () => json({ posted: null }),
    });
    const { result } = renderHook(() => useRemovePosted(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(POSTED_ID);
    });
    expect(sentOf(fetchMock)[0]).toEqual({ method: "DELETE", url: `/api/posted/${POSTED_ID}`, body: undefined });
    expect(client.getQueryData(postedKeys.piece(TEXT))).toBeNull();
    expect(libraryInvalidated()).toBe(true);
  });

  it("refused: Couldn't remove the link. in the toast; the piece keeps its link, and the entries are read again", async () => {
    seedLibrary();
    client.setQueryData(postedKeys.piece(TEXT), posted());
    serve({
      [`DELETE /api/posted/${POSTED_ID}`]: () => json({ error: "Not found" }, 404),
      "GET /api/posted": () => new Promise<Response>(() => {}), // the re-read never lands: the entry shows what it had
    });
    const { result } = renderHook(() => useRemovePosted(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(POSTED_ID)).rejects.toThrow();
    });
    expect(client.getQueryData(postedKeys.piece(TEXT))).toEqual(posted());
    // A 404 may mean it was removed elsewhere (another tab, Library): reading again corrects the page.
    expect(libraryInvalidated()).toBe(true);
    expect(client.getQueryState(postedKeys.piece(TEXT))?.isInvalidated).toBe(true);
    const toast = await screen.findByRole("alert");
    expect(toast).toHaveTextContent(POSTED_STRINGS.removeFailed);
  });

  it("offline: the same words", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const { result } = renderHook(() => useRemovePosted(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(POSTED_ID)).rejects.toThrow();
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't remove the link.");
  });
});

describe("useRefreshPosted", () => {
  it("POST /api/posted/refresh { id, retry } as JSON; the rows it read replace their entries, the rest stay", async () => {
    seedLibrary();
    const other = posted({ id: "55555555-5555-4555-8555-555555555555", pieceKey: "other-key" });
    client.setQueryData(postedKeys.piece(TEXT), unread());
    client.setQueryData(postedKeys.piece({ kind: "text", threadId: THREAD, key: "other-key" }), other);
    const fetchMock = serve({
      "POST /api/posted/refresh": () => json({ posted: [soFar()] }),
      "GET /api/posted": () => new Promise<Response>(() => {}), // the re-read never lands: the entries show the read's answer
    });
    const { result } = renderHook(() => useRefreshPosted(), { wrapper });
    let rows: unknown;
    await act(async () => {
      rows = await result.current.refresh({ id: POSTED_ID, retry: true });
    });
    expect(rows).toEqual([soFar()]);
    expect(sentOf(fetchMock)[0]).toEqual({ method: "POST", url: "/api/posted/refresh", body: { id: POSTED_ID, retry: true } });
    expect(fetchMock.mock.calls[0]![1]!.headers).toEqual({ "Content-Type": "application/json" });
    expect(client.getQueryData(postedKeys.piece(TEXT))).toEqual(soFar());
    expect(client.getQueryData(postedKeys.piece({ kind: "text", threadId: THREAD, key: "other-key" }))).toEqual(other);
    expect(libraryInvalidated()).toBe(true);
    expect(client.getQueryState(postedKeys.piece(TEXT))?.isInvalidated).toBe(true);
  });

  it("no id: the body is {} (every read owed)", async () => {
    const fetchMock = serve({ "POST /api/posted/refresh": () => json({ posted: [] }) });
    const { result } = renderHook(() => useRefreshPosted(), { wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    expect(sentOf(fetchMock)[0]!.body).toEqual({});
  });

  it("while a read of a piece is out, another for it is not started; once it is back, one can be", async () => {
    const read = deferred<Response>();
    const fetchMock = serve({ "POST /api/posted/refresh": () => read.promise });
    const { result } = renderHook(() => useRefreshPosted(), { wrapper });

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.refresh({ id: POSTED_ID });
      second = result.current.refresh({ id: POSTED_ID, retry: true });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing(POSTED_ID)).toBe(true);
    expect(result.current.isRefreshing("another")).toBe(false);

    await act(async () => {
      read.resolve(json({ posted: [] }));
      await Promise.all([first, second]);
    });
    expect(result.current.isRefreshing(POSTED_ID)).toBe(false);

    fetchMock.mockImplementation(async () => json({ posted: [] }));
    await act(async () => {
      await result.current.refresh({ id: POSTED_ID });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a read of another piece is not held by this one", async () => {
    const read = deferred<Response>();
    const fetchMock = serve({ "POST /api/posted/refresh": () => read.promise });
    const { result } = renderHook(() => useRefreshPosted(), { wrapper });
    act(() => {
      void result.current.refresh({ id: POSTED_ID });
      void result.current.refresh({ id: "another" });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => read.resolve(json({ posted: [] })));
  });

  it("a failed read resolves to null (never throws) and the entries are read again", async () => {
    client.setQueryData(postedKeys.piece(TEXT), unread());
    serve({ "POST /api/posted/refresh": () => json({ error: "boom" }, 500), "GET /api/posted": () => new Promise<Response>(() => {}) });
    const { result } = renderHook(() => useRefreshPosted(), { wrapper });
    let rows: unknown = "unset";
    await act(async () => {
      rows = await result.current.refresh({ id: POSTED_ID, retry: true });
    });
    expect(rows).toBeNull();
    expect(client.getQueryData(postedKeys.piece(TEXT))).toEqual(unread());
    expect(client.getQueryState(postedKeys.piece(TEXT))?.isInvalidated).toBe(true);
    expect(result.current.isRefreshing(POSTED_ID)).toBe(false);
  });

  it("offline: null too", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const { result } = renderHook(() => useRefreshPosted(), { wrapper });
    let rows: unknown = "unset";
    await act(async () => {
      rows = await result.current.refresh({ id: POSTED_ID });
    });
    expect(rows).toBeNull();
  });
});

describe("useRefreshWhenDue", () => {
  it("a piece owed a read: ONE read per mount; an answer still owed a read does not start another", async () => {
    let answers = 0;
    const fetchMock = serve({
      "POST /api/posted/refresh": () => {
        answers += 1;
        return json({ posted: [soFar({ due: true })] }); // read, and (say) still owed one
      },
    });
    const { rerender } = renderHook(({ p }) => useRefreshWhenDue(p), { wrapper, initialProps: { p: soFar({ due: true }) } });
    await waitFor(() => expect(answers).toBe(1));
    rerender({ p: soFar({ due: true, numbers: { views: 13_000, likes: 900, comments: 31, shares: 96, saves: 140 } }) });
    rerender({ p: soFar({ due: true }) });
    await act(async () => {});
    expect(sentOf(fetchMock).filter((s) => s.url === "/api/posted/refresh")).toEqual([
      { method: "POST", url: "/api/posted/refresh", body: { id: POSTED_ID } },
    ]);
  });

  it("owed a read, then not, then owed again in the same mount: still the one read (never a loop)", async () => {
    const fetchMock = serve({ "POST /api/posted/refresh": () => json({ posted: [] }) });
    const { result, rerender } = renderHook(
      ({ p }) => {
        useRefreshWhenDue(p);
        return useRefreshPosted();
      },
      { wrapper, initialProps: { p: soFar({ due: true }) } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isRefreshing(POSTED_ID)).toBe(false));
    rerender({ p: soFar({ due: false }) });
    rerender({ p: soFar({ due: true }) });
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("not owed a read, or nothing posted: asks nothing", async () => {
    const fetchMock = serve({ "POST /api/posted/refresh": () => json({ posted: [] }) });
    const { rerender } = renderHook(({ p }) => useRefreshWhenDue(p), {
      wrapper,
      initialProps: { p: posted() as ReturnType<typeof posted> | null | undefined },
    });
    rerender({ p: null });
    rerender({ p: undefined });
    rerender({ p: unread() });
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("owed a read later in the same mount (it was not before): that one read", async () => {
    const fetchMock = serve({ "POST /api/posted/refresh": () => json({ posted: [] }) });
    const { rerender } = renderHook(({ p }) => useRefreshWhenDue(p), { wrapper, initialProps: { p: soFar() } });
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ p: soFar({ due: true }) });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("a new mount asks once more", async () => {
    const fetchMock = serve({ "POST /api/posted/refresh": () => json({ posted: [] }) });
    const first = renderHook(() => useRefreshWhenDue(soFar({ due: true })), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    first.unmount();
    renderHook(() => useRefreshWhenDue(soFar({ due: true })), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
