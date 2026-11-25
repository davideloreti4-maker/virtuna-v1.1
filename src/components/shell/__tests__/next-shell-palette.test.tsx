/** @vitest-environment happy-dom */
/**
 * The new look's shell turns on the palette's exact-name ranking (plan 2026-11-24-you, final fix
 * round B5): with chats whose title holds "you", typing "You" and Enter opens You, not a chat. The
 * real shell, palette, items and stores; stand-ins only at the edges: `fetch` (the thread list and
 * the sidebar's reads), the browser Supabase client (a session), the router and the build-time flag.
 * The legacy shell keeps today's order: `app-shell-palette.legacy.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/stores/sidebar-store";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ usePathname: () => "/library", useRouter: () => router }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "7d2e9a40-1c3b-4e5f-8a6b-9c0d1e2f3a4b" } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
  }),
}));

import { NextShell } from "../next-shell";

const THREADS = [
  { id: "0b6f3c1e-2a4d-4f7e-9c1a-5d8e7f6a3b21", title: "What you should post this week", updated_at: "2026-11-20T10:00:00Z", created_at: "2026-11-20T09:00:00Z", pinned_at: null },
  { id: "1c7a4d2f-3b5e-4a8f-8d2b-6e9f8a7b4c32", title: "Why you stall at 1K", updated_at: "2026-11-19T10:00:00Z", created_at: "2026-11-19T09:00:00Z", pinned_at: null },
];

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  router.push.mockReset();
  useSidebarStore.setState({ commandOpen: false });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input).split("?")[0];
      if (url === "/api/threads/list") return new Response(JSON.stringify({ threads: THREADS }), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  useSidebarStore.setState({ commandOpen: false });
});

describe("NextShell: the palette lists an exact name first", () => {
  it('typing "You" and Enter opens You, though chats whose title holds "you" are listed', async () => {
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <TooltipProvider>
            <NextShell>
              <p>page content</p>
            </NextShell>
          </TooltipProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("page content");
    await act(async () => useSidebarStore.getState().setCommandOpen(true));
    const search = await screen.findByPlaceholderText("Search threads…");
    fireEvent.change(search, { target: { value: "You" } });
    // The chats have loaded and match.
    await screen.findByRole("option", { name: /What you should post this week/ });
    expect(screen.getAllByRole("option")[0]).toHaveTextContent(/^You$/);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/you");
  });
});
