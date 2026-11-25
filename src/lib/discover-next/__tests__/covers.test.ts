/**
 * A cover Maven stores, the only kind the Watchlist draws: the ingest rehosts covers and avatars
 * into public Supabase Storage (`src/lib/channels/ingest.ts`, `src/lib/scraping/rehost-cover.ts`).
 * A signed platform address expires and 403s, so it is never drawn. The check is by the host's
 * suffix and the path, not against this project's own URL.
 */
import { describe, expect, it } from "vitest";

import { isStoredCover } from "../covers";

describe("isStoredCover", () => {
  it("takes an https address on any .supabase.co host whose path is a public Storage object, any bucket", () => {
    expect(isStoredCover("https://proj.supabase.co/storage/v1/object/public/covers/tiktok/7.jpg")).toBe(true);
    expect(isStoredCover("https://proj.supabase.co/storage/v1/object/public/avatars/competitor/jay.makes.jpg")).toBe(
      true,
    );
    expect(isStoredCover("https://other-proj.supabase.co/storage/v1/object/public/any-bucket/a.jpg")).toBe(true);
  });

  it("reads the host whatever its case", () => {
    expect(isStoredCover("https://PROJ.Supabase.CO/storage/v1/object/public/covers/a.jpg")).toBe(true);
  });

  it("refuses an address that is not https", () => {
    expect(isStoredCover("http://proj.supabase.co/storage/v1/object/public/covers/a.jpg")).toBe(false);
  });

  it("refuses a host that only looks like the project's", () => {
    expect(isStoredCover("https://proj.supabase.co.example.com/storage/v1/object/public/covers/a.jpg")).toBe(false);
    expect(isStoredCover("https://evilsupabase.co/storage/v1/object/public/covers/a.jpg")).toBe(false);
    expect(isStoredCover("https://supabase.co/storage/v1/object/public/covers/a.jpg")).toBe(false);
  });

  it("refuses a Storage address that is not public (signed, or a transform)", () => {
    expect(isStoredCover("https://proj.supabase.co/storage/v1/object/sign/covers/a.jpg?token=x")).toBe(false);
    expect(isStoredCover("https://proj.supabase.co/storage/v1/render/image/public/covers/a.jpg")).toBe(false);
    expect(isStoredCover("https://proj.supabase.co/covers/a.jpg")).toBe(false);
  });

  it("refuses a platform's own cover", () => {
    expect(isStoredCover("https://p16-sign.tiktokcdn.example/a.jpeg?x-expires=1")).toBe(false);
    expect(isStoredCover("https://i.ytimg.com/vi/x/hqdefault.jpg")).toBe(false);
  });

  it("refuses a broken address and nothing at all", () => {
    expect(isStoredCover("not an address")).toBe(false);
    expect(isStoredCover("/storage/v1/object/public/covers/a.jpg")).toBe(false);
    expect(isStoredCover("")).toBe(false);
    expect(isStoredCover(null)).toBe(false);
    expect(isStoredCover(undefined)).toBe(false);
  });
});
