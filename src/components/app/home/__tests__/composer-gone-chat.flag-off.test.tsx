/** @vitest-environment happy-dom */
/**
 * Flag off, a load whose pointer names a chat the server cannot open (a deleted one) adopts the
 * chat the server answers with, exactly as before the new look's "That chat was deleted." Home.
 *
 * The real composer; stand-ins only for the network (`fetch`), the router and the storage client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));

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

import { Composer } from "../composer";
import { ACTIVE_THREAD_COOKIE, getActiveThreadCookie, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

const at = "2026-11-21T00:00:00.000Z";
/** The newest other chat, as the server answers a stale pointer. */
const OTHER = {
  threadId: "t1",
  messages: [
    { id: "u1", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "What should I film first?" } }], created_at: at },
    { id: "m1", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "Start with the mirror shot." } }], created_at: at },
  ],
  simSeals: {},
};

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const opens = () => vi.mocked(global.fetch).mock.calls.filter(([input]) => String(input).includes("/api/threads/open"));

beforeEach(() => {
  cleanup();
  useBoardStore.setState({ activeThreadId: null });
  useShellStore.setState({ threadBack: "/library" });
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/threads/open")) return json(OTHER);
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

describe("flag off: a pointer at a deleted chat", () => {
  it("adopts the chat the server answers with, as before: its id on the board, its messages, no message about a deletion", async () => {
    setActiveThreadCookie("gone-1");
    renderWithClient(<Composer />);
    await waitFor(() => expect(opens()).toHaveLength(1));
    await waitFor(() => expect(useBoardStore.getState().activeThreadId).toBe("t1"));
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    // The pointer and the shell's marker are left as they were.
    expect(getActiveThreadCookie()).toBe("gone-1");
    expect(useShellStore.getState().threadBack).toBe("/library");
    expect(screen.queryByText("That chat was deleted.")).toBeNull();
  });
});
