/** @vitest-environment happy-dom */
/**
 * Flag off, "Money made" (Earn plan 2026-11-24, step C) is not there: the start page is the old one,
 * no Home of the new look is drawn, and nothing asks for Earn. The real composer on a blank new chat
 * (the active-thread cookie holds the sentinel, `/api/threads/open` answers no messages): the state in
 * which, with the flag on, Home and its row are drawn. Stand-ins only for the network (`fetch`), the
 * router, the storage client and the flag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";

import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));
// The other two as the dev server runs them, as in `composer-home.flag-on.test.tsx`: with the new look
// on, this same page draws Home and its row (checked by flipping the flag above), so the new look is the
// only thing that keeps them away.
vi.mock("@/lib/flags/ambient-v2", () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock("@/lib/flags/concept-v8", () => ({ CONCEPT_V8_ENABLED: true }));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  }),
}));

import { Composer } from "@/components/app/home/composer";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const requested = () => vi.mocked(global.fetch).mock.calls.map(([input]) => String(input));

beforeEach(() => {
  cleanup();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  useBoardStore.setState({ activeThreadId: null });
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    // Answered as a signed-in creator's would be, so a request for it could only be ours.
    if (url.startsWith("/api/earn")) return json({ link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: null, joined: 0, whop: null });
    if (url.includes("/api/threads/open")) return json({ messages: [] });
    if (url.includes("/api/threads/list")) return json({ threads: [] });
    if (url.includes("/api/audiences")) return json({ audiences: [] });
    if (url.includes("/api/saved")) return json({ items: [] });
    return json({});
  }) as typeof fetch;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  vi.restoreAllMocks();
});

describe("flag off: no Money made on the start page", () => {
  it("draws no new-look Home, no row, and asks nothing of Earn", async () => {
    setActiveThreadCookie(NEW_THREAD_SENTINEL);
    renderWithClient(<Composer />);
    await waitFor(() => expect(requested().some((url) => url.includes("/api/threads/open"))).toBe(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(screen.queryByTestId("home-next")).toBeNull();
    expect(screen.queryByText("Money made")).toBeNull();
    expect(screen.queryByRole("link", { name: /^Money made/ })).toBeNull();
    expect(requested().filter((url) => url.includes("/api/earn"))).toEqual([]);
  });
});
