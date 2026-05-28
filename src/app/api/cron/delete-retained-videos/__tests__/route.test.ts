/**
 * Regression tests for /api/cron/delete-retained-videos — Phase 3 (260528-nsb).
 *
 * Coverage (Mode B fix):
 * - After successful storage delete, UPDATE analysis_results SET video_storage_path = NULL
 * - Does NOT null when storage delete fails (preserves retry-ability)
 * - Logs error but returns 200 when null-update fails (storage delete succeeded)
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
const mockStorageRemove = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

const mockFromFactory = vi.fn((table: string) => {
  if (table === "analysis_results") {
    return {
      select: mockSelect,
      update: mockUpdate,
    };
  }
  return {};
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFromFactory,
    storage: {
      from: vi.fn(() => ({ remove: mockStorageRemove })),
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

// =====================================================
// Tests
// =====================================================

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(body.deleted).toBe(2);
    expect(body.nulled).toBe(2);

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
    expect(body.deleted).toBe(2);
    expect(body.nulled).toBe(0); // null-update failed → 0 nulled

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
