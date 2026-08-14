/**
 * storage-scrub-isolation.test.ts — the two remix frame keyspaces must not touch.
 *
 * ── The bug this exists to prevent ───────────────────────────────────────────────────────────
 * Beat frames are written FLAT at `<blueprintId>/<beatIndex>.jpg` and there are at most 8 of them
 * (`buildBlueprint` merges to `MAX_BEATS = 8`). Scrub frames are ~30, keyed `0..29`. Written into
 * the same flat prefix they would OVERWRITE beat frames 0–7, and `remix-beats.tsx` would render a
 * scrub frame where it means the frame for that beat. Nothing would throw, nothing would log, and
 * the sheet would look fine — just wrong.
 *
 * ── Why the fixture looks like this ──────────────────────────────────────────────────────────
 * The `list()` payload below is not invented. It is the shape a REAL Supabase bucket returned when
 * probed on 2026-08-14 with two flat JPEGs and a `scrub/` subfolder under one prefix:
 *
 *     name="0.jpg"   id=7fa1fae4-…
 *     name="3.jpg"   id=49c9bd3b-…
 *     name="scrub"   id=null          ← a subfolder, no extension
 *
 * That `id: null` entry with no `.jpg` suffix is the entire mechanism: `signAnalysisFrames`
 * filters on the extension, so the subfolder is invisible to it and beat frames keep their
 * original paths. Encoding a guessed shape here would have tested the guess.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const listMock = vi.fn();
const createSignedUrlsMock = vi.fn();
const uploadMock = vi.fn();
const createSignedUrlMock = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        list: listMock,
        createSignedUrls: createSignedUrlsMock,
        upload: uploadMock,
        createSignedUrl: createSignedUrlMock,
      }),
    },
  }),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import {
  signAnalysisFrames,
  signScrubFrames,
  uploadScrubFrame,
  SCRUB_PREFIX,
} from "../storage";

const BP = "hsMbmyjNq-_m";

/** The measured real-world payload: two flat JPEGs plus a subfolder entry. */
const MIXED_PREFIX = [
  { name: "0.jpg", id: "7fa1fae4-6ac6-4e54-b073-f8a163532a05" },
  { name: "3.jpg", id: "49c9bd3b-3c47-478a-a21f-d45d8f6d4507" },
  { name: SCRUB_PREFIX, id: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  createSignedUrlsMock.mockImplementation(async (paths: string[]) =>
    ({ data: paths.map((p) => ({ signedUrl: `https://signed/${p}` })) }),
  );
});

describe("beat frames are blind to the scrub subfolder", () => {
  it("returns ONLY the flat JPEGs, keyed by beat index", async () => {
    listMock.mockResolvedValue({ data: MIXED_PREFIX, error: null });

    const frames = await signAnalysisFrames(BP);

    expect(Object.keys(frames).map(Number).sort((a, b) => a - b)).toEqual([0, 3]);
    expect(frames[0]).toBe(`https://signed/${BP}/0.jpg`);
    expect(frames[3]).toBe(`https://signed/${BP}/3.jpg`);
  });

  it("never signs a path inside the scrub subfolder", async () => {
    listMock.mockResolvedValue({ data: MIXED_PREFIX, error: null });

    await signAnalysisFrames(BP);

    const [paths] = createSignedUrlsMock.mock.calls[0]!;
    expect(paths).toEqual([`${BP}/0.jpg`, `${BP}/3.jpg`]);
    expect(paths.some((p: string) => p.includes(SCRUB_PREFIX))).toBe(false);
  });

  it("does not invent a beat frame from the subfolder entry", async () => {
    // `Number.parseInt("scrub")` is NaN, and the guard for that is what keeps a junk key out of
    // the map. Without it the sheet would carry a frame under key NaN — harmless-looking, and the
    // first step toward a real collision if the naming ever changes.
    listMock.mockResolvedValue({ data: [{ name: SCRUB_PREFIX, id: null }], error: null });

    expect(await signAnalysisFrames(BP)).toEqual({});
  });
});

describe("scrub frames live under their own prefix", () => {
  it("lists the scrub subfolder, not the blueprint root", async () => {
    listMock.mockResolvedValue({ data: [{ name: "0.jpg", id: "a" }, { name: "1.jpg", id: "b" }], error: null });

    const frames = await signScrubFrames(BP);

    expect(listMock).toHaveBeenCalledWith(`${BP}/${SCRUB_PREFIX}`, expect.anything());
    expect(frames[0]).toBe(`https://signed/${BP}/${SCRUB_PREFIX}/0.jpg`);
    expect(frames[1]).toBe(`https://signed/${BP}/${SCRUB_PREFIX}/1.jpg`);
  });

  it("writes to <id>/scrub/<i>.jpg", async () => {
    uploadMock.mockResolvedValue({ error: null });
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: "https://signed/x" }, error: null });

    await uploadScrubFrame(BP, 7, Buffer.from("jpeg"));

    expect(uploadMock).toHaveBeenCalledWith(
      `${BP}/${SCRUB_PREFIX}/7.jpg`,
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg" }),
    );
  });

  it("degrades to {} rather than throwing when the bucket errors", async () => {
    // The route serves the text sheet on an empty map. A throw would 500 a card that renders
    // perfectly well without any frames at all.
    listMock.mockResolvedValue({ data: null, error: { message: "bucket on fire" } });
    expect(await signScrubFrames(BP)).toEqual({});
  });

  it("returns null rather than throwing when the upload fails", async () => {
    uploadMock.mockResolvedValue({ error: { message: "quota" } });
    expect(await uploadScrubFrame(BP, 0, Buffer.from("jpeg"))).toBeNull();
  });
});
