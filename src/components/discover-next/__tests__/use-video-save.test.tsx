/** @vitest-environment happy-dom */

/**
 * useVideoSave: Save on a video's page, over the app's real saved-items hooks and a real QueryClient.
 * The one stand-in is `fetch` (`/api/saved`: the list, a save, a remove). Every handle, id and link is
 * made up.
 *
 * - A save sends exactly the row Library reads: `item_type` "outlier", the video's id as `ref_id`, no
 *   chat, its line as the title, the snapshot.
 * - The mark is read from the list, so a fresh mount of a saved video shows it saved.
 * - A tap on a saved video removes that row, by its id.
 * - Nothing goes out while a save or a remove is on its way, while the row is still the optimistic
 *   stand-in, or before the list is read (an unread list is not "not saved").
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { videoSaveOf } from "@/lib/discover-next/saved-ref";
import type { SavedItem } from "@/lib/shelf/shelf-repo";

import { useVideoSave } from "../use-video-save";

vi.setConfig({ testTimeout: 20_000 });

const VIDEO_ID = "0b6f3c1e-8f2a-4c55-9d3e-2a7b1c4d5e6f";

const ROW = videoSaveOf({
  id: VIDEO_ID,
  spokenHook: "I ran an experiment to see if the pool really smells of chlorine",
  videoUrl: "https://videos.example/nia.cooks/1",
  coverUrl: "https://covers.example/nia.cooks/1.jpg",
  views: 25_000_000,
  multiplier: 16,
  baselineLabel: "vs their average",
  handle: "nia.cooks",
  platform: "tiktok",
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function savedRow(id: string, over: Partial<SavedItem> = {}): SavedItem {
  return {
    id,
    user_id: "u-1",
    item_type: "outlier",
    ref_id: VIDEO_ID,
    thread_id: null,
    project_id: null,
    title: ROW.title,
    snapshot: ROW.snapshot,
    created_at: "2026-11-25T10:00:00Z",
    ...over,
  };
}

/** What the server holds, and how it answers. */
let list: SavedItem[];
let listAnswer: () => Promise<Response>;
let onPost: (body: unknown) => Promise<Response>;
let onDelete: (id: string) => Promise<Response>;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  if (url.pathname !== "/api/saved") return json({}, 404);
  if (method === "POST") return onPost(JSON.parse(String(init!.body)));
  if (method === "DELETE") return onDelete(url.searchParams.get("id") ?? "");
  return listAnswer();
});

/** Every request that changes the shelf: its method, its body, the id a remove names. */
const writes = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST" || init?.method === "DELETE")
    .map(([input, init]) => ({
      method: init!.method,
      body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
      id: new URL(String(input), "http://localhost").searchParams.get("id"),
    }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>
    <ToastProvider>{children}</ToastProvider>
  </QueryClientProvider>
);
const mount = () => renderHook(() => useVideoSave(ROW), { wrapper });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  list = [];
  listAnswer = async () => json({ items: list });
  onPost = async (body) => {
    const input = body as Partial<SavedItem>;
    const row = savedRow("sv-1", { title: input.title ?? null });
    list = [row, ...list];
    return json({ item: row }, 201);
  };
  onDelete = async (id) => {
    list = list.filter((row) => row.id !== id);
    return json({ success: true });
  };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

describe("useVideoSave", () => {
  it("saves exactly the row Library reads: an outlier under the video's id, no chat, its line, its snapshot", async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.saved).toBe(false);

    act(() => result.current.toggle());

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      method: "POST",
      id: null,
      body: {
        item_type: "outlier",
        ref_id: VIDEO_ID,
        thread_id: null,
        title: "I ran an experiment to see if the pool really smells of chlorine",
        snapshot: {
          caption: "I ran an experiment to see if the pool really smells of chlorine",
          videoUrl: "https://videos.example/nia.cooks/1",
          coverUrl: "https://covers.example/nia.cooks/1.jpg",
          views: 25_000_000,
          multiplier: 16,
          baselineLabel: "vs their average",
          handle: "nia.cooks",
          platform: "tiktok",
        },
      },
    });
    // Marked at once (the optimistic row), and still once the list is read again with the real row.
    expect(result.current.saved).toBe(true);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.saved).toBe(true);
  });

  it("a video saved before is saved on a fresh mount: the mark comes from the list", async () => {
    list = [savedRow("sv-7")];
    const { result, unmount } = mount();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.saved).toBe(true);
    unmount();

    client.clear();
    const again = mount();
    await waitFor(() => expect(again.result.current.ready).toBe(true));
    expect(again.result.current.saved).toBe(true);
  });

  it("a row saved by another kind, or for another video, is not this video's mark", async () => {
    list = [savedRow("sv-8", { item_type: "hook" }), savedRow("sv-9", { ref_id: "another-video" })];
    const { result } = mount();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.saved).toBe(false);
  });

  it("a tap on a saved video removes that row, by its id", async () => {
    list = [savedRow("sv-7")];
    const { result } = mount();
    await waitFor(() => expect(result.current.saved).toBe(true));

    act(() => result.current.toggle());

    await waitFor(() => expect(writes()).toEqual([{ method: "DELETE", id: "sv-7", body: undefined }]));
    await waitFor(() => expect(result.current.saved).toBe(false));
  });

  it("a double tap sends one request", async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.toggle();
      result.current.toggle();
    });
    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(writes()).toHaveLength(1);
    expect(writes()[0]!.method).toBe("POST");
  });

  it("nothing goes out while the save is on its way, nor while the row is the optimistic stand-in", async () => {
    const answer = deferred<Response>();
    onPost = () => answer.promise;
    const { result } = mount();
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.busy).toBe(true));
    // Saved on screen, but the row shown is the stand-in: it cannot be removed yet.
    expect(result.current.saved).toBe(true);
    act(() => result.current.toggle());
    expect(writes()).toHaveLength(1);

    list = [savedRow("sv-1")];
    await act(async () => answer.resolve(json({ item: savedRow("sv-1") }, 201)));
    await waitFor(() => expect(result.current.busy).toBe(false));

    // The real row is in: a tap now removes it.
    act(() => result.current.toggle());
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()[1]).toEqual({ method: "DELETE", id: "sv-1", body: undefined });
  });

  it("does nothing before the list is read: an unread list is not 'not saved'", async () => {
    const answer = deferred<Response>();
    listAnswer = () => answer.promise;
    const { result } = mount();
    expect(result.current.ready).toBe(false);
    expect(result.current.saved).toBe(false);

    act(() => result.current.toggle());
    expect(writes()).toEqual([]);

    await act(async () => answer.resolve(json({ items: [savedRow("sv-7")] })));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.saved).toBe(true);
    expect(writes()).toEqual([]);
  });

  it("a list that cannot be read is not a dead button: a press asks for the list again (once while it is out), and writes nothing", async () => {
    const lists = () => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET").length;
    const again = deferred<Response>();
    let answers = 0;
    listAnswer = () => (++answers === 1 ? Promise.resolve(json({}, 500)) : again.promise);
    const { result } = mount();
    await waitFor(() => expect(result.current.unread).toBe(true));
    expect(result.current.ready).toBe(false);
    expect(lists()).toBe(1);

    act(() => result.current.toggle());
    await waitFor(() => expect(lists()).toBe(2));
    // Asked again already: a second press does not ask a third time.
    act(() => result.current.toggle());
    expect(lists()).toBe(2);

    await act(async () => again.resolve(json({ items: [savedRow("sv-7")] })));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.unread).toBe(false);
    expect(result.current.saved).toBe(true);
    expect(writes()).toEqual([]);
  });

  it("while the list is still on its first read it is neither ready nor unread", async () => {
    const answer = deferred<Response>();
    listAnswer = () => answer.promise;
    const { result } = mount();
    expect(result.current.ready).toBe(false);
    expect(result.current.unread).toBe(false);
    await act(async () => answer.resolve(json({ items: [] })));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it("a refused save says so, leaves the video not saved, and a later tap may try again", async () => {
    onPost = async () => json({ error: "nope" }, 500);
    const { result } = mount();
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.toggle());
    expect(await screen.findByText("Couldn't save this video.")).toBeInTheDocument();
    await waitFor(() => expect(result.current.busy).toBe(false));
    await waitFor(() => expect(result.current.saved).toBe(false));
    expect(screen.queryByText("Couldn't remove this video.")).toBeNull();

    act(() => result.current.toggle());
    await waitFor(() => expect(writes()).toHaveLength(2));
  });

  it("a refused remove says so, and the video stays saved", async () => {
    list = [savedRow("sv-7")];
    onDelete = async () => json({ error: "nope" }, 500);
    const { result } = mount();
    await waitFor(() => expect(result.current.saved).toBe(true));

    act(() => result.current.toggle());
    expect(await screen.findByText("Couldn't remove this video.")).toBeInTheDocument();
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.saved).toBe(true);
    expect(screen.queryByText("Couldn't save this video.")).toBeNull();
  });
});
