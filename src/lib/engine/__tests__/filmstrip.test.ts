/**
 * Wave 0 stub — Phase 3 filmstrip extract / storage / queue (R2.6).
 *
 * All assertions are `it.skip` until Plan 07 implements:
 *   src/lib/engine/filmstrip/extract.ts
 *   src/lib/engine/filmstrip/storage.ts
 *   src/lib/engine/filmstrip/queue.ts
 *
 * Run `pnpm vitest run src/lib/engine/__tests__/filmstrip.test.ts` → exits 0 (all skipped).
 *
 * NOTE: vi.mock stubs below replace not-yet-existing modules at runtime so vitest
 * does not fail on missing files. Remove stubs when Plan 07 ships.
 */
import { describe, it, vi } from "vitest";

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

vi.mock("ffmpeg-static", () => ({ default: "/mock/ffmpeg" }));
vi.mock("child_process", () => ({ spawn: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

// =====================================================
// Test suites (Wave 0 stubs — all skipped)
// =====================================================

describe("extractFrameAtTimestamp (filmstrip/extract.ts)", () => {
  it.skip("spawns ffmpeg with -ss <t_start> -frames:v 1 -q:v 4 args", () => {
    // Plan 07: verify spawn called with correct ffmpeg flags including
    // -ss, -frames:v 1, -q:v 4 at the given timestamp.
  });

  it.skip("returns Buffer on exit code 0", () => {
    // Plan 07: mock spawn emitting exit(0) + stdout data → returns Buffer.
  });

  it.skip("returns null on non-zero exit", () => {
    // Plan 07: mock spawn emitting exit(1) → returns null without throwing.
  });

  it.skip("returns null on spawn error (never throws)", () => {
    // Plan 07: mock spawn emitting 'error' event → returns null, no exception.
  });
});

describe("uploadFrameAndGetSignedUrl (filmstrip/storage.ts)", () => {
  it.skip("uploads JPEG to filmstrips/<analysisId>/<segmentIdx>.jpg", () => {
    // Plan 07: verify createServiceClient().storage.from('filmstrips').upload
    // called with path `<analysisId>/<segmentIdx>.jpg` and the frame Buffer.
  });

  it.skip("calls createSignedUrl with 30-day TTL (2592000 seconds)", () => {
    // Plan 07: verify createSignedUrl called with expiresIn === 2592000.
  });

  it.skip("returns null on upload error (never throws)", () => {
    // Plan 07: mock upload returning error object → returns null.
  });

  it.skip("returns signed URL string on success", () => {
    // Plan 07: mock upload + createSignedUrl success → returns string URL.
  });
});

describe("triggerFilmstripGeneration (filmstrip/queue.ts)", () => {
  it.skip("fire-and-forget: returns void immediately (does not await fetch)", () => {
    // Plan 07: function returns before fetch resolves; caller is not blocked.
  });

  it.skip("logs error on fetch rejection but does not throw", () => {
    // Plan 07: mock fetch rejecting → logger.error called, no exception propagated.
  });

  it.skip("POSTs to /api/filmstrip/extract with analysisId + segments + videoUrl", () => {
    // Plan 07: verify fetch called with method:'POST', correct endpoint,
    // and body containing analysisId, segments, videoUrl.
  });
});
