/** @vitest-environment happy-dom */
/**
 * A launch address picks its skill on a blank new chat (new look): `/home?v=Test` (Audience's "Simulate a
 * video for them", through `newThreadAt`) lands with Simulate picked exactly as a tap on Home's Simulate
 * card leaves it: the field names it with its price and asks for a video or a link.
 *
 * Under React's StrictMode too, which `next dev` runs (mount effects run twice there), and through Home's
 * whole layout. Each case first takes `newThreadAt`'s own steps (the new-chat pointer, no chat, the board
 * switched), with an audience of the creator's own as the one new chats use.
 *
 * The real composer and Home. Stand-ins only for what cannot run here: the network (`fetch`), the router,
 * the storage client, and the flags (on, as the dev server runs). The open chat is a blank new chat: the
 * active-chat cookie holds the sentinel and `/api/threads/open` answers no messages.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { StrictMode, type ReactElement } from "react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("@/lib/flags/ambient-v2", () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock("@/lib/flags/concept-v8", () => ({ CONCEPT_V8_ENABLED: true }));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    storage: { from: () => ({ upload: vi.fn(), remove: async () => ({ error: null }) }) },
  }),
}));

import { Composer } from "../composer";
import { HomePageLayout } from "../home-page-layout";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

const OWN_AUDIENCE = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "@nia.tests",
  mode: "socials",
  is_general: false,
  is_preset: false,
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  personas: [],
  source_account_id: "acct-nia",
};
let calls: string[] = [];
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

beforeEach(() => {
  calls = [];
  replace.mockReset();
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/api/threads/open")) return json({ messages: [] });
    if (url.includes("/api/threads/library")) return json({ chats: [], next: null });
    if (url.includes("/api/threads/list")) return json({ threads: [] });
    // The creator has an audience of their own, the one new chats use (the field names it).
    if (url.includes("/api/audiences")) return json({ audiences: [OWN_AUDIENCE], lastAudienceId: OWN_AUDIENCE.id });
    return json({});
  }) as typeof fetch;
  useShellStore.setState({ fieldFocusSignal: 0, threadBack: null, threadTitleHint: null, libraryScroll: null });
  useBoardStore.setState({ activeThreadId: null });
  // Audience's main button (`newThreadAt`) before Home mounts: the new-chat pointer, no chat, the board
  // switched; then a new chat at the launch address.
  useShellStore.getState().setThreadBack(null);
  document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
  useBoardStore.getState().setActiveThreadId(null);
  useBoardStore.getState().switchThread();
  window.history.replaceState({}, "", "/home?v=Test");
});

afterEach(() => {
  cleanup();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  window.history.replaceState({}, "", "/home");
  vi.restoreAllMocks();
});

const field = () => screen.getByTestId("thread-field");
/** What the field shows picked: its pressed button (Home's field is the thread's, spec 2026-11-25 §2.4). */
const picked = () => field().querySelector<HTMLElement>('[aria-pressed="true"]');
const settle = (ms = 50) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

/** Home, once its open-chat load has answered (the load that, answered, resets an unpicked skill). */
async function land(ui: ReactElement) {
  renderWithClient(ui);
  await screen.findByTestId("thread-field");
  await waitFor(() => expect(calls.some((url) => url.includes("/api/threads/open"))).toBe(true));
  await settle();
}

describe("a launch to /home?v=Test on a blank new chat", () => {
  it.each([
    ["the composer, a production build", false, false],
    ["the composer, the dev server (React's StrictMode: mount effects run twice)", true, false],
    ["Home's whole layout, a production build", false, true],
    ["Home's whole layout, the dev server", true, true],
  ] as const)("%s: Simulate is picked as its card would pick it, and the address is consumed", async (_where, strict, layout) => {
    const home = layout ? <HomePageLayout /> : <Composer />;
    await land(strict ? <StrictMode>{home}</StrictMode> : home);
    expect(picked()).toBe(within(field()).getByRole("button", { name: "Simulate" }));
    expect(picked()?.textContent).toBe("Simulate · 10");
    expect((within(field()).getByRole("textbox") as HTMLTextAreaElement).placeholder).toBe("Add a video or paste a link");
    expect(replace).toHaveBeenCalledWith("/home", { scroll: false });
    // A pick spends nothing: no run, no chat made.
    expect(calls.filter((url) => ["/api/tools/", "/api/analyze", "/api/threads/new"].some((path) => url.includes(path)))).toEqual([]);
  });
});
