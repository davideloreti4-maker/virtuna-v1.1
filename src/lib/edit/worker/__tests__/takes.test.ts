import { describe, expect, it, vi } from "vitest";
import { AssetSchema, MAX_FRAMES, applyOps, checkEdit, layout, msOf, runWords, type Edit } from "@/lib/edit";
import { MAX_TAKE_BYTES, UploadSchema, assetOf, copiesOf, firstEdit, refusedFiles, takeState } from "../takes";
import { BUCKET, OTHER, TAKE, WORDS, jobRow, keyOf, takeRow, uploadingTake } from "./rows";

describe("an upload asked for", () => {
  const ok = { name: "IMG_0001.MOV", bytes: 4_893_635, type: "video/quicktime" };

  it("is an MP4 or QuickTime video of at most 2 GB, named", () => {
    expect(UploadSchema.parse(ok)).toEqual(ok);
    expect(UploadSchema.parse({ ...ok, type: "video/mp4", bytes: MAX_TAKE_BYTES }).bytes).toBe(2 * 1024 ** 3);
  });

  it.each([
    ["a Matroska file", { type: "video/x-matroska" }, "a take is an MP4 or QuickTime video"],
    ["a WebM file", { type: "video/webm" }, "a take is an MP4 or QuickTime video"],
    ["an empty file", { bytes: 0 }, "a take is not empty"],
    ["a file over 2 GB", { bytes: MAX_TAKE_BYTES + 1 }, "a take is at most 2 GB"],
    ["a part of a byte", { bytes: 10.5 }, "a whole number of bytes"],
    ["no name", { name: "  " }, "a take has its file's name"],
  ])("refuses %s, saying why", (_, change, message) => {
    const result = UploadSchema.safeParse({ ...ok, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
  });

  it("refuses anything else in the body", () => {
    expect(UploadSchema.safeParse({ ...ok, path: "u/someone/else" }).success).toBe(false);
  });
});

describe("a take as a file of the edit (N5, X62)", () => {
  it("is the full copy with the facts the worker measured, and its words", () => {
    const asset = assetOf(takeRow(), BUCKET);
    expect(asset).toEqual({
      id: TAKE, kind: "video", origin: "filmed", at: { bucket: BUCKET, path: keyOf("full.mp4") },
      ms: 12700, w: 720, h: 1280, sound: true, words: WORDS,
    });
    expect(AssetSchema.parse(asset)).toEqual(asset);
  });

  it("has no words when nothing was said", () => {
    expect(assetOf(takeRow({ words: [] }), BUCKET)).toMatchObject({ words: null });
  });

  it("is only a ready take", () => {
    expect(() => assetOf(uploadingTake(), BUCKET)).toThrow(`take ${TAKE} is uploading, not ready`);
  });

  it("fails loudly on facts that are not the worker's", () => {
    const take = takeRow({ facts: { ms: 12700, full: { w: 720 } } });
    expect(() => assetOf(take, BUCKET)).toThrow(`take ${TAKE}: its row does not hold a take's facts`);
  });

  it("names its copies' keys in the bucket", () => {
    expect(copiesOf(takeRow())).toEqual({ full: keyOf("full.mp4"), preview: keyOf("preview.mp4"), poster: keyOf("poster.jpg") });
  });
});

describe("a take's state", () => {
  it("comes from its latest job while it is analysing: a failed job fails it, with that job's message", () => {
    const take = takeRow({ status: "analysing", facts: null, words: null, analysis: null });
    expect(takeState(take, jobRow({ status: "failed", error: "take.mp4 is cut short" }))).toEqual({ status: "failed", error: "take.mp4 is cut short" });
    expect(takeState(take, jobRow({ status: "running" }))).toEqual({ status: "analysing", error: null });
    expect(takeState(take, null, Date.parse(take.updated_at) + 60_000)).toEqual({ status: "analysing", error: null }); // a minute after it was last touched: not yet stale
  });

  it("was never started when it has been analysing two minutes with no job at all (I2)", () => {
    const touched = Date.parse("2026-11-21T10:00:00.000Z");
    const take = takeRow({ status: "analysing", facts: null, words: null, analysis: null, updated_at: new Date(touched).toISOString() });
    expect(takeState(take, null, touched + 2 * 60_000 + 1)).toEqual({ status: "failed", error: "its analysis was never started" });
    expect(takeState(take, null, touched + 2 * 60_000 - 1000)).toEqual({ status: "analysing", error: null });
    expect(takeState(take, jobRow({ status: "queued" }), touched + 10 * 60_000)).toEqual({ status: "analysing", error: null }); // its job decides
  });

  it("stays ready when an analysis of it again fails (X71)", () => {
    expect(takeState(takeRow(), jobRow({ status: "failed", error: "the worker stopped" }))).toEqual({ status: "ready", error: null });
  });

  it("is failed when the take is longer than ten minutes (X56), measured by the worker", () => {
    const facts = (ms: number) => ({ ...(takeRow().facts as object), ms });
    expect(takeState(takeRow({ name: "IMG_0001.MOV", facts: facts(630_000) }), null)).toEqual({ status: "failed", error: "IMG_0001.MOV is 10.5 minutes long; a take is at most 10 minutes" });
    expect(takeState(takeRow({ facts: facts(600_000) }), null)).toEqual({ status: "ready", error: null });
  });

  it("is what the row says otherwise", () => {
    expect(takeState(uploadingTake(), null)).toEqual({ status: "uploading", error: null });
    expect(takeState(takeRow({ status: "failed", facts: null, error: "take.mp4 did not arrive whole" }), null)).toEqual({ status: "failed", error: "take.mp4 did not arrive whole" });
  });
});

describe("the first edit of a take", () => {
  it("is the whole take with its own captions and the natural look, built through the door", () => {
    const asset = assetOf(takeRow(), BUCKET);
    const edit = firstEdit(asset);
    expect(edit.assets).toEqual([asset]);
    expect(edit.shots.map((shot) => [shot.asset, shot.startMs, shot.endMs])).toEqual([[TAKE, 0, 12700]]);
    expect(edit.captions.on).toBe(true);
    expect(edit.look).toEqual({ preset: "natural", adjust: expect.objectContaining({ exposure: 0, warmth: 0 }) });
    expect(edit.cover).toBeNull();
    expect(checkEdit(edit)).toEqual([]);
    expect(applyOps(edit, [{ op: "captions.set", on: true }])).toEqual({ ok: true, edit });
    expect(runWords(edit, layout(edit).runs[0]!).map((word) => word.text)).toEqual(WORDS.map((word) => word.text));
  });

  it("is the first three minutes of a longer take", () => {
    const asset = { ...assetOf(takeRow(), BUCKET), ms: 600_000 };
    expect(firstEdit(asset).shots[0]).toMatchObject({ startMs: 0, endMs: msOf(MAX_FRAMES, 1) });
  });
});

describe("the files of an edit asked to render", () => {
  const take = takeRow();
  const edit = (): Edit => firstEdit(assetOf(take, BUCKET));
  const withAsset = (change: object): Edit => {
    const asked = edit();
    asked.assets[0] = { ...asked.assets[0]!, ...change } as Edit["assets"][number];
    return asked;
  };

  it("are ready takes of this creator, as the worker measured them", () => {
    expect(refusedFiles(edit(), [take], BUCKET)).toEqual([]);
  });

  it("may have the words' text, hiding and stress changed, never their times", () => {
    const words = WORDS.map((word, i) => (i === 0 ? { ...word, text: "Hi,", hidden: true as const } : i === 1 ? { ...word, stress: true as const } : word));
    expect(refusedFiles(withAsset({ words }), [take], BUCKET)).toEqual([]);
    const moved = WORDS.map((word, i) => (i === 2 ? { ...word, startMs: 1450 } : word));
    expect(refusedFiles(withAsset({ words: moved }), [take], BUCKET)).toEqual([
      { path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not as its take was measured: its words are not the take's` },
    ]);
  });

  it("refuses a file that is no take of this creator's", () => {
    expect(refusedFiles(edit(), [], BUCKET)).toEqual([{ path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not one of your takes` }]);
  });

  it("refuses a take that is not ready, saying what it is", () => {
    expect(refusedFiles(edit(), [{ ...take, status: "analysing" }], BUCKET)).toEqual([
      { path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not ready: its take is analysing` },
    ]);
  });

  it.each([
    ["a length of its own", { ms: 13000 }, "its ms"],
    ["another size", { w: 1080 }, "its w"],
    ["sound it does not have", { sound: false }, "its sound"],
    ["its source instead of its full copy", { at: { bucket: BUCKET, path: keyOf("source") } }, "where it is kept"],
    ["another bucket", { at: { bucket: "a3-uploads", path: keyOf("full.mp4") } }, "where it is kept"],
    ["another creator's folder", { at: { bucket: BUCKET, path: keyOf("full.mp4", TAKE, OTHER) } }, "where it is kept"],
    ["another origin", { origin: "generated" }, "its origin"],
  ])("refuses a take given %s", (_, change, what) => {
    expect(refusedFiles(withAsset(change), [take], BUCKET)).toEqual([
      { path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not as its take was measured: ${what} is not the take's` },
    ]);
  });

  it("takes a kit file as it is", () => {
    const asked = edit();
    asked.assets.push({ id: "pop", kind: "audio", origin: "kit", at: { kit: "sounds/pop.wav" }, ms: 400 });
    expect(refusedFiles(asked, [take], BUCKET)).toEqual([]);
  });

  it("refuses a long analysis that is still going as analysing, not as never started: its jobs were not looked up (143)", () => {
    const analysing = { ...take, status: "analysing", updated_at: new Date(Date.now() - 3 * 60_000).toISOString() };
    expect(refusedFiles(edit(), [analysing], BUCKET)).toEqual([
      { path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not ready: its take is analysing` },
    ]);
  });

  it("refuses a take longer than ten minutes", () => {
    const long = { ...take, facts: { ...(take.facts as object), ms: 630_000 } };
    const asked = { ...assetOf(take, BUCKET), ms: 630_000 };
    expect(refusedFiles(firstEdit(asked), [long], BUCKET)).toEqual([
      { path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not ready: its take is failed (take.mp4 is 10.5 minutes long; a take is at most 10 minutes)` },
    ]);
  });
});

describe("the page's side of it", () => {
  it("pulls in nothing that reads the server's settings: neither jobs.ts nor r2.ts (143)", async () => {
    vi.resetModules();
    vi.doMock("../jobs", () => {
      throw new Error("jobs.ts was loaded");
    });
    vi.doMock("../r2", () => {
      throw new Error("r2.ts was loaded");
    });
    try {
      await expect(import("../takes")).resolves.toHaveProperty("firstEdit");
    } finally {
      vi.doUnmock("../jobs");
      vi.doUnmock("../r2");
      vi.resetModules();
    }
  });
});
