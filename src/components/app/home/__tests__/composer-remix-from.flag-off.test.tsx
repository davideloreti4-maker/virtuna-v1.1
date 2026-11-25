/** @vitest-environment happy-dom */
/**
 * Flag off, the composer takes no Remix hand-off: a remix left by Discover (which only the new look leaves)
 * is neither taken nor run. The real composer; stand-ins for the network, the router and the storage
 * client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, waitFor } from "@testing-library/react";
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
    storage: { from: () => ({ upload: vi.fn(), remove: async () => ({ error: null }) }) },
  }),
}));

import { Composer } from "../composer";
import { leaveRemixFrom, takeRemixFrom } from "@/lib/thread-next/remix-from";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from "@/lib/threads/active-thread-cookie";

const LINK = "https://www.tiktok.com/@nia.tests/video/7300000000000000001";
let calls: string[] = [];
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

beforeEach(() => {
  calls = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/api/threads/open")) return json({ messages: [] });
    if (url.includes("/api/audiences")) return json({ audiences: [] });
    return json({});
  }) as typeof fetch;
  document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
});

afterEach(() => {
  cleanup();
  takeRemixFrom();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  vi.restoreAllMocks();
});

describe("flag off: the Remix hand-off", () => {
  it("is neither taken nor run", async () => {
    leaveRemixFrom({ url: LINK, platform: "tiktok" });
    renderWithClient(<Composer />);
    await waitFor(() => expect(calls.some((url) => url.includes("/api/threads/open"))).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    expect(calls.filter((url) => url.includes("/api/tools/remix/run"))).toEqual([]);
    expect(takeRemixFrom()?.url).toBe(LINK);
  });
});
