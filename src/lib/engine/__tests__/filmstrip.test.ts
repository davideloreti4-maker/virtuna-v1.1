/**
 * Plan 07 — filmstrip extract / storage / queue unit tests (R2.6).
 *
 * All stubs from Wave 0 have been flipped to live tests (no it.skip remaining).
 *
 * Run: pnpm vitest run src/lib/engine/__tests__/filmstrip.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

// ----- shared logger mock -----
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// ----- module mocks (top-level, hoisted by vitest) -----
vi.mock("ffmpeg-static", () => ({ default: "/mock/ffmpeg" }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

// Hoist spawn mock ref so tests can set return values
const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));
vi.mock("child_process", () => ({ spawn: mockSpawn }));

// =====================================================
// Static imports (after mocks are declared)
// =====================================================

import { extractFrameAtTimestamp } from "@/lib/engine/filmstrip/extract";
import { uploadFrameAndGetSignedUrl } from "@/lib/engine/filmstrip/storage";
import { triggerFilmstripGeneration } from "@/lib/engine/filmstrip/queue";
import { createServiceClient } from "@/lib/supabase/service";

// =====================================================
// Helpers
// =====================================================

/** Creates a fake spawn result that emits data + close with given exit code. */
function makeSpawnEmitter(opts: {
  chunks?: Buffer[];
  exitCode?: number;
  spawnError?: Error;
}): EventEmitter & { stdout: EventEmitter } {
  const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter };
  proc.stdout = new EventEmitter();
  // Schedule async emission so Promise sets up listeners first
  setImmediate(() => {
    if (opts.spawnError) {
      proc.emit("error", opts.spawnError);
    } else {
      for (const chunk of opts.chunks ?? []) {
        proc.stdout.emit("data", chunk);
      }
      proc.emit("close", opts.exitCode ?? 0);
    }
  });
  return proc;
}

// =====================================================
// extractFrameAtTimestamp
// =====================================================

describe("extractFrameAtTimestamp (filmstrip/extract.ts)", () => {
  beforeEach(() => mockSpawn.mockReset());

  it("spawns ffmpeg with -ss <t_start> -frames:v 1 -q:v 4 args", async () => {
    mockSpawn.mockReturnValue(makeSpawnEmitter({ chunks: [Buffer.from("img")], exitCode: 0 }));

    await extractFrameAtTimestamp("https://example.com/video.mp4", 5.5);

    expect(mockSpawn).toHaveBeenCalledOnce();
    const [, args] = mockSpawn.mock.calls[0]!;
    const argArr = args as string[];
    expect(argArr).toContain("-ss");
    expect(argArr[argArr.indexOf("-ss") + 1]).toBe("5.5");
    expect(argArr).toContain("-frames:v");
    expect(argArr[argArr.indexOf("-frames:v") + 1]).toBe("1");
    expect(argArr).toContain("-q:v");
    expect(argArr[argArr.indexOf("-q:v") + 1]).toBe("4");
    expect(argArr).toContain("pipe:1");
  });

  it("returns Buffer on exit code 0", async () => {
    mockSpawn.mockReturnValue(
      makeSpawnEmitter({ chunks: [Buffer.from("jpeg-data")], exitCode: 0 }),
    );

    const result = await extractFrameAtTimestamp("https://example.com/video.mp4", 2);
    expect(result).toBeInstanceOf(Buffer);
    expect(result?.toString()).toBe("jpeg-data");
  });

  it("returns null on non-zero exit", async () => {
    mockSpawn.mockReturnValue(makeSpawnEmitter({ chunks: [], exitCode: 1 }));

    const result = await extractFrameAtTimestamp("https://example.com/video.mp4", 3);
    expect(result).toBeNull();
  });

  it("returns null on spawn error (never throws)", async () => {
    mockSpawn.mockReturnValue(makeSpawnEmitter({ spawnError: new Error("ENOENT") }));

    await expect(extractFrameAtTimestamp("https://example.com/video.mp4", 1)).resolves.toBeNull();
  });
});

// =====================================================
// uploadFrameAndGetSignedUrl
// =====================================================

describe("uploadFrameAndGetSignedUrl (filmstrip/storage.ts)", () => {
  beforeEach(() => vi.mocked(createServiceClient).mockReset());

  function makeStorageMock(opts: {
    uploadError?: { message: string };
    signedUrl?: string;
    urlError?: { message: string };
  }) {
    const inner = {
      upload: vi.fn().mockResolvedValue({ error: opts.uploadError ?? null }),
      createSignedUrl: vi.fn().mockResolvedValue(
        opts.urlError
          ? { data: null, error: opts.urlError }
          : { data: { signedUrl: opts.signedUrl ?? "https://signed.url/frame.jpg" }, error: null },
      ),
    };
    const storageMock = { from: vi.fn().mockReturnValue(inner) };
    return { storage: storageMock, inner };
  }

  it("uploads JPEG to filmstrips/<analysisId>/<segmentIdx>.jpg", async () => {
    const { storage, inner } = makeStorageMock({ signedUrl: "https://signed.url/frame.jpg" });
    vi.mocked(createServiceClient).mockReturnValue({ storage } as unknown as ReturnType<typeof createServiceClient>);

    await uploadFrameAndGetSignedUrl("analysis-uuid", 3, Buffer.from("jpeg"));

    expect(storage.from).toHaveBeenCalledWith("filmstrips");
    expect(inner.upload).toHaveBeenCalledWith(
      "analysis-uuid/3.jpg",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg", upsert: true }),
    );
  });

  it("calls createSignedUrl with 30-day TTL (2592000 seconds)", async () => {
    const { storage, inner } = makeStorageMock({ signedUrl: "https://signed.url/frame.jpg" });
    vi.mocked(createServiceClient).mockReturnValue({ storage } as unknown as ReturnType<typeof createServiceClient>);

    await uploadFrameAndGetSignedUrl("analysis-uuid", 0, Buffer.from("jpeg"));

    expect(inner.createSignedUrl).toHaveBeenCalledWith("analysis-uuid/0.jpg", 60 * 60 * 24 * 30);
  });

  it("returns null on upload error (never throws)", async () => {
    const { storage } = makeStorageMock({ uploadError: { message: "storage error" } });
    vi.mocked(createServiceClient).mockReturnValue({ storage } as unknown as ReturnType<typeof createServiceClient>);

    await expect(uploadFrameAndGetSignedUrl("analysis-uuid", 1, Buffer.from("jpeg"))).resolves.toBeNull();
  });

  it("returns signed URL string on success", async () => {
    const { storage } = makeStorageMock({ signedUrl: "https://example.supabase.co/storage/v1/signed/filmstrips/a/0.jpg?token=abc" });
    vi.mocked(createServiceClient).mockReturnValue({ storage } as unknown as ReturnType<typeof createServiceClient>);

    const result = await uploadFrameAndGetSignedUrl("analysis-uuid", 0, Buffer.from("jpeg"));
    expect(typeof result).toBe("string");
    expect(result).toContain("http");
  });
});

// =====================================================
// triggerFilmstripGeneration
// =====================================================

describe("triggerFilmstripGeneration (filmstrip/queue.ts)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.FILMSTRIP_EXTRACT_SECRET = "test-secret";
  });

  it("fire-and-forget: returns void immediately (does not await fetch)", async () => {
    let resolveGlobal!: () => void;
    const slowFetch = new Promise<Response>((res) => {
      resolveGlobal = () => res(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(slowFetch));

    const segments = [{ t_start: 0, t_end: 5, visual_event: "hook", audio_event: "music" }];

    const start = Date.now();
    const result = triggerFilmstripGeneration("analysis-id", segments, "https://video.url/v.mp4");
    const elapsed = Date.now() - start;

    expect(result).toBeUndefined();
    expect(elapsed).toBeLessThan(100);
    resolveGlobal();
  });

  it("logs error on fetch rejection but does not throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));

    await expect(async () => {
      triggerFilmstripGeneration("analysis-id", [], "https://video.url/v.mp4");
      await new Promise((r) => setTimeout(r, 10));
    }).not.toThrow();
  });

  it("POSTs to /api/filmstrip/extract with analysisId + segments + videoUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const segments = [{ t_start: 1.5, t_end: 6.5, visual_event: "body", audio_event: "voice" }];
    triggerFilmstripGeneration("my-analysis-id", segments, "https://cdn.example.com/video.mp4");

    await new Promise((r) => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/api/filmstrip/extract");
    expect(options?.method).toBe("POST");

    const body = JSON.parse(options?.body as string);
    expect(body.analysisId).toBe("my-analysis-id");
    expect(body.videoUrl).toBe("https://cdn.example.com/video.mp4");
    expect(body.segments).toEqual(segments);

    expect((options?.headers as Record<string, string>)?.Authorization).toContain("Bearer");
  });
});
