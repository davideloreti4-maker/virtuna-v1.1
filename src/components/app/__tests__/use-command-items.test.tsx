/** @vitest-environment happy-dom */

/**
 * The ⌘K palette's items (shared by both shells). Library plan 2026-11-23, Task 4 fix round 1,
 * item 3: opening a chat or starting a new one from the palette is not opening it from Library, so
 * both drop the shell's way back to Library (`threadBack`); the next Back in that chat starts a new
 * chat, as today. Real: the hook, TanStack Query, the cookie, the stores. Stand-ins: `fetch` (the
 * thread list) and the router.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { NEW_THREAD_SENTINEL, clearActiveThreadCookie, getActiveThreadCookie, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

// The flag off, said out loud (plan 2026-11-24-you): the palette as it is, with no "You".
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => router,
}));

import { useCommandItems } from "../use-command-items";

const THREADS = [{ id: "t2", title: "Gym hooks", updated_at: "2026-11-23T08:00:00Z", created_at: "2026-11-22T08:00:00Z", pinned_at: null }];

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/api/threads/list")
        ? new Response(JSON.stringify({ threads: THREADS }), { status: 200 })
        : new Response("{}", { status: 404 }),
    ),
  );
  router.push.mockReset();
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
  // A chat opened from Library is on screen: the marker is set, with the row's name for the chat
  // and Library's scroll.
  useShellStore.setState({ threadBack: "/library", threadTitleHint: { id: "t1", title: "Video simulation" }, libraryScroll: { href: "/library", top: 320 } });
});

afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

describe("useCommandItems — the way back to Library", () => {
  it("opening a chat from the palette drops it", async () => {
    const { result } = renderHook(() => useCommandItems(), { wrapper });
    await waitFor(() => expect(result.current.some((item) => item.id === "thread-t2")).toBe(true));

    act(() => result.current.find((item) => item.id === "thread-t2")!.onSelect!());

    expect(useShellStore.getState().threadBack).toBeNull();
    // The name the row showed belongs to that other chat, and the scroll to its way back.
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(useShellStore.getState().libraryScroll).toBeNull();
    expect(getActiveThreadCookie()).toBe("t2");
    expect(useBoardStore.getState().activeThreadId).toBe("t2");
    expect(router.push).toHaveBeenCalledWith("/home");
  });

  it("a new thread from the palette drops it", () => {
    setActiveThreadCookie("t1");
    useBoardStore.setState({ activeThreadId: "t1" });
    const { result } = renderHook(() => useCommandItems(), { wrapper });

    act(() => result.current.find((item) => item.id === "new-thread")!.onSelect!());

    expect(useShellStore.getState().threadBack).toBeNull();
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(getActiveThreadCookie()).not.toBe("t1");
    expect(router.push).toHaveBeenCalledWith("/home");
  });

  it("going somewhere else from the palette leaves it to the shell (the route change drops it)", () => {
    const { result } = renderHook(() => useCommandItems(), { wrapper });
    act(() => result.current.find((item) => item.id === "settings")!.onSelect!());
    expect(router.push).toHaveBeenCalledWith("/settings");
    expect(useShellStore.getState().threadBack).toBe("/library");
  });
});

// Kept from the palette as it is: the new-thread item clears the pointer (not the sentinel).
it("the palette's new thread clears the active-thread pointer, as before", () => {
  setActiveThreadCookie("t1");
  const { result } = renderHook(() => useCommandItems(), { wrapper });
  act(() => result.current.find((item) => item.id === "new-thread")!.onSelect!());
  expect(getActiveThreadCookie()).toBeNull();
  expect(getActiveThreadCookie()).not.toBe(NEW_THREAD_SENTINEL);
});

it("with the flag off the palette has no You", () => {
  const { result } = renderHook(() => useCommandItems(), { wrapper });
  expect(result.current.find((item) => item.id === "you")).toBeUndefined();
});

// Plan 2026-11-24-earn, step A: Earn exists under the new look only.
it("with the flag off the palette has no Earn", () => {
  const { result } = renderHook(() => useCommandItems(), { wrapper });
  expect(result.current.find((item) => item.id === "earn")).toBeUndefined();
  expect(result.current.map((item) => item.title)).not.toContain("Earn");
});
