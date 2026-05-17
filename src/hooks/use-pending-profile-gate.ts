"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Pending-profile gate — deferred-submit pattern that prevents an upload
 * action from completing until the 9-card creator profile has been seen.
 *
 * Pattern (RESEARCH §Pattern 1):
 *   1. On mount, read `creator_profiles.profile_interview_seen_at` for the
 *      authenticated user. `profileSeen === null` while loading.
 *   2. `interceptOrProceed(callback)` is called from the form's submit
 *      handler. If the modal should be shown, stash the callback into a ref
 *      and return `{ intercepted: true }`. Otherwise invoke the callback
 *      immediately and return `{ intercepted: false }`.
 *   3. `resumeAfterModal()` is called by the modal's onClose handler. It
 *      fires the stashed callback (the deferred submit) and locally marks
 *      the profile as seen so a second submit in the same session does not
 *      re-trigger the modal.
 *
 * Pitfall #1 mitigation (RESEARCH lines 685-693): while `profileSeen` is
 * loading we DEFER to the safe side and intercept the submit. The consuming
 * component should also surface `isLoading` (we expose it) to disable the
 * submit button during the brief race window.
 */
export interface PendingProfileGate {
  shouldShowModal: boolean;
  isLoading: boolean;
  interceptOrProceed: (proceed: () => void) => { intercepted: boolean };
  resumeAfterModal: () => void;
}

export function usePendingProfileGate(): PendingProfileGate {
  // null = loading; true = seen; false = unseen (must show modal)
  const [profileSeen, setProfileSeen] = useState<boolean | null>(null);
  const pendingSubmit = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadGate = async (): Promise<void> => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!user) {
          // Unauthenticated — never show modal; downstream auth gate handles
          // the actual sign-in flow.
          setProfileSeen(true);
          return;
        }

        // Cast: `profile_interview_seen_at` was added to creator_profiles
        // by the Plan 02-01 migration (20260517210000_creator_profile_9card_columns.sql)
        // but src/types/database.types.ts has not been regenerated. The
        // column exists at runtime; the typed schema is stale. Plan 02-06
        // (DB-types regen) cleans this up.
        const { data, error } = await supabase
          .from("creator_profiles")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select("profile_interview_seen_at" as any)
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;

        if (error) {
          // Fail-open: do not block the submit if we cannot read the gate
          // state. The modal will be re-tried next session.
          setProfileSeen(true);
          return;
        }

        const row = data as { profile_interview_seen_at?: string | null } | null;
        setProfileSeen(Boolean(row?.profile_interview_seen_at));
      } catch {
        if (!cancelled) setProfileSeen(true);
      }
    };

    void loadGate();
    return () => {
      cancelled = true;
    };
  }, []);

  const shouldShowModal = profileSeen === false;
  const isLoading = profileSeen === null;

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
    // Locally mark seen so a second submit in the same session does not
    // re-trigger the modal (the DB write happens inside the store).
    setProfileSeen(true);
    if (callback) callback();
  }, []);

  return {
    shouldShowModal,
    isLoading,
    interceptOrProceed,
    resumeAfterModal,
  };
}
