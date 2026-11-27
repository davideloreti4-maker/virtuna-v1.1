/**
 * account-media.test.ts — a connected account's picture is stored as OUR rehosted URL, never the raw
 * CDN one, and a failure never throws. Storage and the table are I/O, stood in at the client; the
 * rehost helper and the repo write run for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { persistAccountAvatar } from "../account-media";

const RAW = "https://p16-sign-va.tiktokcdn.com/avatar.jpeg?x-expires=1";
const OURS = "https://proj.supabase.co/storage/v1/object/public/avatars/account/tiktok/nia.tests.jpg";
const ACCOUNT = { id: "a-1", platform: "tiktok", handle: "nia.tests" };

function makeClient(opts: { writeError?: string } = {}) {
  const writes: Array<{ table: string; values: Record<string, unknown>; id: unknown }> = [];
  const client = {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/avatars/${path}` } }),
      }),
    },
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (_col: string, id: unknown) => {
          writes.push({ table, values, id });
          return { error: opts.writeError ? { message: opts.writeError } : null };
        },
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, writes };
}

const image = () => ({ ok: true, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => new Uint8Array([1]).buffer }) as unknown as Response;

beforeEach(() => vi.restoreAllMocks());

describe("persistAccountAvatar", () => {
  it("rehosts, then stores our URL on the account row", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(image());
    const { client, writes } = makeClient();
    expect(await persistAccountAvatar(client, ACCOUNT, RAW)).toBe(OURS);
    expect(writes).toEqual([{ table: "connected_accounts", values: { avatar_url: OURS }, id: "a-1" }]);
  });

  it("a failed rehost writes nothing (any stored picture stays) and never the raw URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 403, headers: { get: () => null } } as unknown as Response);
    const { client, writes } = makeClient();
    expect(await persistAccountAvatar(client, ACCOUNT, RAW)).toBeNull();
    expect(writes).toEqual([]);
  });

  it("no source: nothing fetched, nothing written", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { client, writes } = makeClient();
    expect(await persistAccountAvatar(client, ACCOUNT, "")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("a write error (returned, not thrown, by supabase-js) gives null, not a throw", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(image());
    const { client } = makeClient({ writeError: "denied" });
    await expect(persistAccountAvatar(client, ACCOUNT, RAW)).resolves.toBeNull();
  });

  it("the row write can go through a different client than storage (the session client, RLS-scoped)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(image());
    const storage = makeClient();
    const db = makeClient();
    await persistAccountAvatar(storage.client, ACCOUNT, RAW, db.client);
    expect(storage.writes).toEqual([]);
    expect(db.writes).toHaveLength(1);
  });
});
