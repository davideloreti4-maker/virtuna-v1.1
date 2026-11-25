/** @vitest-environment happy-dom */

/**
 * useOpenThread — re-open a thread from anywhere (the legacy shelf, the text result page's "Script
 * this one"). Library plan 2026-11-23, Task 4 fix round 1: it is not Library's open, so it drops
 * the shell's way back to Library (`threadBack`). With the marker left, the phone's Back would go
 * back in history from a chat whose previous entry is not Library (a result page). Real: the hook,
 * the cookie, the stores. Stand-in: the router.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { clearActiveThreadCookie, getActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { useOpenThread } from "../useOpenThread";

beforeEach(() => {
  router.push.mockReset();
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
  useShellStore.setState({ threadBack: "/library", threadTitleHint: { id: "t0", title: "Video simulation" }, libraryScroll: { href: "/library", top: 320 } });
});

describe("useOpenThread", () => {
  it("opens the thread (cookie, store pointer, /home) and drops the way back to Library", () => {
    const { result } = renderHook(() => useOpenThread());

    act(() => result.current("t7"));

    expect(getActiveThreadCookie()).toBe("t7");
    expect(useBoardStore.getState().activeThreadId).toBe("t7");
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useShellStore.getState().threadBack).toBeNull();
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(useShellStore.getState().libraryScroll).toBeNull();
  });
});
