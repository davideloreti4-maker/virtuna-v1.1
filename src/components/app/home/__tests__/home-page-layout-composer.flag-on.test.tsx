/** @vitest-environment happy-dom */
/**
 * HomePageLayout with the real composer under the new look (final fix round, Part C). The layout
 * starts its own `rehydrating` as true when the browser points at a chat (`opensIntoThread`) and
 * relies on the composer's report to clear it; home-page-rail.flag-on.test.tsx stubs the composer,
 * so only here are the two run together.
 *
 * Stand-ins as in composer-home.flag-on.test.tsx: the network (`fetch`), the router, the storage
 * client, and matchMedia (the setup's no-op shim, so this is the phone).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
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

import { HomePageLayout } from "../home-page-layout";
import { clearActiveThreadCookie, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useShellStore } from "@/stores/shell-store";

// ── the network ──────────────────────────────────────────────────────────────
let calls: string[] = [];
/** What `/api/threads/open` answers: a body, or a 500. */
let open: { body: unknown } | "500" = { body: { messages: [] } };

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

function installFetch() {
  calls = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/api/threads/open")) {
      if (open === "500") return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
      return json(open.body);
    }
    if (url.includes("/api/threads/list")) return json({ threads: [] });
    if (url.includes("/api/audiences")) return json({ audiences: [] });
    if (url.includes("/api/tracked-accounts")) return json({ accounts: [] });
    if (url.includes("/api/saved")) return json({ items: [] });
    if (url.includes("/api/surfaces/drops")) return json({ drops: [] });
    return json({});
  }) as typeof fetch;
}

const GREETING = /^Good (morning|afternoon|evening)/;
const OPENING = "Opening thread…";

beforeEach(() => {
  cleanup();
  open = { body: { messages: [] } };
  useShellStore.setState({ threadOpen: false, fieldFocusSignal: 0 });
  installFetch();
  // A chat in the pointer: /home starts on that chat's load.
  setActiveThreadCookie("t1");
});

afterEach(() => {
  cleanup();
  clearActiveThreadCookie();
  vi.restoreAllMocks();
});

describe("HomePageLayout with the real composer: a reload into a chat the server does not have", () => {
  it("starts on the loading outline with the thread open, then the server finds no chat: Home, and no thread open", async () => {
    renderWithClient(<HomePageLayout />);
    // The first paint: the outline, and the shell told a thread is open (no tab bar).
    expect(screen.getByText(OPENING)).toBeInTheDocument();
    expect(useShellStore.getState().threadOpen).toBe(true);

    await waitFor(() => expect(calls.some((url) => url.includes("/api/threads/open"))).toBe(true));
    expect(await screen.findByRole("heading", { level: 1, name: GREETING })).toBeInTheDocument();
    expect(screen.getByTestId("home-next")).toBeInTheDocument();
    expect(screen.queryByText(OPENING)).toBeNull();
    expect(useShellStore.getState().threadOpen).toBe(false);
  });

  it("the same when the load fails (a 500): the screen does not stay on the loading outline", async () => {
    open = "500";
    renderWithClient(<HomePageLayout />);
    expect(screen.getByText(OPENING)).toBeInTheDocument();

    expect(await screen.findByRole("heading", { level: 1, name: GREETING })).toBeInTheDocument();
    expect(screen.getByTestId("home-next")).toBeInTheDocument();
    expect(screen.queryByText(OPENING)).toBeNull();
    expect(useShellStore.getState().threadOpen).toBe(false);
  });
});
