/** @vitest-environment happy-dom */
/**
 * The video's address: a stored path is signed by `GET /api/videos/sign`; a file that is gone
 * (404) is "missing". Only the network (`fetch`) is stood in for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { seedSignedVideo, useSignedVideo } from "../use-signed-video";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

describe("useSignedVideo", () => {
  it("no path: idle, and nothing is asked", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSignedVideo(null), { wrapper });
    expect(result.current).toEqual({ src: null, status: "idle" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a stored path: loading, then the signed address", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "https://videos.test/a.mp4?token=1" })));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSignedVideo("user-1/a b.mp4"), { wrapper });
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current).toEqual({ src: "https://videos.test/a.mp4?token=1", status: "ready" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/videos/sign?path=user-1%2Fa%20b.mp4");
  });

  it("a file that is gone: missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "video_missing" }), { status: 404 })));
    const { result } = renderHook(() => useSignedVideo("user-1/gone.mp4"), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ src: null, status: "missing" }));
  });

  it("an address that cannot be signed (server error): missing, after a retry", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSignedVideo("user-1/a.mp4"), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("missing"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a seeded address (the dev page) is used as is", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seedSignedVideo(client, "dev/video", "https://videos.test/local.mp4");
    const { result } = renderHook(() => useSignedVideo("dev/video"), { wrapper });
    expect(result.current).toEqual({ src: "https://videos.test/local.mp4", status: "ready" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
