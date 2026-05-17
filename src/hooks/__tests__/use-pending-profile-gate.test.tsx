/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/query-keys";
import type { CreatorProfileResponse } from "@/hooks/queries/use-creator-profile";

/**
 * PROFILE-14 — usePendingProfileGate covers the deferred-submit pattern that
 * intercepts the upload action for users without `profile_interview_seen_at`.
 *
 * Pitfall #1: loading window must be treated as intercept (safe default).
 * Failure mode: query error → fail OPEN (treat profile as seen, do not block).
 * resumeAfterModal: optimistically flips the cache to mark profile as seen so
 * a second submit in the same session does not re-trigger the modal.
 */

// Mock fetch — we'll set the response per-test via a controllable mock.
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
  };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

const FULL_NULL: CreatorProfileResponse = {
  profile_interview_seen_at: null,
  target_platforms: null,
  niche_primary: null,
  niche_sub: null,
  target_audience: null,
  primary_goal: null,
  creator_stage: null,
  content_style: null,
  cuts_per_second: null,
  reference_creators: null,
  past_wins: null,
  past_flops: null,
  posting_frequency: null,
  time_of_day_aware: null,
  pain_points: null,
};

describe("usePendingProfileGate — Pitfall #1 (loading window)", () => {
  it("treats isLoading as intercept (defer submit until profile loads)", async () => {
    // Pending fetch — never resolves during the test so isLoading stays true.
    fetchMock.mockReturnValue(new Promise(() => {}));
    const qc = makeQueryClient();
    const { usePendingProfileGate } = await import(
      "@/hooks/use-pending-profile-gate"
    );

    const { result } = renderHook(() => usePendingProfileGate(), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.isLoading).toBe(true);

    const proceed = vi.fn();
    let outcome: { intercepted: boolean } = { intercepted: false };
    act(() => {
      outcome = result.current.interceptOrProceed(proceed);
    });
    expect(outcome.intercepted).toBe(true);
    expect(proceed).not.toHaveBeenCalled();
  });
});

describe("usePendingProfileGate — shouldShowModal logic", () => {
  it("intercepts the submit when profile_interview_seen_at is null", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...FULL_NULL, profile_interview_seen_at: null }),
    });
    const qc = makeQueryClient();
    const { usePendingProfileGate } = await import(
      "@/hooks/use-pending-profile-gate"
    );

    const { result } = renderHook(() => usePendingProfileGate(), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.shouldShowModal).toBe(true);

    const proceed = vi.fn();
    let outcome: { intercepted: boolean } = { intercepted: false };
    act(() => {
      outcome = result.current.interceptOrProceed(proceed);
    });
    expect(outcome.intercepted).toBe(true);
    expect(proceed).not.toHaveBeenCalled();
  });

  it("proceeds without intercept when profile_interview_seen_at is non-null (profile seen)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...FULL_NULL,
        profile_interview_seen_at: "2026-05-17T20:00:00.000Z",
      }),
    });
    const qc = makeQueryClient();
    const { usePendingProfileGate } = await import(
      "@/hooks/use-pending-profile-gate"
    );

    const { result } = renderHook(() => usePendingProfileGate(), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.shouldShowModal).toBe(false);

    const proceed = vi.fn();
    let outcome: { intercepted: boolean } = { intercepted: false };
    act(() => {
      outcome = result.current.interceptOrProceed(proceed);
    });
    expect(outcome.intercepted).toBe(false);
    expect(proceed).toHaveBeenCalledTimes(1);
  });
});

describe("usePendingProfileGate — fail-open on query error", () => {
  it("treats an HTTP failure as profile-seen (do not hard-block uploads)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });
    const qc = makeQueryClient();
    const { usePendingProfileGate } = await import(
      "@/hooks/use-pending-profile-gate"
    );

    const { result } = renderHook(() => usePendingProfileGate(), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.shouldShowModal).toBe(false);

    const proceed = vi.fn();
    let outcome: { intercepted: boolean } = { intercepted: false };
    act(() => {
      outcome = result.current.interceptOrProceed(proceed);
    });
    expect(outcome.intercepted).toBe(false);
    expect(proceed).toHaveBeenCalledTimes(1);
  });
});

describe("usePendingProfileGate — resumeAfterModal", () => {
  it("fires the stashed callback and optimistically flips the cache to mark profile seen", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...FULL_NULL, profile_interview_seen_at: null }),
    });
    const qc = makeQueryClient();
    const { usePendingProfileGate } = await import(
      "@/hooks/use-pending-profile-gate"
    );

    const { result } = renderHook(() => usePendingProfileGate(), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.shouldShowModal).toBe(true));

    const proceed = vi.fn();
    // First submit attempt — intercepted; the callback is stashed.
    act(() => {
      result.current.interceptOrProceed(proceed);
    });
    expect(proceed).not.toHaveBeenCalled();

    // Simulate modal close.
    act(() => {
      result.current.resumeAfterModal();
    });

    // Stashed callback fires.
    expect(proceed).toHaveBeenCalledTimes(1);

    // Cache is optimistically flipped — profile_interview_seen_at is no longer null.
    const cached = qc.getQueryData<CreatorProfileResponse>(
      queryKeys.profile.creatorProfile()
    );
    expect(cached?.profile_interview_seen_at).not.toBeNull();
  });

  it("does NOT crash when resumeAfterModal is called with no stashed callback (e.g., user dismisses modal directly)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...FULL_NULL, profile_interview_seen_at: null }),
    });
    const qc = makeQueryClient();
    const { usePendingProfileGate } = await import(
      "@/hooks/use-pending-profile-gate"
    );

    const { result } = renderHook(() => usePendingProfileGate(), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(() => {
      act(() => {
        result.current.resumeAfterModal();
      });
    }).not.toThrow();
  });

  it("preserves an already-set profile_interview_seen_at when resumeAfterModal is called (idempotent)", async () => {
    const existingSeen = "2026-05-17T18:00:00.000Z";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...FULL_NULL,
        profile_interview_seen_at: existingSeen,
      }),
    });
    const qc = makeQueryClient();
    const { usePendingProfileGate } = await import(
      "@/hooks/use-pending-profile-gate"
    );

    const { result } = renderHook(() => usePendingProfileGate(), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.resumeAfterModal();
    });

    const cached = qc.getQueryData<CreatorProfileResponse>(
      queryKeys.profile.creatorProfile()
    );
    expect(cached?.profile_interview_seen_at).toBe(existingSeen);
  });
});
