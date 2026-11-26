// @vitest-environment happy-dom
/**
 * useAddChannel's refusals: an add is two calls (read the account, then follow it), and a refused one
 * says which call refused it (`step`) and with what HTTP status (`status`; none when the request never
 * got an answer), so a screen can tell a lapsed session from a handle that could not be read, and a
 * follow refused after a good read from either. The messages stay exactly as they were: the old
 * Channels screen shows them as they are.
 *
 * useReadChannel reads a followed creator again without following: the add's first call alone, refused
 * as that call is. useChannelReadOut tells any page on the same client that such a read is still out.
 * Stand-in: `fetch`; the QueryClient is real. Made-up handles only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { useAddChannel, useChannelReadOut, useReadChannel } from "@/hooks/queries/use-channels";

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

// ─── Read again ──────────────────────────────────────────────────────────────

function clientAndWrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

function readHook() {
  return renderHook(() => useReadChannel(), { wrapper: clientAndWrapper().wrapper }).result;
}

/** The read's refusal, as thrown. */
async function readRefusal(): Promise<Error & { status?: number; step?: string }> {
  const result = readHook();
  try {
    await result.current.mutateAsync("jay.makes");
  } catch (error) {
    return error as Error & { status?: number; step?: string };
  }
  throw new Error("the read was not refused");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useReadChannel — the read alone, no follow", () => {
  it("useReadChannel sends the read alone: one POST /api/channels/ingest with the handle, no follow", async () => {
    const result = readHook();
    await result.current.mutateAsync("jay.makes");
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(1);
    const [input, init] = calls[0]!;
    expect(String(input)).toBe("/api/channels/ingest");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ handle: "jay.makes" });
  });

  it.each(["scraped", "cached"] as const)("answers the route's status: %s", async (status) => {
    onRead = async () => json({ ...READ, status });
    const result = readHook();
    await expect(result.current.mutateAsync("jay.makes")).resolves.toBe(status);
  });

  it("an answer whose body cannot be read counts as read now", async () => {
    onRead = async () => new Response("not json", { status: 200 });
    const result = readHook();
    await expect(result.current.mutateAsync("jay.makes")).resolves.toBe("scraped");
  });

  it('a refusal says step "read" and its status, with the route\'s message (404)', async () => {
    onRead = async () => json({ error: "channel_not_found", message: "That TikTok handle could not be found or scraped." }, 404);
    const error = await readRefusal();
    expect(error.message).toBe("That TikTok handle could not be found or scraped.");
    expect(error.step).toBe("read");
    expect(error.status).toBe(404);
  });

  it('a refusal with no message (a lapsed session, 401): "Could not read this channel"', async () => {
    onRead = async () => json({ error: "Unauthorized" }, 401);
    const error = await readRefusal();
    expect(error.message).toBe("Could not read this channel");
    expect(error.step).toBe("read");
    expect(error.status).toBe(401);
  });

  it("a refusal with no JSON (a gateway's HTML 504)", async () => {
    onRead = async () => new Response("<html>timeout</html>", { status: 504 });
    const error = await readRefusal();
    expect(error.message).toBe("Could not read this channel");
    expect(error.step).toBe("read");
    expect(error.status).toBe(504);
  });

  it('no answer: its own error, step "read", no status', async () => {
    onRead = async () => {
      throw new TypeError("Failed to fetch");
    };
    const error = await readRefusal();
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toBe("Failed to fetch");
    expect(error.step).toBe("read");
    expect(error.status).toBeUndefined();
  });
});

describe("useChannelReadOut — a read still out, seen from any hook on the client", () => {
  const outOf = (wrapper: ReturnType<typeof clientAndWrapper>["wrapper"]) =>
    renderHook(() => ({ jay: useChannelReadOut("jay.makes"), nia: useChannelReadOut("nia.cooks") }), { wrapper }).result;

  it.each([
    ["it is read", () => json(READ)],
    ["it is refused", () => json({ error: "no" }, 500)],
  ] as const)(
    "useChannelReadOut: true while a read of that handle is out, from another hook on the same client too; false for another handle and once it settles (%s)",
    async (_, answer) => {
      const held = deferred<Response>();
      onRead = () => held.promise;
      const { wrapper } = clientAndWrapper();
      const sender = renderHook(() => ({ read: useReadChannel(), jay: useChannelReadOut("jay.makes"), nia: useChannelReadOut("nia.cooks") }), {
        wrapper,
      }).result;
      expect(sender.current.jay).toBe(false);

      act(() => sender.current.read.mutate("jay.makes"));
      await waitFor(() => expect(sender.current.jay).toBe(true));
      expect(sender.current.nia).toBe(false);

      // A page opened after the read was sent.
      const later = outOf(wrapper);
      expect(later.current.jay).toBe(true);
      expect(later.current.nia).toBe(false);

      await act(async () => held.resolve(answer()));
      await waitFor(() => expect(later.current.jay).toBe(false));
      expect(sender.current.jay).toBe(false);
      expect(later.current.nia).toBe(false);
    },
  );
});
