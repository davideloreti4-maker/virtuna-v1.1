/**
 * rehost-cover.test.ts — durability + SSRF guard for the scraped-image rehost helpers.
 *
 * These helpers fetch an arbitrary scraped URL server-side and re-upload the bytes, so the SSRF
 * allowlist (HTTPS + TikTok CDN host suffixes only) is a security boundary — these tests pin it so a
 * refactor can't silently widen it. They also assert the total-degrade contract (any failure → null,
 * caller keeps its fallback) and idempotency (our own bucket URL is returned without re-fetching).
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rehostCover,
  rehostCovers,
  rehostAvatar,
  COVERS_BUCKET,
  AVATARS_BUCKET,
} from "../rehost-cover";

/** Minimal SupabaseClient stub recording uploads; getPublicUrl echoes a real public-URL shape. */
function makeService(opts: { uploadError?: string } = {}) {
  const uploads: Array<{ bucket: string; path: string }> = [];
  const service = {
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string) {
            uploads.push({ bucket, path });
            return { error: opts.uploadError ? { message: opts.uploadError } : null };
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}`,
              },
            };
          },
        };
      },
    },
  };
  return { service: service as unknown as SupabaseClient, uploads };
}

/** A fetch Response stub for an image body. */
function imageResponse(type = "image/jpeg", bytes = new Uint8Array([1, 2, 3, 4])) {
  return {
    ok: true,
    headers: { get: () => type },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

const ALLOWED = "https://p19-common-sign.tiktokcdn-us.com/avatar~720.jpeg?x-expires=123";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("rehostCover — SSRF allowlist", () => {
  it("rejects a non-CDN host without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { service, uploads } = makeService();
    const out = await rehostCover(service, "https://evil.example.com/x.jpg", "tiktok/1");
    expect(out).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(uploads).toHaveLength(0);
  });

  it("rejects a non-HTTPS URL even on an allowlisted host", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { service } = makeService();
    const out = await rehostCover(service, "http://p19.tiktokcdn-us.com/x.jpg", "tiktok/1");
    expect(out).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  /**
   * TikTok serves the SAME asset from per-region image CDNs and which one you get depends on where
   * the request lands. The allowlist enumerated `-us` only, so the 2026-07-24 corpus backfill
   * failed EVERY row: oEmbed returned `p16-common-sign.tiktokcdn-eu.com` and the guard rejected
   * TikTok's own CDN. Regional hosts must pass; the lookalike/suffix attacks below must not.
   */
  it.each([
    "https://p16-common-sign.tiktokcdn-eu.com/tos-maliva/x~tplv-origin.image?x-expires=1",
    "https://p16-common-sign.tiktokcdn-us.com/tos-maliva/x.jpeg",
    "https://p16.tiktokcdn.com/tos/x.jpeg",
  ])("accepts the regional TikTok image CDN: %s", async (url) => {
    const { service, uploads } = makeService();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    const out = await rehostCover(service, url, "corpus/tiktok/1");
    expect(out).toContain("/covers/corpus/tiktok/1.jpg");
    expect(uploads).toHaveLength(1);
  });

  it("still rejects a host that merely CONTAINS the cdn name (nottiktokcdn.com)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { service } = makeService();
    const out = await rehostCover(service, "https://nottiktokcdn.com/x.jpg", "tiktok/1");
    expect(out).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a lookalike suffix (tiktokcdn-us.com.evil.com)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { service } = makeService();
    const out = await rehostCover(service, "https://tiktokcdn-us.com.evil.com/x.jpg", "tiktok/1");
    expect(out).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null (not throw) on a malformed URL and on null input", async () => {
    const { service } = makeService();
    expect(await rehostCover(service, "not a url", "tiktok/1")).toBeNull();
    expect(await rehostCover(service, null, "tiktok/1")).toBeNull();
    expect(await rehostCover(service, undefined, "tiktok/1")).toBeNull();
  });
});

describe("rehostCover — happy path + failures", () => {
  it("fetches, uploads to the covers bucket under the key, returns the public URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse("image/jpeg"));
    const { service, uploads } = makeService();
    const out = await rehostCover(service, ALLOWED, "tiktok/7561565651748343070");
    expect(uploads).toEqual([
      { bucket: COVERS_BUCKET, path: "tiktok/7561565651748343070.jpg" },
    ]);
    expect(out).toBe(
      `https://proj.supabase.co/storage/v1/object/public/${COVERS_BUCKET}/tiktok/7561565651748343070.jpg`,
    );
  });

  it("maps content-type to the object extension (png/webp)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse("image/webp"));
    const { service, uploads } = makeService();
    await rehostCover(service, ALLOWED, "tiktok/9");
    expect(uploads[0]?.path).toBe("tiktok/9.webp");
  });

  it("is idempotent: an already-rehosted covers URL is returned without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { service, uploads } = makeService();
    const own = `https://proj.supabase.co/storage/v1/object/public/${COVERS_BUCKET}/tiktok/1.jpg`;
    expect(await rehostCover(service, own, "tiktok/1")).toBe(own);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(uploads).toHaveLength(0);
  });

  it("degrades to null on a non-OK fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => "image/jpeg" },
    } as unknown as Response);
    const { service } = makeService();
    expect(await rehostCover(service, ALLOWED, "tiktok/1")).toBeNull();
  });

  it("degrades to null on a non-image content-type", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse("text/html"));
    const { service } = makeService();
    expect(await rehostCover(service, ALLOWED, "tiktok/1")).toBeNull();
  });

  it("degrades to null when the storage upload errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse("image/jpeg"));
    const { service } = makeService({ uploadError: "quota exceeded" });
    expect(await rehostCover(service, ALLOWED, "tiktok/1")).toBeNull();
  });
});

describe("rehostCovers — batch", () => {
  it("preserves order and degrades entries independently", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse("image/jpeg"));
    const { service } = makeService();
    const out = await rehostCovers(service, [
      { sourceUrl: ALLOWED, key: "tiktok/a" },
      { sourceUrl: "https://evil.example.com/x.jpg", key: "tiktok/b" }, // rejected → null
      { sourceUrl: ALLOWED, key: "tiktok/c" },
    ]);
    expect(out).toEqual([
      `https://proj.supabase.co/storage/v1/object/public/${COVERS_BUCKET}/tiktok/a.jpg`,
      null,
      `https://proj.supabase.co/storage/v1/object/public/${COVERS_BUCKET}/tiktok/c.jpg`,
    ]);
  });
});

describe("rehostAvatar", () => {
  it("uploads to the avatars bucket under a competitor/<handle> key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse("image/jpeg"));
    const { service, uploads } = makeService();
    const out = await rehostAvatar(service, ALLOWED, "khaby.lame");
    expect(uploads).toEqual([
      { bucket: AVATARS_BUCKET, path: "competitor/khaby.lame.jpg" },
    ]);
    expect(out).toBe(
      `https://proj.supabase.co/storage/v1/object/public/${AVATARS_BUCKET}/competitor/khaby.lame.jpg`,
    );
  });

  it("is idempotent against an already-rehosted avatars URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { service } = makeService();
    const own = `https://proj.supabase.co/storage/v1/object/public/${AVATARS_BUCKET}/competitor/x.jpg`;
    expect(await rehostAvatar(service, own, "x")).toBe(own);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("applies the same SSRF allowlist as covers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { service } = makeService();
    expect(await rehostAvatar(service, "https://evil.example.com/a.jpg", "x")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
