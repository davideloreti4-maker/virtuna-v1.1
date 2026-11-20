/**
 * GET /api/videos/sign — a playable address only for the caller's own video.
 *
 * The route signs with the service client, which the bucket's policies do not bind, so the
 * owner check in the route is the only one. Supabase (auth and storage) is the boundary that is
 * stood in for; the route and its path check are real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    storage: { from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) },
  })),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { GET } from "../route";

const sign = (path: string | null) =>
  GET(
    new NextRequest(
      `https://example.com/api/videos/sign${path == null ? "" : `?path=${encodeURIComponent(path)}`}`
    )
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/v" }, error: null });
});

describe("GET /api/videos/sign", () => {
  it("signs the caller's own video", async () => {
    const res = await sign("user-1/abc.mp4");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://signed.example/v" });
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("user-1/abc.mp4", 3600);
  });

  it("refuses another account's video", async () => {
    const res = await sign("user-2/theirs.mp4");

    expect(res.status).toBe(403);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["..", "user-1/../user-2/theirs.mp4"],
    ["an escaped ..", "user-1/%2e%2e/user-2/theirs.mp4"],
    ["a half-escaped ..", "user-1/.%2E/user-2/theirs.mp4"],
    ["a backslash", "user-1/..\\user-2/theirs.mp4"],
    ["a tab inside the dots", "user-1/.\t./user-2/theirs.mp4"],
  ])("refuses a path that leaves the caller's folder through %s", async (_name, path) => {
    const res = await sign(path);

    expect(res.status).toBe(403);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await sign("user-1/abc.mp4");

    expect(res.status).toBe(401);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("answers 400 without a path", async () => {
    expect((await sign(null)).status).toBe(400);
  });

  it("answers 404 when the file is gone", async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: "Object not found" } });

    const res = await sign("user-1/expired.mp4");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "video_missing" });
  });
});
