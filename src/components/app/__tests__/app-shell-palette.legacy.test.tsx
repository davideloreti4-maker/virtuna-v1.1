/** @vitest-environment happy-dom */
/**
 * The legacy shell (flag off) does not turn on the palette's exact-name ranking (plan 2026-11-24-you,
 * final fix round B5): its order is exactly today's, so a chat whose title holds "settings" is still
 * listed above Settings and Enter opens it. The real shell, palette, items and stores; stand-ins only
 * at the edges: `fetch` (the thread list and the sidebar's reads), the browser Supabase client (a
 * session) and the router. The flag is not set in this file: the production build as it is today.
 * The new shell's half: `src/components/shell/__tests__/next-shell-palette.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/stores/sidebar-store";

vi.setConfig({ testTimeout: 20_000 });
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

import { AppShell } from "../app-shell";

const THREADS = [
  { id: "0b6f3c1e-2a4d-4f7e-9c1a-5d8e7f6a3b21", title: "Settings for my ring light", updated_at: "2026-11-20T10:00:00Z", created_at: "2026-11-20T09:00:00Z", pinned_at: null },
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

describe("AppShell, flag off: the palette keeps today's order", () => {
  it('typing "Settings" lists the chat first, and Enter opens the chat', async () => {
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <TooltipProvider>
            <AppShell>
              <p>page content</p>
            </AppShell>
          </TooltipProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("page content");
    expect(screen.queryByRole("navigation", { name: "Places" })).toBeNull();
    await act(async () => useSidebarStore.getState().setCommandOpen(true));
    const search = await screen.findByPlaceholderText("Search threads…");
    fireEvent.change(search, { target: { value: "Settings" } });
    await screen.findByRole("option", { name: /Settings for my ring light/ });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getAllByRole("option")[0]).toHaveTextContent(/^Settings for my ring light/);
    expect(screen.getAllByRole("option")[1]).toHaveTextContent(/^Settings$/);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/home");
  });
});
