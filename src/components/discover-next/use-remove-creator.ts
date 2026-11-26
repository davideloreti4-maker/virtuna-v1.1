"use client";

import { useCallback } from "react";

import { removeCompetitor } from "@/app/actions/competitors/remove";
import { useUntrackChannel } from "@/hooks/queries/use-channels";
import type { Removal } from "@/lib/discover-next/watchlist";

/** How a removal went: every record gone; the session had lapsed (the app then asks to sign in); refused. */
export type RemoveAnswer = "done" | "refused" | "session";

/** The action's answer when nobody is signed in (`app/actions/competitors/remove.ts`). */
const SIGNED_OUT = "Not authenticated";

/** A refusal that only signing in again can help. */
class SessionLapsed extends Error {}

/**
 * Remove a followed creator: every record the row rests on, side by side (each followed spelling, and the
 * competitor link). "done" when all are gone; "session" when a refusal says nobody is signed in (the
 * action's own answer); "refused" for any other refusal (a thrown call, or the action's answer with an
 * error). A refused DELETE reads as refused: the app's remove hook throws one error for every refusal, with
 * no status. One copy, for the Watchlist and the creator's page.
 */
export function useRemoveCreator(): (removal: Removal) => Promise<RemoveAnswer> {
  const { mutateAsync: untrack } = useUntrackChannel();
  return useCallback(
    async (removal: Removal) => {
      const calls: Promise<unknown>[] = [
        ...removal.trackedIds.map((id) => untrack(id)),
        ...(removal.competitorId
          ? [
              Promise.resolve(removal.competitorId)
                .then(removeCompetitor)
                .then((result) => {
                  if (result?.error === SIGNED_OUT) throw new SessionLapsed(result.error);
                  if (result?.error) throw new Error(result.error);
                }),
            ]
          : []),
      ];
      const refusals = (await Promise.allSettled(calls)).filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (refusals.length === 0) return "done";
      return refusals.some((r) => r.reason instanceof SessionLapsed) ? "session" : "refused";
    },
    [untrack],
  );
}
