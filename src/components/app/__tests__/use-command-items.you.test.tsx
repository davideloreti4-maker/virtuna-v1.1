/** @vitest-environment happy-dom */
/** The ⌘K palette under the new look (plan 2026-11-24-you): "You" under Go to, before Settings. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useShellStore } from "@/stores/shell-store";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ usePathname: () => "/home", useRouter: () => router }));

import { useCommandItems } from "../use-command-items";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ threads: [] }), { status: 200 })));
  router.push.mockReset();
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

describe("useCommandItems under the new look", () => {
  it("offers You and Earn under Go to, before Settings; You opens /you", () => {
    const { result } = renderHook(() => useCommandItems(), { wrapper });
    expect(result.current.filter((item) => item.group === "Go to").map((item) => item.title)).toEqual(["Audience", "You", "Earn", "Settings"]);
    act(() => result.current.find((item) => item.id === "you")!.onSelect!());
    expect(router.push).toHaveBeenCalledWith("/you");
  });

  // Plan 2026-11-24-earn, step A.
  it("Earn opens /earn", () => {
    const { result } = renderHook(() => useCommandItems(), { wrapper });
    act(() => result.current.find((item) => item.id === "earn")!.onSelect!());
    expect(router.push).toHaveBeenCalledWith("/earn");
  });

  // As the palette's other destinations (Audience, Settings): the route change is the shell's, and
  // the shell drops the way back to Library there (next-shell.test.tsx, "going to You from a chat").
  it("going to You leaves the way back to Library to the shell, as the other destinations do", () => {
    useShellStore.setState({ threadBack: "/library", threadTitleHint: { id: "t1", title: "Video simulation" }, libraryScroll: { href: "/library", top: 320 } });
    const { result } = renderHook(() => useCommandItems(), { wrapper });
    act(() => result.current.find((item) => item.id === "you")!.onSelect!());
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/you");
    expect(useShellStore.getState().threadBack).toBe("/library");
  });
});
