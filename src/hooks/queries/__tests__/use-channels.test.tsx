// @vitest-environment happy-dom
/**
 * useAddChannel's refusals: an add is two calls (read the account, then follow it), and a refused one
 * says which call refused it (`step`) and with what HTTP status (`status`; none when the request never
 * got an answer), so a screen can tell a lapsed session from a handle that could not be read, and a
 * follow refused after a good read from either. The messages stay exactly as they were: the old
 * Channels screen shows them as they are. Stand-in: `fetch`. Made-up handles only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { useAddChannel } from "@/hooks/queries/use-channels";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const READ = { status: "scraped", handle: "jay.makes", profile: { handle: "jay.makes", displayName: "Jay", avatarUrl: "", followerCount: 9, videoCount: 2 }, videosUpserted: 2 };

let onRead: () => Promise<Response>;
let onFollow: () => Promise<Response>;

beforeEach(() => {
  onRead = async () => json(READ);
  onFollow = async () => json({ account: {} }, 201);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => (String(input) === "/api/channels/ingest" ? onRead() : onFollow())),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function hook() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useAddChannel(), { wrapper }).result;
}

/** The add's refusal, as thrown. */
async function refusal(): Promise<Error & { status?: number; step?: string }> {
  const result = hook();
  try {
    await result.current.mutateAsync("jay.makes");
  } catch (error) {
    return error as Error & { status?: number; step?: string };
  }
  throw new Error("the add was not refused");
}

describe("useAddChannel — a refused add says which call and which status, its message unchanged", () => {
  it("the account could not be read, with the route's own message", async () => {
    onRead = async () => json({ error: "channel_not_found", message: "That TikTok handle could not be found or scraped." }, 404);
    const error = await refusal();
    expect(error.message).toBe("That TikTok handle could not be found or scraped.");
    expect(error.step).toBe("read");
    expect(error.status).toBe(404);
  });

  it("the read refused with no message (a lapsed session)", async () => {
    onRead = async () => json({ error: "Unauthorized" }, 401);
    const error = await refusal();
    expect(error.message).toBe("Could not add this channel");
    expect(error.step).toBe("read");
    expect(error.status).toBe(401);
  });

  it("the read answered with no JSON (a gateway timeout)", async () => {
    onRead = async () => new Response("<html>timeout</html>", { status: 504 });
    const error = await refusal();
    expect(error.message).toBe("Could not add this channel");
    expect(error.step).toBe("read");
    expect(error.status).toBe(504);
  });

  it("the read never got an answer: its own error, the step, no status", async () => {
    onRead = async () => {
      throw new TypeError("Failed to fetch");
    };
    const error = await refusal();
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toBe("Failed to fetch");
    expect(error.step).toBe("read");
    expect(error.status).toBeUndefined();
  });

  it.each([500, 401])("the account was read, the follow refused (%i)", async (status) => {
    onFollow = async () => json({ error: "no" }, status);
    const error = await refusal();
    expect(error.message).toBe("Added the channel but couldn't track it");
    expect(error.step).toBe("follow");
    expect(error.status).toBe(status);
  });

  it("the follow never got an answer: its own error, the step, no status", async () => {
    onFollow = async () => {
      throw new TypeError("Failed to fetch");
    };
    const error = await refusal();
    expect(error.message).toBe("Failed to fetch");
    expect(error.step).toBe("follow");
    expect(error.status).toBeUndefined();
  });

  it("an add that goes through answers as before", async () => {
    const result = hook();
    await expect(result.current.mutateAsync("jay.makes")).resolves.toEqual(READ);
  });
});
