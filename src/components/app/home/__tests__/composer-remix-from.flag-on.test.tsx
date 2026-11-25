/** @vitest-environment happy-dom */
/**
 * "Remix this" from Discover lands on a new chat (new look): Discover leaves the video in module memory
 * (`leaveRemixFrom`) and opens a new chat (`newThreadAt("/home")`); Home's composer takes it once on that
 * blank chat and runs its own Remix on the link, as if the creator had picked Remix, given the link and
 * pressed send: the chat is made, the link is the creator's turn, ONE request goes to the remix route
 * with the composer's own platform, and the brief the creator wrote in Discover's sheet when there is one. Under React's StrictMode too (`next dev`), whose second run of the
 * mount effects must neither lose the taken request nor run it twice.
 *
 * Never from an address. Nothing left: nothing sent. A video of a platform the engine cannot read
 * (it fetches the source with the TikTok scraper): nothing sent.
 *
 * The real composer. Stand-ins only for what cannot run here: the network (`fetch`), the router, the
 * storage client, and the flags (on, as the dev server runs).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { StrictMode, type ReactElement } from "react";
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
    storage: { from: () => ({ upload: vi.fn(), remove: async () => ({ error: null }) }) },
  }),
}));

import { Composer } from "../composer";
import { leaveRemixFrom, takeRemixFrom } from "@/lib/thread-next/remix-from";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

const LINK = "https://www.tiktok.com/@nia.tests/video/7300000000000000001";
const REMIX_ROUTE = "/api/tools/remix/run";

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

type Call = { url: string; body: unknown };
let calls: Call[] = [];
/** What `/api/threads/open` answers: a blank new chat, or a chat. */
let openAnswer: unknown = { messages: [] };

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
/** The remix route's stream: it answers and closes. */
const closedStream = () =>
  ({ ok: true, status: 200, body: new ReadableStream<Uint8Array>({ start: (c) => c.close() }), json: async () => ({}) }) as unknown as Response;

beforeEach(() => {
  calls = [];
  openAnswer = { messages: [] };
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    if (url.includes(REMIX_ROUTE)) return closedStream();
    if (url.includes("/api/threads/open")) return json(openAnswer);
    if (url.includes("/api/threads/new")) return json({ threadId: "t-new" });
    if (url.includes("/api/threads/library")) return json({ chats: [], next: null });
    if (url.includes("/api/threads/list")) return json({ threads: [] });
    if (url.includes("/api/audiences")) return json({ audiences: [OWN_AUDIENCE], lastAudienceId: OWN_AUDIENCE.id });
    return json({});
  }) as typeof fetch;
  useShellStore.setState({ fieldFocusSignal: 0, threadBack: null, threadTitleHint: null, libraryScroll: null });
  // "Remix this" (`newThreadAt("/home")`) before Home mounts: a new chat, no chat active, the board switched.
  useShellStore.getState().setThreadBack(null);
  document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
  useBoardStore.getState().setActiveThreadId(null);
  useBoardStore.getState().switchThread();
  window.history.replaceState({}, "", "/home");
});

afterEach(() => {
  cleanup();
  takeRemixFrom(); // nothing left by one test reaches the next
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  window.history.replaceState({}, "", "/home");
  vi.restoreAllMocks();
});

const settle = (ms = 80) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const remixRequests = () => calls.filter((c) => c.url.includes(REMIX_ROUTE));

async function land(ui: ReactElement) {
  renderWithClient(ui);
  await screen.findByTestId("thread-field");
  await waitFor(() => expect(calls.some((c) => c.url.includes("/api/threads/open"))).toBe(true));
  await settle();
}

describe("a remix left by Discover, on a blank new chat", () => {
  it.each([
    ["a production build", false],
    ["the dev server (React's StrictMode: mount effects run twice)", true],
  ] as const)("%s: the chat is made, the link is the creator's turn, ONE remix request with the link and the composer's platform", async (_where, strict) => {
    leaveRemixFrom({ url: LINK, platform: "tiktok", brief: "for my bakery" });
    await land(strict ? <StrictMode><Composer /></StrictMode> : <Composer />);
    await waitFor(() => expect(remixRequests()).toHaveLength(1));
    await settle(150);

    expect(remixRequests()).toHaveLength(1);
    const body = remixRequests()[0]!.body as Record<string, unknown>;
    // The brief the creator wrote in Discover's sheet reaches the request.
    expect(body).toMatchObject({ url: LINK, platform: "tiktok", brief: "for my bakery" });
    // A new chat is made for it, and the link is persisted as the creator's turn.
    expect(calls.filter((c) => c.url.includes("/api/threads/new"))).toHaveLength(1);
    expect(calls.filter((c) => c.url.includes("/api/threads/user-turn")).map((c) => c.body)).toEqual([{ text: LINK }]);
    // Taken: nothing is left for another chat.
    expect(takeRemixFrom()).toBeNull();
  });

  it("a remix left with no brief: the request has no brief key (as a remix sent from Home)", async () => {
    leaveRemixFrom({ url: LINK, platform: "tiktok", brief: "   " });
    await land(<Composer />);
    await waitFor(() => expect(remixRequests()).toHaveLength(1));
    const body = remixRequests()[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ url: LINK, platform: "tiktok" });
    expect(body).not.toHaveProperty("brief");
  });

  it("nothing left: nothing sent", async () => {
    await land(<Composer />);
    await settle(150);
    expect(remixRequests()).toEqual([]);
  });

  it.each([
    ["a remix address", `/home?remix=${encodeURIComponent(LINK)}`],
    ["a launch address with the link", `/home?v=Remix&seed=${encodeURIComponent(LINK)}`],
  ])("an address alone (%s) sends nothing", async (_case, address) => {
    window.history.replaceState({}, "", address);
    await land(<Composer />);
    await settle(150);
    expect(remixRequests()).toEqual([]);
  });

  it("a video of a platform the engine cannot read (an Instagram link): taken, nothing sent", async () => {
    leaveRemixFrom({ url: "https://www.instagram.com/reel/abc/", platform: "instagram" });
    await land(<Composer />);
    await settle(150);
    expect(remixRequests()).toEqual([]);
    expect(takeRemixFrom()).toBeNull();
  });

  it("not a blank new chat (the pointer is a chat): nothing taken, nothing sent", async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=t1; path=/`;
    openAnswer = { threadId: "t1", messages: [], simSeals: {} };
    leaveRemixFrom({ url: LINK, platform: "tiktok" });
    await land(<Composer />);
    await settle(150);
    expect(remixRequests()).toEqual([]);
    expect(takeRemixFrom()?.url).toBe(LINK);
  });
});
