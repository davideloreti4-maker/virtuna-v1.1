/**
 * clip-storage.test.ts — the clips bucket writer/signer (phase 4).
 *
 * What can silently do the WRONG thing here:
 *   - signClips listing the bucket instead of signing the given paths (a second round-trip to
 *     rediscover something the row already carries — spec §2.6's one deviation)
 *   - a signed URL leaking back as the "stored" value (dead link on day 8, live credential in a row)
 *   - a junk path crashing the map instead of being skipped
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpload = vi.fn();
const mockCreateSignedUrls = vi.fn();
const mockList = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  createSignedUrls: mockCreateSignedUrls,
  list: mockList,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ storage: { from: mockStorageFrom } })),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { uploadClip, signClips, CLIPS_BUCKET } from "../clip-storage";

const BP = "abc123def456";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  mockCreateSignedUrls.mockResolvedValue({
    data: [{ signedUrl: "https://signed/0.mp4" }],
    error: null,
  });
});

describe("uploadClip", () => {
  it("uploads to clips/<blueprintId>/<beatIndex>.mp4 and returns the PATH, never a URL", async () => {
    const path = await uploadClip(BP, 3, Buffer.from("mp4"));
    expect(mockStorageFrom).toHaveBeenCalledWith(CLIPS_BUCKET);
    expect(mockUpload).toHaveBeenCalledWith(
      `${BP}/3.mp4`,
      expect.any(Buffer),
      { contentType: "video/mp4", upsert: true },
    );
    expect(path).toBe(`${BP}/3.mp4`);
  });

  it("returns null on an upload error — never throws", async () => {
    mockUpload.mockResolvedValue({ error: { message: "quota" } });
    await expect(uploadClip(BP, 0, Buffer.from("x"))).resolves.toBeNull();
  });
});

describe("signClips", () => {
  it("signs EXACTLY the given paths — no bucket listing", async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [{ signedUrl: "https://signed/0.mp4" }, { signedUrl: "https://signed/5.mp4" }],
      error: null,
    });
    const clips = await signClips([`${BP}/0.mp4`, `${BP}/5.mp4`]);
    expect(mockList).not.toHaveBeenCalled();
    expect(mockCreateSignedUrls).toHaveBeenCalledWith([`${BP}/0.mp4`, `${BP}/5.mp4`], 3600);
    // Keys are the BEAT indexes parsed from the filename — 0 and 5, not 0 and 1.
    expect(Object.keys(clips).map(Number).sort((a, b) => a - b)).toEqual([0, 5]);
    expect(clips[5]).toBe("https://signed/5.mp4");
  });

  it("returns {} for an empty or non-array input (a pre-lane row's jsonb)", async () => {
    await expect(signClips([])).resolves.toEqual({});
    await expect(signClips(undefined as unknown as string[])).resolves.toEqual({});
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it("returns {} when signing throws — the sheet degrades to stills, never 500s", async () => {
    mockCreateSignedUrls.mockRejectedValue(new Error("storage down"));
    await expect(signClips([`${BP}/0.mp4`])).resolves.toEqual({});
  });

  it("skips a junk path instead of producing a NaN key", async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [{ signedUrl: "https://signed/x" }, { signedUrl: "https://signed/1.mp4" }],
      error: null,
    });
    const clips = await signClips([`${BP}/not-a-number.mp4`, `${BP}/1.mp4`]);
    expect(Object.keys(clips)).toEqual(["1"]);
  });
});
