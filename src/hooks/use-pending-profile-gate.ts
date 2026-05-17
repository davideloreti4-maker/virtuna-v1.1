"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useCreatorProfile,
  type CreatorProfileResponse,
} from "@/hooks/queries/use-creator-profile";
import { queryKeys } from "@/lib/queries/query-keys";

/**
 * Pending-profile gate — deferred-submit pattern that prevents an upload
 * action from completing until the 9-card creator profile has been seen.
 *
 * Backed by the shared TanStack query (`useCreatorProfile`) — invalidating
 * `queryKeys.profile.creatorProfile()` from anywhere (settings save, modal
 * finalize) instantly refreshes this gate (CR-01 mitigation). One query key,
 * single cache namespace.
 *
 * Pattern (RESEARCH §Pattern 1):
 *   1. Read `creator_profiles.profile_interview_seen_at` via the shared query.
 *      `isLoading` is true on the first hydration.
 *   2. `interceptOrProceed(callback)` is called from the form's submit
 *      handler. If the modal should be shown, stash the callback into a ref
 *      and return `{ intercepted: true }`. Otherwise invoke the callback
 *      immediately and return `{ intercepted: false }`.
 *   3. `resumeAfterModal()` is called by the modal's onClose handler. It
 *      fires the stashed callback (the deferred submit) and optimistically
 *      flips `profile_interview_seen_at` in the cache so a second submit in
 *      the same session does not re-trigger the modal (the DB write happens
 *      inside the store's finalize/skipInterview).
 *
 * Pitfall #1 mitigation (RESEARCH lines 685-693): while the query is
 * `isLoading` we DEFER to the safe side and intercept the submit. The
 * consuming component should also surface `isLoading` (we expose it) to
 * disable the submit button during the brief race window.
 *
 * Fail-open posture: if the query errors (network failure, RLS denial), we
 * treat the profile as seen so a transient backend failure does not block
 * the upload flow.
 */
export interface PendingProfileGate {
  shouldShowModal: boolean;
  isLoading: boolean;
  interceptOrProceed: (proceed: () => void) => { intercepted: boolean };
  resumeAfterModal: () => void;
}

export function usePendingProfileGate(): PendingProfileGate {
  const { data, isLoading, isError } = useCreatorProfile();
  const queryClient = useQueryClient();
  const pendingSubmit = useRef<(() => void) | null>(null);

  // Fail-open: on query error, treat as seen so we do not hard-block uploads.
  const profileSeen = isError
    ? true
    : data?.profile_interview_seen_at != null;
  const shouldShowModal = !isLoading && !isError && !profileSeen;

  const interceptOrProceed = useCallback(
    (proceed: () => void): { intercepted: boolean } => {
      // Pitfall #1: treat the loading window as intercept (safe default).
      if (isLoading || shouldShowModal) {
        pendingSubmit.current = proceed;
        return { intercepted: true };
      }
      proceed();
      return { intercepted: false };
    },
    [isLoading, shouldShowModal]
  );

  const resumeAfterModal = useCallback((): void => {
    const callback = pendingSubmit.current;
    pendingSubmit.current = null;
    // Optimistically flip `profile_interview_seen_at` in the cache so a
    // second submit in the same session does not re-trigger the modal.
    // The DB write is performed by the store's finalize/skipInterview.
    queryClient.setQueryData<CreatorProfileResponse | undefined>(
      queryKeys.profile.creatorProfile(),
      (prev) => {
        if (!prev) return prev;
        if (prev.profile_interview_seen_at != null) return prev;
        return {
          ...prev,
          profile_interview_seen_at: new Date().toISOString(),
        };
      }
    );
    if (callback) callback();
  }, [queryClient]);

  return {
    shouldShowModal,
    isLoading,
    interceptOrProceed,
    resumeAfterModal,
  };
}
