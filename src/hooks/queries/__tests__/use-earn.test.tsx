/** @vitest-environment happy-dom */
/**
 * use-earn (plan 2026-11-24-earn, steps A and B; ruling 21): `useEarn` reads `GET /api/earn` under its own
 * key, keeps it for five minutes, and asks once: no retry, no read on window focus, and a refused answer is
 * not asked again on every mount. `useEnrolWhop` sends `POST /api/earn/whop` and puts the answered page in
 * place. Real: the hooks and a real QueryClient. Stood in for: `fetch` and the clock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { EarnPage } from "@/lib/earn/earn";
import { EARN_STALE_MS, EnrolError, earnKeys, useEarn, useEnrolWhop } from "../use-earn";

const PAGE: EarnPage = { link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: "Nia Carter", joined: 2, whop: null };
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client = new QueryClient();
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useEarn", () => {
  it("reads GET /api/earn into its own key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PAGE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEarn(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("/api/earn");
    expect(client.getQueryData(earnKeys.page)).toEqual(PAGE);
    expect(earnKeys).toEqual({ all: ["earn"], page: ["earn", "page"] });
  });

  it("a refusal is an error at once: asked once, on a client with the library's defaults", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEarn(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is kept for five minutes: a page opened again inside them does not ask again, after them it does", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00.000Z"));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PAGE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(EARN_STALE_MS).toBe(5 * 60_000);

    const first = renderHook(() => useEarn(), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    vi.setSystemTime(new Date("2026-11-24T10:04:59.000Z"));
    const again = renderHook(() => useEarn(), { wrapper });
    expect(again.result.current.data).toEqual(PAGE);
    again.unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-11-24T10:05:01.000Z"));
    const later = renderHook(() => useEarn(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    later.unmount();
  });
});

describe("useEarn asks once (ruling 21)", () => {
  it("a refused answer (a funnel visitor's 404) is not asked again when another part mounts", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = renderHook(() => useEarn(), { wrapper });
    await waitFor(() => expect(first.result.current.isError).toBe(true));
    const second = renderHook(() => useEarn(), { wrapper });
    first.unmount();
    const third = renderHook(() => useEarn(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(second.result.current.isError).toBe(true);
    expect(third.result.current.isError).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is not read again when the window regains focus, even once it is old", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00.000Z"));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PAGE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEarn(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    vi.setSystemTime(new Date("2026-11-24T10:30:00.000Z"));
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    focusManager.setFocused(undefined);
  });
});

describe("useEnrolWhop (step B)", () => {
  const ENROLLED: EarnPage = { ...PAGE, whop: { canEnrol: true, knownAccount: false, username: "nia.cooks", earnedCents: 0 } };

  it("sends the username as JSON, and puts the answered page in place without reading it again", async () => {
    const fetchMock = vi.fn(async (url: string) => (url === "/api/earn/whop" ? new Response(JSON.stringify(ENROLLED), { status: 200 }) : new Response(JSON.stringify(PAGE), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const page = renderHook(() => useEarn(), { wrapper });
    await waitFor(() => expect(page.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useEnrolWhop(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("nia.cooks");
    });
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("/api/earn/whop");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "nia.cooks" }) });
    expect(client.getQueryData(earnKeys.page)).toEqual(ENROLLED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("without a username, the body is empty: enrol by the Whop account we know", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ENROLLED), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEnrolWhop(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body).toBe("{}");
  });

  it.each([
    [422, { error: "not_found" }, "not_found"],
    [400, { error: "invalid_username" }, "invalid_username"],
    [400, { error: "no_account" }, "no_account"],
    [503, { error: "not_available" }, "not_available"],
    [409, { error: "already_connected" }, "already_connected"],
    [429, { error: "failed" }, "failed"],
    [502, { error: "failed" }, "failed"],
    [500, { error: "Server error" }, "failed"],
    [429, { error: "Rate limit exceeded" }, "failed"],
  ])("a %i %j is the refusal %s, and the page stays as it was", async (status, body, refusal) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
    client.setQueryData(earnKeys.page, PAGE);
    const { result } = renderHook(() => useEnrolWhop(), { wrapper });
    let caught: unknown;
    await act(async () => {
      caught = await result.current.mutateAsync("nia.cooks").catch((e: unknown) => e);
    });
    expect(caught).toBeInstanceOf(EnrolError);
    expect((caught as EnrolError).refusal).toBe(refusal);
    expect(client.getQueryData(earnKeys.page)).toEqual(PAGE);
  });

  it("no answer at all is failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const { result } = renderHook(() => useEnrolWhop(), { wrapper });
    let caught: unknown;
    await act(async () => {
      caught = await result.current.mutateAsync("nia.cooks").catch((e: unknown) => e);
    });
    expect((caught as EnrolError).refusal).toBe("failed");
  });
});
