/** @vitest-environment happy-dom */
/**
 * Removing a followed creator: every record they rest on is cleared, side by side (each followed
 * spelling, and the competitor link), and the answer says how it went: "done" only when every one is gone,
 * "session" when the session had lapsed (the app then asks to sign in), else "refused". The real
 * hook over the app's real remove hook and a real QueryClient. Stand-ins only at the edges: `fetch`
 * (the remove route) and the competitor action module (a server action, stubbed at its boundary).
 * Every id is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import type { Removal } from "@/lib/discover-next/watchlist";

// The action's answer may be nothing at all (`undefined`): the hook reads it with `?.`.
const removeCompetitor = vi.hoisted(() => vi.fn<(id: string) => Promise<{ error?: string; success?: boolean } | undefined>>());
vi.mock("@/app/actions/competitors/remove", () => ({ removeCompetitor }));

import { useRemoveCreator, type RemoveAnswer } from "../use-remove-creator";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** How each DELETE is answered; a test replaces it to hold or refuse one. */
let onUntrack: (id: string) => Promise<Response>;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname === "/api/tracked-accounts" && init?.method === "DELETE") return onUntrack(url.searchParams.get("id")!);
  return json({}, 404);
});

/** Every request sent, as method and address. */
const sent = () => fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${String(input)}`);
const untracked = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "DELETE")
    .map(([input]) => new URL(String(input), "http://localhost").searchParams.get("id"));

function removeHook() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useRemoveCreator(), { wrapper }).result;
}

/** Followed under two spellings, and linked: three records. */
const MERGED: Removal = { trackedIds: ["t-jay-tt", "t-jay-ig"], competitorId: "p-jay" };
const FOLLOWED: Removal = { trackedIds: ["t-dev-tt", "t-dev-ig"], competitorId: null };
const LINKED: Removal = { trackedIds: [], competitorId: "p-nia" };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  removeCompetitor.mockReset();
  removeCompetitor.mockResolvedValue({ success: true });
  onUntrack = async () => json({ success: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRemoveCreator — every record, side by side", () => {
  it("a followed-only creator: one DELETE per record, no action", async () => {
    const remove = removeHook();
    await act(async () => {
      await remove.current(FOLLOWED);
    });
    expect(sent()).toEqual(["DELETE /api/tracked-accounts?id=t-dev-tt", "DELETE /api/tracked-accounts?id=t-dev-ig"]);
    expect(removeCompetitor).not.toHaveBeenCalled();
  });

  it("a linked-only creator: the action, no DELETE", async () => {
    const remove = removeHook();
    await act(async () => {
      await remove.current(LINKED);
    });
    expect(sent()).toEqual([]);
    expect(removeCompetitor).toHaveBeenCalledTimes(1);
    expect(removeCompetitor).toHaveBeenCalledWith("p-nia");
  });

  it("a merged creator: both records and the link, sent side by side", async () => {
    const held = deferred<Response>();
    onUntrack = () => held.promise;
    const linkHeld = deferred<{ success: boolean }>();
    removeCompetitor.mockReturnValue(linkHeld.promise);
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    let done!: Promise<void>;
    act(() => {
      done = remove.current(MERGED).then((value) => {
        answer = value;
      });
    });
    // All three go out before any answer comes back.
    await waitFor(() => expect(untracked()).toEqual(["t-jay-tt", "t-jay-ig"]));
    await waitFor(() => expect(removeCompetitor).toHaveBeenCalledWith("p-jay"));
    expect(answer).toBeUndefined();
    await act(async () => {
      held.resolve(json({ success: true }));
      linkHeld.resolve({ success: true });
      await done;
    });
    expect(answer).toBe("done");
  });
});

describe("useRemoveCreator — the answer", () => {
  it("all answered: done", async () => {
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    await act(async () => {
      answer = await remove.current(MERGED);
    });
    expect(answer).toBe("done");
  });

  it("a refused DELETE: refused", async () => {
    onUntrack = async (id) => (id === "t-jay-ig" ? json({ error: "no" }, 500) : json({ success: true }));
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    await act(async () => {
      answer = await remove.current(MERGED);
    });
    expect(answer).toBe("refused");
    // The others were still sent: a refusal stops nothing already out.
    expect(untracked()).toEqual(["t-jay-tt", "t-jay-ig"]);
    expect(removeCompetitor).toHaveBeenCalledWith("p-jay");
  });

  it("the action's answer with an error: refused", async () => {
    removeCompetitor.mockResolvedValue({ error: "Failed to remove competitor" });
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    await act(async () => {
      answer = await remove.current(LINKED);
    });
    expect(answer).toBe("refused");
  });

  it("the action answering nothing: done", async () => {
    removeCompetitor.mockResolvedValue(undefined);
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    await act(async () => {
      answer = await remove.current(LINKED);
    });
    expect(removeCompetitor).toHaveBeenCalledWith("p-nia");
    expect(answer).toBe("done");
  });

  it("nothing to clear (no followed record, no link): done, and nothing sent", async () => {
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    await act(async () => {
      answer = await remove.current({ trackedIds: [], competitorId: null });
    });
    expect(answer).toBe("done");
    expect(sent()).toEqual([]);
    expect(removeCompetitor).not.toHaveBeenCalled();
  });

  it("the action's answer that the session has lapsed: session", async () => {
    removeCompetitor.mockResolvedValue({ error: "Not authenticated" });
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    await act(async () => {
      answer = await remove.current(LINKED);
    });
    expect(answer).toBe("session");
  });

  it("the session lapsed beside another refusal: session (signing in is what helps)", async () => {
    removeCompetitor.mockResolvedValue({ error: "Not authenticated" });
    onUntrack = async (id) => (id === "t-jay-ig" ? json({ error: "no" }, 500) : json({ success: true }));
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    await act(async () => {
      answer = await remove.current(MERGED);
    });
    expect(answer).toBe("session");
    // Everything was still sent.
    expect(untracked()).toEqual(["t-jay-tt", "t-jay-ig"]);
  });

  it("the action throwing: refused", async () => {
    removeCompetitor.mockRejectedValue(new Error("network"));
    const remove = removeHook();
    let answer: RemoveAnswer | undefined;
    await act(async () => {
      answer = await remove.current(MERGED);
    });
    expect(answer).toBe("refused");
  });
});
