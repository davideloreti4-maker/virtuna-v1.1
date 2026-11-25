/** @vitest-environment happy-dom */
/**
 * use-you (plan 2026-11-24-you, Tasks 2, 5 and 6): `useYou`, the saves and the connect of You, and an
 * account's Make primary and Disconnect.
 * Real: the hooks and a real QueryClient (the creator-profile and profile reads too, where a test
 * needs a read in flight). Stood in for: `fetch`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { CONNECT_OFFLINE } from "@/components/you-next/you-words";
import { useCreatorProfile } from "@/hooks/queries/use-creator-profile";
import { useProfile } from "@/hooks/queries/use-profile";
import { queryKeys } from "@/lib/queries/query-keys";
import type { YouPage } from "@/lib/you/you-read";
import {
  CONNECT_FAILED,
  useConnectAccount,
  useDisconnectAccount,
  useMakePrimary,
  useSaveCreatorProfile,
  useSaveName,
  useYou,
  youKeys,
} from "../use-you";

const PAGE = { accounts: [], followers: null, read: null };
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  // The app's query defaults (`(app)/providers.tsx`: fresh for a minute, no refetch on focus), no retries.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false } } });
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

describe("useYou", () => {
  it("reads GET /api/you into its own key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PAGE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useYou(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("/api/you");
    expect(client.getQueryData(youKeys.page)).toEqual(PAGE);
    expect(youKeys).toEqual({ all: ["you"], page: ["you", "page"] });
  });

  it("asks once when the answer is a refusal, on a client with the app's defaults", async () => {
    // The app's client sets no `retry`, so the library's own three retries would re-ask a route
    // that answers 401, 404 or 500 and hold the error back for seconds.
    client = new QueryClient();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useYou(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a refused answer is an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const { result } = renderHook(() => useYou(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

const ROW = { niche_primary: "food-cooking", niche_sub: null, primary_goal: null, about: "Nurse.", sells: null, never_do: null };
const NAMED = { name: "Nia Test", email: "nia@example.com", company: "", role: "", avatar: null, notifications: {} };

/**
 * A small server for one entry: a GET reads the row as it is when the request arrives and answers
 * when the test says (`gets`); a PATCH is answered when the test says too (`patches`), and only then
 * changes the row. So a read sent before a save was answered carries the old text, as a real one can.
 */
function heldServer(start: Record<string, unknown>, apply: (row: Record<string, unknown>, body: Record<string, unknown>) => void) {
  const row = { ...start };
  const gets: Array<() => void> = [];
  const patches: Array<(ok: boolean) => void> = [];
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return new Promise<Response>((resolve) =>
        patches.push((ok) => {
          if (ok) apply(row, JSON.parse(String(init.body)) as Record<string, unknown>);
          resolve(ok ? json({ success: true }) : json({ error: "Failed" }, 500));
        }),
      );
    }
    const read = { ...row };
    return new Promise<Response>((resolve) => gets.push(() => resolve(json(read))));
  });
  vi.stubGlobal("fetch", fetchMock);
  const sent = (method: "GET" | "PATCH") => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method).length;
  return { row, gets, patches, sent };
}

/** Every value a hook showed, render by render: a flash of an old value is in it, however short. */
function renders() {
  const values: unknown[] = [];
  return {
    track<T>(result: T, pick: (r: T) => unknown): T {
      values.push(pick(result));
      return result;
    },
    /** What was shown from the first render of `value` on. */
    after(value: unknown): unknown[] {
      const at = values.indexOf(value);
      if (at < 0) throw new Error(`${String(value)} was never shown`);
      return values.slice(at);
    },
  };
}

describe("useSaveCreatorProfile", () => {
  it("sends the one key, shows it at once, keeps it when the server says yes", async () => {
    let answer!: (r: Response) => void;
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    client.setQueryData(queryKeys.profile.creatorProfile(), ROW);
    const { result } = renderHook(() => useSaveCreatorProfile(), { wrapper });
    let done!: Promise<void>;
    act(() => {
      done = result.current.mutateAsync({ sells: "A plan." });
    });
    await waitFor(() => expect(client.getQueryData(queryKeys.profile.creatorProfile())).toMatchObject({ sells: "A plan." }));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/profile/creator-profile");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ sells: "A plan." }) });
    await act(async () => {
      answer(new Response(JSON.stringify({ success: true }), { status: 200 }));
      await done;
    });
    expect(client.getQueryData(queryKeys.profile.creatorProfile())).toMatchObject({ sells: "A plan." });
  });

  it("refused: only its own key goes back", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) =>
      new Response("{}", { status: String(init?.body).includes("never_do") ? 200 : 500 })));
    client.setQueryData(queryKeys.profile.creatorProfile(), ROW);
    const { result } = renderHook(() => useSaveCreatorProfile(), { wrapper });
    await act(async () => {
      await Promise.allSettled([result.current.mutateAsync({ about: "Changed." }), result.current.mutateAsync({ never_do: "No giveaways." })]);
    });
    expect(client.getQueryData(queryKeys.profile.creatorProfile())).toMatchObject({ about: "Nurse.", never_do: "No giveaways." });
  });

  it("a read that starts and lands while the save is out never shows the old text, and the saved text is there when the save resolves", async () => {
    const server = heldServer(ROW, (row, body) => Object.assign(row, body));
    client.setQueryData(queryKeys.profile.creatorProfile(), ROW);
    const seen = renders();
    const { result } = renderHook(() => seen.track({ save: useSaveCreatorProfile(), profile: useCreatorProfile() }, (r) => r.profile.data?.sells), { wrapper });
    let done!: Promise<void>;
    let atResolve: unknown = "not resolved";
    act(() => {
      done = result.current.save.mutateAsync({ sells: "A plan." }).then(() => {
        atResolve = client.getQueryData<Record<string, unknown>>(queryKeys.profile.creatorProfile())?.sells;
      });
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(1));
    await waitFor(() => expect(result.current.profile.data?.sells).toBe("A plan."));
    // Something else (Settings, a second window) reads the entry while the save is out; the read is
    // answered before the write lands, with the old row.
    await act(async () => {
      void client.invalidateQueries({ queryKey: queryKeys.profile.creatorProfile() });
    });
    await waitFor(() => expect(server.gets).toHaveLength(1));
    await act(async () => server.gets[0]!());
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(result.current.profile.data?.sells).toBe("A plan.");
    // The server says yes: the saved text is in the entry by the time the save resolves.
    await act(async () => {
      server.patches[0]!(true);
      await done;
    });
    expect(atResolve).toBe("A plan.");
    // Its own read, sent after the yes, is still out: what the hook shows can only be the entry's.
    expect(server.gets).toHaveLength(2);
    await act(async () => server.gets[1]!());
    expect(result.current.profile.data?.sells).toBe("A plan.");
    expect(seen.after("A plan.")).not.toContain(null);
  });

  it("two saves of different keys overlapping: a read that lands while the second is out never shows its old text; both end saved; one read after the last", async () => {
    const server = heldServer(ROW, (row, body) => Object.assign(row, body));
    client.setQueryData(queryKeys.profile.creatorProfile(), ROW);
    const seen = renders();
    const { result } = renderHook(() => seen.track({ save: useSaveCreatorProfile(), profile: useCreatorProfile() }, (r) => r.profile.data?.sells), { wrapper });
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.save.mutateAsync({ about: "Nurse, two kids." });
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(1));
    act(() => {
      second = result.current.save.mutateAsync({ sells: "A plan." });
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(2));
    await waitFor(() => expect(result.current.profile.data?.sells).toBe("A plan."));
    // The first is answered: no read goes out while the second is still out.
    await act(async () => {
      server.patches[0]!(true);
      await first;
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(server.gets).toHaveLength(0);
    // A read starts anyway (another save's re-read, Settings, a second window) and is answered with
    // the second key's OLD value: the server has not applied it yet.
    await act(async () => {
      void client.invalidateQueries({ queryKey: queryKeys.profile.creatorProfile() });
    });
    await waitFor(() => expect(server.gets).toHaveLength(1));
    await act(async () => server.gets[0]!());
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(result.current.profile.data).toMatchObject({ about: "Nurse, two kids.", sells: "A plan." });
    // The second is answered: one read goes out, after the last save.
    await act(async () => {
      server.patches[1]!(true);
      await second;
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(server.gets).toHaveLength(2);
    await act(async () => server.gets[1]!());
    expect(result.current.profile.data).toMatchObject({ about: "Nurse, two kids.", sells: "A plan." });
    expect(server.row).toMatchObject({ about: "Nurse, two kids.", sells: "A plan." });
    expect(seen.after("A plan.")).not.toContain(null);
  });

  it("left while a save is out (no one reads the entry): the saved text stays in it", async () => {
    const server = heldServer(ROW, (row, body) => Object.assign(row, body));
    client.setQueryData(queryKeys.profile.creatorProfile(), ROW);
    const { result, unmount } = renderHook(() => ({ save: useSaveCreatorProfile(), profile: useCreatorProfile() }), { wrapper });
    let done!: Promise<void>;
    act(() => {
      done = result.current.save.mutateAsync({ sells: "A plan." });
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(1));
    // A read starts and the page is left before it is answered (it carries the old row).
    await act(async () => {
      void client.invalidateQueries({ queryKey: queryKeys.profile.creatorProfile() });
    });
    await waitFor(() => expect(server.gets).toHaveLength(1));
    unmount();
    await act(async () => {
      server.patches[0]!(true);
      await done;
    });
    await act(async () => server.gets[0]!());
    expect(client.getQueryData(queryKeys.profile.creatorProfile())).toMatchObject({ sells: "A plan." });
  });

  it("after a yes the entry is read again, and the save does not wait for that read", async () => {
    const server = heldServer(ROW, (row, body) => Object.assign(row, body));
    client.setQueryData(queryKeys.profile.creatorProfile(), ROW);
    const { result } = renderHook(() => ({ save: useSaveCreatorProfile(), profile: useCreatorProfile() }), { wrapper });
    let resolved = false;
    act(() => {
      void result.current.save.mutateAsync({ sells: "A plan." }).then(() => (resolved = true));
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(1));
    await act(async () => server.patches[0]!(true));
    await waitFor(() => expect(resolved).toBe(true));
    // Resolved while its read is still out.
    expect(server.gets).toHaveLength(1);
    await act(async () => server.gets[0]!());
    expect(result.current.profile.data).toMatchObject({ sells: "A plan.", about: "Nurse." });
  });

  it("a read that was out when the server said yes is dropped: its old text never reaches the entry", async () => {
    const server = heldServer(ROW, (row, body) => Object.assign(row, body));
    client.setQueryData(queryKeys.profile.creatorProfile(), ROW);
    const { result } = renderHook(() => ({ save: useSaveCreatorProfile(), profile: useCreatorProfile() }), { wrapper });
    let done!: Promise<void>;
    act(() => {
      done = result.current.save.mutateAsync({ sells: "A plan." });
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(1));
    await act(async () => {
      void client.invalidateQueries({ queryKey: queryKeys.profile.creatorProfile() });
    });
    await waitFor(() => expect(server.gets).toHaveLength(1));
    await act(async () => {
      server.patches[0]!(true);
      await done;
    });
    // The read sent before the yes (it carries the old row) answers late; then the one sent after.
    await act(async () => server.gets[0]!());
    expect(result.current.profile.data?.sells).toBe("A plan.");
    await waitFor(() => expect(server.gets).toHaveLength(2));
    await act(async () => server.gets[1]!());
    expect(result.current.profile.data?.sells).toBe("A plan.");
  });

  it("refused, the entry is read again too", async () => {
    const server = heldServer(ROW, (row, body) => Object.assign(row, body));
    client.setQueryData(queryKeys.profile.creatorProfile(), ROW);
    const { result } = renderHook(() => ({ save: useSaveCreatorProfile(), profile: useCreatorProfile() }), { wrapper });
    let failed = false;
    act(() => {
      void result.current.save.mutateAsync({ about: "Changed." }).catch(() => (failed = true));
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(1));
    await act(async () => server.patches[0]!(false));
    await waitFor(() => expect(failed).toBe(true));
    expect(result.current.profile.data?.about).toBe("Nurse.");
    expect(server.gets).toHaveLength(1);
  });

  it("asks once when refused, on a client with the app's defaults", async () => {
    client = new QueryClient();
    const fetchMock = vi.fn(async () => json({ error: "Failed" }, 500));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSaveCreatorProfile(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ about: "Changed." }).catch(() => {});
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useSaveName", () => {
  it("sends display_name and shows it at once; refused, the old name returns", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    client.setQueryData(queryKeys.profile.current(), { name: "Nia Test", email: "nia@example.com" });
    const { result } = renderHook(() => useSaveName(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("Nia T").catch(() => {});
    });
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("/api/profile");
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ display_name: "Nia T" }) });
    expect(client.getQueryData(queryKeys.profile.current())).toMatchObject({ name: "Nia Test" });
  });

  it("shows the name at once", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    client.setQueryData(queryKeys.profile.current(), NAMED);
    const { result } = renderHook(() => useSaveName(), { wrapper });
    act(() => {
      void result.current.mutateAsync("Nia T");
    });
    await waitFor(() => expect(client.getQueryData(queryKeys.profile.current())).toMatchObject({ name: "Nia T" }));
  });

  it("refused: only the name goes back (a photo that came meanwhile stays)", async () => {
    const server = heldServer(NAMED, (row, body) => (row.name = body.display_name));
    client.setQueryData(queryKeys.profile.current(), NAMED);
    const { result } = renderHook(() => useSaveName(), { wrapper });
    let failed = false;
    act(() => {
      void result.current.mutateAsync("Nia T").catch(() => (failed = true));
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(1));
    act(() => {
      client.setQueryData(queryKeys.profile.current(), (now: typeof NAMED | undefined) => (now ? { ...now, avatar: "https://cdn.example.test/nia.png" } : now));
    });
    await act(async () => server.patches[0]!(false));
    await waitFor(() => expect(failed).toBe(true));
    expect(client.getQueryData(queryKeys.profile.current())).toMatchObject({ name: "Nia Test", avatar: "https://cdn.example.test/nia.png" });
  });

  it("a read that starts and lands while the name is saving never shows the old name", async () => {
    const server = heldServer(NAMED, (row, body) => (row.name = body.display_name));
    client.setQueryData(queryKeys.profile.current(), NAMED);
    const seen = renders();
    const { result } = renderHook(() => seen.track({ save: useSaveName(), profile: useProfile() }, (r) => r.profile.data?.name), { wrapper });
    let done!: Promise<void>;
    let atResolve: unknown = "not resolved";
    act(() => {
      done = result.current.save.mutateAsync("Nia T").then(() => {
        atResolve = client.getQueryData<typeof NAMED>(queryKeys.profile.current())?.name;
      });
    });
    await waitFor(() => expect(server.sent("PATCH")).toBe(1));
    await waitFor(() => expect(result.current.profile.data?.name).toBe("Nia T"));
    // A photo's upload marks the profile stale while the name is out (useUploadAvatar does); its
    // read is answered before the name is written.
    await act(async () => {
      void client.invalidateQueries({ queryKey: queryKeys.profile.current() });
    });
    await waitFor(() => expect(server.gets).toHaveLength(1));
    await act(async () => server.gets[0]!());
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(result.current.profile.data?.name).toBe("Nia T");
    expect(seen.after("Nia T")).not.toContain("Nia Test");
    await act(async () => {
      server.patches[0]!(true);
      await done;
    });
    expect(atResolve).toBe("Nia T");
    // Its own read, sent after the yes, is still out: the save did not wait for it.
    expect(server.gets).toHaveLength(2);
    await act(async () => server.gets[1]!());
    expect(result.current.profile.data?.name).toBe("Nia T");
  });
});

describe("useConnectAccount", () => {
  const connectWith = async (respond: () => Promise<Response>) => {
    vi.stubGlobal("fetch", vi.fn(respond));
    const { result } = renderHook(() => useConnectAccount(), { wrapper });
    let message = "";
    await act(async () => {
      await result.current.mutateAsync({ platform: "instagram", handle: "nia.tests.kitchen" }).catch((e: Error) => (message = e.message));
    });
    return message;
  };

  it("posts the platform and the handle, and marks the page stale", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    expect(await connectWith(async () => new Response(JSON.stringify({ account: { id: "x" } }), { status: 200 }))).toBe("");
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("/api/connected-accounts/connect");
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ method: "POST", body: JSON.stringify({ platform: "instagram", handle: "nia.tests.kitchen" }) });
    expect(spy).toHaveBeenCalledWith({ queryKey: youKeys.all });
  });

  it("the route's own sentence is shown as it is", async () => {
    expect(await connectWith(async () => new Response(JSON.stringify({ error: "Couldn't connect that account. Try again." }), { status: 500 }))).toBe(
      "Couldn't connect that account. Try again.",
    );
    expect(await connectWith(async () => json({ error: "We couldn't read that account. Check the handle and try again." }, 502))).toBe(
      "We couldn't read that account. Check the handle and try again.",
    );
  });

  it("a code is not a sentence: the existing message instead", async () => {
    expect(CONNECT_FAILED).toBe("We couldn't read that account. Check the handle and try again.");
    expect(await connectWith(async () => new Response(JSON.stringify({ error: "invalid_connect_input" }), { status: 400 }))).toBe(CONNECT_FAILED);
    expect(await connectWith(async () => new Response("not json", { status: 502 }))).toBe(CONNECT_FAILED);
    // A yes without an account is no connect.
    expect(await connectWith(async () => json({}))).toBe(CONNECT_FAILED);
  });

  it("no network: the existing offline message", async () => {
    expect(await connectWith(async () => Promise.reject(new TypeError("Failed to fetch")))).toBe(CONNECT_OFFLINE);
  });

  it("a refused connect marks nothing stale and asks once, on a client with the app's defaults", async () => {
    client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    expect(await connectWith(async () => json({ error: "We couldn't read that account. Check the handle and try again." }, 502))).not.toBe("");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── An account's More: Make primary, Disconnect ─────────────────────────────

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const account = (n: number, primary: boolean) => ({ id: ID(n), platform: "tiktok" as const, handle: `nia.tests.${n}`, primary });
/** Three accounts as the server lists them: the primary first, then the others oldest first (1, 2, 3). */
const PAGE3: YouPage = { accounts: [account(1, true), account(2, false), account(3, false)], followers: 12400, read: null };
/** The page's accounts as "n" or "n*" (the primary), in its order. */
const marks = (page = client.getQueryData<YouPage>(youKeys.page)) => page!.accounts.map((a) => `${a.id.slice(-1)}${a.primary ? "*" : ""}`);
const page = () => client.getQueryData<YouPage>(youKeys.page)!;

/**
 * The accounts routes as a small server. A GET answers at once with the accounts as they are now
 * (the primary first, then the others oldest first, as `listConnectedAccounts`). A PATCH or a DELETE
 * waits for the test (`answer(n, ok)`, the n-th one sent), and only a yes changes the accounts, by
 * the server's rules: a primary that leaves hands the mark to the oldest remaining one.
 */
function accountServer(start: YouPage = PAGE3) {
  const created = start.accounts.map((a) => a.id);
  let accounts = start.accounts.map((a) => ({ ...a }));
  let followers = start.followers;
  const held: Array<(ok: boolean) => void> = [];
  const oldestFirst = (list: typeof accounts) => [...list].sort((a, b) => created.indexOf(a.id) - created.indexOf(b.id));
  const listed = () => [...accounts.filter((a) => a.primary), ...oldestFirst(accounts.filter((a) => !a.primary))];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET") return Promise.resolve(json({ ...start, accounts: listed(), followers }));
    const id = url.split("/").pop()!;
    return new Promise<Response>((resolve) =>
      held.push((ok) => {
        if (ok && method === "PATCH") accounts = accounts.map((a) => ({ ...a, primary: a.id === id }));
        if (ok && method === "DELETE") {
          const gone = accounts.find((a) => a.id === id);
          accounts = accounts.filter((a) => a.id !== id);
          const oldest = oldestFirst(accounts)[0];
          if (gone?.primary && oldest) accounts = accounts.map((a) => ({ ...a, primary: a.id === oldest.id }));
        }
        resolve(ok ? (method === "DELETE" ? new Response(null, { status: 204 }) : json({ ok: true })) : json({ error: "not_found" }, 404));
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  const sent = (method: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);
  /** Answers the n-th action sent (0 first), then lets the hooks finish with it. */
  const answer = async (n: number, ok: boolean) => {
    await waitFor(() => expect(held[n]).toBeDefined());
    await act(async () => {
      held[n]!(ok);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  };
  return { sent, answer, setFollowers: (n: number) => (followers = n) };
}

/** The page, read by `useYou` (as You does), with both actions. */
const withPage = () =>
  renderHook(() => ({ you: useYou(), makePrimary: useMakePrimary(), disconnect: useDisconnectAccount() }), { wrapper });

describe("useMakePrimary", () => {
  it("PATCHes is_primary on that account; the mark moves and the account goes first at once, its followers unknown until read again", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = renderHook(() => useMakePrimary(), { wrapper });
    act(() => result.current.mutate(ID(3)));
    expect(marks()).toEqual(["3*", "1", "2"]);
    expect(page().followers).toBeNull();
    await waitFor(() => expect(server.sent("PATCH")).toHaveLength(1));
    const [url, init] = server.sent("PATCH")[0]!;
    expect(url).toBe(`/api/connected-accounts/${ID(3)}`);
    expect(init).toMatchObject({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_primary: true }) });
  });

  it("the server says yes: the mark stays, and the page is read again once", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = withPage();
    act(() => result.current.makePrimary.mutate(ID(3)));
    await server.answer(0, true);
    await waitFor(() => expect(server.sent("GET")).toHaveLength(1));
    await waitFor(() => expect(page().followers).toBe(12400));
    expect(marks()).toEqual(["3*", "1", "2"]);
  });

  it("refused: the mark, the order and the followers go back, and the page is read again", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = withPage();
    act(() => result.current.makePrimary.mutate(ID(3)));
    await server.answer(0, false);
    expect(page()).toEqual(PAGE3);
    expect(result.current.makePrimary.isError).toBe(true);
    await waitFor(() => expect(server.sent("GET")).toHaveLength(1));
    expect(page()).toEqual(PAGE3);
  });
});

describe("useDisconnectAccount", () => {
  it("DELETEs that account; its row leaves at once; the primary gone, the oldest remaining one takes the mark, the followers unknown", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = renderHook(() => useDisconnectAccount(), { wrapper });
    act(() => result.current.mutate(ID(1)));
    expect(marks()).toEqual(["2*", "3"]);
    expect(page().followers).toBeNull();
    await waitFor(() => expect(server.sent("DELETE")).toHaveLength(1));
    const [url, init] = server.sent("DELETE")[0]!;
    expect(url).toBe(`/api/connected-accounts/${ID(1)}`);
    expect(init).toMatchObject({ method: "DELETE" });
    expect(init?.body).toBeUndefined();
  });

  it("an account that is not the primary leaves alone: the mark and the followers stay", () => {
    accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = renderHook(() => useDisconnectAccount(), { wrapper });
    act(() => result.current.mutate(ID(2)));
    expect(marks()).toEqual(["1*", "3"]);
    expect(page().followers).toBe(12400);
  });

  it("the server says yes: the page is read again once and holds what the server holds", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = withPage();
    act(() => result.current.disconnect.mutate(ID(1)));
    await server.answer(0, true);
    await waitFor(() => expect(server.sent("GET")).toHaveLength(1));
    await waitFor(() => expect(page().followers).toBe(12400));
    expect(marks()).toEqual(["2*", "3"]);
  });

  it("refused: the row comes back in its place, with its mark and the followers", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = withPage();
    act(() => result.current.disconnect.mutate(ID(1)));
    await server.answer(0, false);
    expect(page()).toEqual(PAGE3);
    expect(result.current.disconnect.isError).toBe(true);
  });

  it("each asks once when refused, on a client with the app's defaults", async () => {
    client = new QueryClient();
    const fetchMock = vi.fn(async () => json({ error: "not_found" }, 404));
    vi.stubGlobal("fetch", fetchMock);
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = renderHook(() => ({ makePrimary: useMakePrimary(), disconnect: useDisconnectAccount() }), { wrapper });
    await act(async () => {
      await result.current.makePrimary.mutateAsync(ID(2)).catch(() => {});
      await result.current.disconnect.mutateAsync(ID(2)).catch(() => {});
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Make primary and Disconnect out at once", () => {
  it("the first refused: only its change goes back; the other's stays, and holds once it is answered", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = withPage();
    act(() => result.current.disconnect.mutate(ID(2)));
    act(() => result.current.makePrimary.mutate(ID(3)));
    expect(marks()).toEqual(["3*", "1"]);
    await server.answer(0, false);
    expect(marks()).toEqual(["3*", "1", "2"]);
    await server.answer(1, true);
    await waitFor(() => expect(server.sent("GET")).toHaveLength(1));
    await waitFor(() => expect(page().followers).toBe(12400));
    expect(marks()).toEqual(["3*", "1", "2"]);
  });

  it("the second refused: the first's change stays", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = withPage();
    act(() => result.current.disconnect.mutate(ID(2)));
    act(() => result.current.makePrimary.mutate(ID(3)));
    await server.answer(1, false);
    expect(marks()).toEqual(["1*", "3"]);
    expect(page().followers).toBe(12400);
    await server.answer(0, true);
    await waitFor(() => expect(server.sent("GET")).toHaveLength(1));
    expect(marks()).toEqual(["1*", "3"]);
  });

  it("the page is read once, after the last one out is answered, not while another is out", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = withPage();
    act(() => result.current.disconnect.mutate(ID(2)));
    act(() => result.current.disconnect.mutate(ID(3)));
    await server.answer(0, true);
    expect(server.sent("GET")).toHaveLength(0);
    expect(marks()).toEqual(["1*"]);
    await server.answer(1, true);
    await waitFor(() => expect(server.sent("GET")).toHaveLength(1));
    expect(marks()).toEqual(["1*"]);
  });

  it("a read that lands while one is out keeps it shown; refused, the page goes back to that read, not the older one", async () => {
    const server = accountServer();
    client.setQueryData(youKeys.page, PAGE3);
    const { result } = withPage();
    act(() => result.current.disconnect.mutate(ID(2)));
    await waitFor(() => expect(server.sent("DELETE")).toHaveLength(1));
    // Another read of the page (a connect elsewhere on the page asks for one), answered before the delete.
    server.setFollowers(13000);
    await act(async () => {
      await client.refetchQueries({ queryKey: youKeys.page });
    });
    expect(server.sent("GET")).toHaveLength(1);
    expect(page().followers).toBe(13000);
    expect(marks()).toEqual(["1*", "3"]);
    await server.answer(0, false);
    expect(marks()).toEqual(["1*", "2", "3"]);
    expect(page().followers).toBe(13000);
  });
});
