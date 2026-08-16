/**
 * Regression tests for /api/cron/delete-retained-videos — Phase 3 (260528-nsb) + Phase 4 (clip TTL).
 *
 * Video sweep coverage (Mode B fix, unchanged storage behaviour):
 * - After successful storage delete, UPDATE analysis_results SET video_storage_path = NULL
 * - Does NOT null when storage delete fails (preserves retry-ability)
 * - Logs error but returns 200 when null-update fails (storage delete succeeded)
 *
 * Clip sweep coverage (phase 4, owner ruling D2 2026-08-15):
 * - CLIP_TTL_DAYS is exported and equals 7
 * - Runs independently of the video sweep — an empty OR failed video sweep must not skip it
 * - Empties clip_uris only after a successful storage delete (retry-ability preserved)
 *
 * Response shape: { status, videos: {deleted, nulled, error?}, clips: {deleted, emptied, error?} }
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Mock dependencies BEFORE importing the route
// =====================================================

vi.mock("@/lib/cron-auth", () => ({
  verifyCronAuth: vi.fn(() => null), // null = auth passed
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  })),
}));

// =====================================================
// Supabase service client mock
// =====================================================

// Capture mutable references so individual tests can override per-test behavior.
const mockStorageRemove = vi.fn(); // alias kept for the video-bucket remove
const mockVideosRemove = mockStorageRemove;
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

const mockClipSelect = vi.fn();
const mockClipUpdate = vi.fn();
const mockClipsRemove = vi.fn();

const mockFromFactory = vi.fn((table: string) => {
  if (table === "analysis_results") {
    return {
      select: mockSelect,
      update: mockUpdate,
    };
  }
  if (table === "remix_blueprints") {
    return {
      select: mockClipSelect,
      update: mockClipUpdate,
    };
  }
  return {};
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFromFactory,
    storage: {
      from: vi.fn((bucket: string) => ({
        remove: bucket === "clips" ? mockClipsRemove : mockVideosRemove,
      })),
    },
  })),
}));

// =====================================================
// Import route AFTER mocks
// =====================================================

import { GET } from "../route";

// =====================================================
// Test helpers
// =====================================================

const makeRequest = (headers: Record<string, string> = {}): Request =>
  new Request("https://example.com/api/cron/delete-retained-videos", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET ?? "test-secret"}`,
      ...headers,
    },
  });

// Two expired rows with distinct ids and storage paths.
const expiredRows = [
  { id: "row-a", video_storage_path: "user-1/v1.mp4", user_id: "user-1", creator_profiles: { storage_retention_opted_in: false } },
  { id: "row-b", video_storage_path: "user-2/v2.mp4", user_id: "user-2", creator_profiles: { storage_retention_opted_in: false } },
];

// =====================================================
// Setup: build a full Supabase query chain mock
// The query is: supabase.from("analysis_results").select(...).lt(...).not(...).eq(...)
// We chain: select → lt → not → eq → resolves with data
// =====================================================

function buildSelectChain(resolveWith: { data: typeof expiredRows | null; error: null | { message: string } }) {
  const chain = {
    lt: vi.fn(),
    not: vi.fn(),
    eq: vi.fn(),
  };
  // Each method in the chain returns the next step and ultimately resolves.
  chain.eq.mockResolvedValue(resolveWith);
  chain.not.mockReturnValue(chain); // .not() → returns chain with .eq()
  chain.lt.mockReturnValue(chain);  // .lt() → returns chain with .not()
  return vi.fn().mockReturnValue(chain); // select() → returns chain with .lt()
}

// The clip-sweep query is: supabase.from("remix_blueprints").select(...).lt(...)
function buildClipSelectChain(resolveWith: {
  data: Array<{ id: string; clip_uris: unknown }> | null;
  error: null | { message: string };
}) {
  const chain = { lt: vi.fn().mockResolvedValue(resolveWith) };
  return vi.fn().mockReturnValue(chain);
}

// =====================================================
// Tests
// =====================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Clip sweep defaults: a normal night finds nothing to do.
  mockClipSelect.mockImplementation(buildClipSelectChain({ data: [], error: null }));
  mockClipsRemove.mockResolvedValue({ error: null });
  mockClipUpdate.mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
});

describe("GET /api/cron/delete-retained-videos — Mode B fix (video_storage_path null-out)", () => {
  it("nulls video_storage_path on analysis_results after successful storage delete", async () => {
    // Arrange
    mockSelect.mockImplementation(
      buildSelectChain({ data: expiredRows, error: null })
    );
    mockStorageRemove.mockResolvedValue({ data: null, error: null });
    const updateInSpy = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ in: updateInSpy });

    // Act
    const res = await GET(makeRequest());
    const body = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(body.status).toBe("completed");
    expect(body.videos.deleted).toBe(2);
    expect(body.videos.nulled).toBe(2);

    // The UPDATE must have been called with the two row ids.
    expect(mockUpdate).toHaveBeenCalledWith({ video_storage_path: null });
    expect(updateInSpy).toHaveBeenCalledWith("id", ["row-a", "row-b"]);
  });

  it("does NOT null video_storage_path when storage delete fails", async () => {
    // Arrange
    mockSelect.mockImplementation(
      buildSelectChain({ data: expiredRows, error: null })
    );
    mockStorageRemove.mockResolvedValue({ data: null, error: { message: "Storage error" } });
    const updateInSpy = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ in: updateInSpy });

    // Act
    const res = await GET(makeRequest());

    // Assert: 500 because storage delete failed
    expect(res.status).toBe(500);
    // UPDATE must NOT have been invoked
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("logs retention_null_failed but returns 200 when null-update fails (storage delete succeeded)", async () => {
    // Arrange
    mockSelect.mockImplementation(
      buildSelectChain({ data: expiredRows, error: null })
    );
    mockStorageRemove.mockResolvedValue({ data: null, error: null });
    // UPDATE fails
    const updateInSpy = vi.fn().mockResolvedValue({ error: { message: "DB write error" } });
    mockUpdate.mockReturnValue({ in: updateInSpy });

    const { createLogger } = await import("@/lib/logger");
    const logInstance = (createLogger as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;

    // Act
    const res = await GET(makeRequest());
    const body = await res.json();

    // Assert: storage deleted → response is 200 (not 500)
    expect(res.status).toBe(200);
    expect(body.status).toBe("completed");
    expect(body.videos.deleted).toBe(2);
    expect(body.videos.nulled).toBe(0); // null-update failed → 0 nulled

    // UPDATE was attempted
    expect(mockUpdate).toHaveBeenCalledWith({ video_storage_path: null });

    // Error was logged
    if (logInstance) {
      expect(logInstance.error).toHaveBeenCalledWith(
        "retention_null_failed",
        expect.objectContaining({ error: "DB write error" })
      );
    }
  });
});

describe("clip sweep (phase 4)", () => {
  it("CLIP_TTL_DAYS is 7 — the ruling's number, findable and asserted", async () => {
    const { CLIP_TTL_DAYS } = await import("../route");
    expect(CLIP_TTL_DAYS).toBe(7);
  });

  it("runs when the video sweep found NOTHING — the dead-code regression", async () => {
    mockSelect.mockImplementation(buildSelectChain({ data: [], error: null })); // no videos
    mockClipSelect.mockImplementation(
      buildClipSelectChain({
        data: [
          { id: "bp-1", clip_uris: ["bp-1/0.mp4", "bp-1/1.mp4"] },
          { id: "bp-2", clip_uris: [] }, // already swept — must be skipped
        ],
        error: null,
      }),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockClipsRemove).toHaveBeenCalledWith(["bp-1/0.mp4", "bp-1/1.mp4"]);
    expect(body.clips.deleted).toBe(2);
    expect(body.clips.emptied).toBe(1);
  });

  it("runs even when the video sweep FAILED, and the response is a 500 that reports both", async () => {
    mockSelect.mockImplementation(buildSelectChain({ data: null, error: { message: "pg down" } }));
    mockClipSelect.mockImplementation(
      buildClipSelectChain({ data: [{ id: "bp-1", clip_uris: ["bp-1/0.mp4"] }], error: null }),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.videos.error).toBeDefined();
    expect(mockClipsRemove).toHaveBeenCalledWith(["bp-1/0.mp4"]);
    expect(body.clips.deleted).toBe(1);
  });

  it("empties clip_uris only after a successful storage delete, and a failed empty still 200s", async () => {
    mockSelect.mockImplementation(buildSelectChain({ data: [], error: null }));
    mockClipSelect.mockImplementation(
      buildClipSelectChain({ data: [{ id: "bp-1", clip_uris: ["bp-1/0.mp4"] }], error: null }),
    );
    const inSpy = vi.fn().mockResolvedValue({ error: { message: "update failed" } });
    mockClipUpdate.mockReturnValue({ in: inSpy });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200); // storage delete succeeded; next run re-sweeps
    expect(inSpy).toHaveBeenCalledWith("id", ["bp-1"]);
    expect(body.clips.emptied).toBe(0);
  });

  it("a clip storage delete failure does NOT empty clip_uris (retry-ability preserved)", async () => {
    mockSelect.mockImplementation(buildSelectChain({ data: [], error: null }));
    mockClipSelect.mockImplementation(
      buildClipSelectChain({ data: [{ id: "bp-1", clip_uris: ["bp-1/0.mp4"] }], error: null }),
    );
    mockClipsRemove.mockResolvedValue({ error: { message: "storage down" } });

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(mockClipUpdate).not.toHaveBeenCalled();
  });
});
