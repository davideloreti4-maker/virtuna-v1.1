"use client";

/**
 * AudienceManager — fetches + renders the audience list.
 *
 * CONCEPT-COMPARE REMOVED 2026-07-20 (owner-decided). The page carried a selection
 * mode that took a CONCEPT and returned a Read. That is a content question — "would
 * this land better with room A or room B?" — asked while writing, and answered where
 * Reads live. It sat here only because this is where the audience objects are listed.
 * Three things said so out loud:
 *  - the result was already persisted to the user's open thread
 *    (`api/tools/read/route.ts` → `createOpenThreadLazy` + `insertMessage`), while this
 *    page rendered an ephemeral copy that vanished on navigation — a stray write the
 *    user was never told about;
 *  - it was the ONLY caller of the explicit-pair engine path, so the path existed to
 *    serve this button rather than the button exposing a needed capability;
 *  - with two or three audiences (one typically empty) "select two" had exactly one
 *    valid answer — selection chrome heavier than the choice it collected.
 * ⚠️ `audienceIds` (AUD-EDIT-02) is now CALLERLESS. It stays tested and documented;
 * a thread-side affordance is the intended home. See the note in `read/route.ts`.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Audience } from "@/lib/audience/audience-types";
import { AudienceIndex } from "./audience-index";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import { Button } from "@/components/ui/button";
import { SurfaceEmptyState } from "@/components/ui/surface-empty-state";
import { cn } from "@/lib/utils";
import { filterHorizontalAudiences } from "@/lib/flags/horizontal";

/** Slim, client-serializable view of a connected account — the roster's ACCOUNTS
 *  zone reads it (and /audience/new's source picker imports the type). */
export interface AccountOption {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "youtube";
  is_primary: boolean;
  last_synced_at: string | null;
  /** Formatted followers from the latest snapshot ("86.2M"); null when we hold none. */
  followers?: string | null;
}

interface AudienceManagerProps {
  className?: string;
  /** The user's connected accounts — each renders in the ACCOUNTS zone. */
  accounts?: AccountOption[];
}


function AudienceListSkeleton() {
  return (
    <div className="rounded-2xl bg-white/[0.02] px-2 pb-2 pt-3">
      <div className="mb-1.5 px-3.5">
        <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.05]" />
      </div>
      <div className="flex flex-col divide-y divide-white/[0.045]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-4 px-3.5 py-4">
            <div className="h-4 w-32 flex-1 rounded bg-white/[0.06]" />
            <div className="h-3 w-40 rounded bg-white/[0.04]" />
            <div className="h-[7px] w-28 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AudienceManager({ className, accounts = [] }: AudienceManagerProps) {
  const router = useRouter();
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The user-level audience that seeds new threads (`user_settings.last_audience_id`).
   *  GET /api/audiences has always returned it; the old roster never rendered it, so the
   *  page could not answer "which audience am I being tested against". Now it's the radio. */
  const [defaultAudienceId, setDefaultAudienceId] = useState<string | null>(null);

  // The API route (not the repo helper) — it returns `lastAudienceId` alongside the list,
  // which is the fact the index's default radio renders.
  const fetchAudiences = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/audiences");
      if (!res.ok) throw new Error("list failed");
      const data = (await res.json()) as {
        audiences: Audience[];
        lastAudienceId: string | null;
      };
      setAudiences(data.audiences ?? []);
      setDefaultAudienceId(data.lastAudienceId ?? null);
      setError(null);
    } catch {
      setError("Couldn't load audiences.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudiences();
  }, [fetchAudiences]);

  /**
   * Pin the audience that seeds new threads. General → null (the route's contract).
   * Optimistic: the radio is the whole point of the column, so it must feel instant;
   * a failed write reverts.
   */
  async function handleSetDefault(audience: Audience) {
    const next = audience.is_general ? null : audience.id;
    const previous = defaultAudienceId;
    setDefaultAudienceId(next);
    try {
      const res = await fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: next }),
      });
      if (!res.ok) throw new Error("pin failed");
    } catch {
      setDefaultAudienceId(previous);
      setError("Couldn't set the default audience.");
    }
  }

  // MERGE (2026-07-14, lane/explore-a × main): main's /audience redesign (#280) replaced the
  // old grouped AudienceCard sections with <AudienceIndex>, and that version wins — the
  // redesign is the newer surface and this lane never had an opinion about it.
  //
  // But the redesign was written on a main that has never seen HORIZONTAL_ENABLED (this lane
  // introduced the flag; there are zero refs to it on main). AudienceIndex renders a
  // Social/CUSTOM track switch, and "custom" IS `mode: 'general'` — the horizontal. Handing
  // it the raw list would have quietly re-opened the exact door the flag exists to close,
  // through a component neither side thought to check. Nothing would have failed; the
  // Analyst/Hiring panels would simply have reappeared under a new name.
  //
  // So the redesign gets the filtered list. `filterHorizontalAudiences` is a no-op when the
  // flag is on, so flipping the boolean still restores the horizontal in one move — including
  // here. It keys on `mode`, never `is_general` (see THE TRAP in lib/flags/horizontal.ts:
  // the Baseline creator audience carries `is_general: true` and must stay visible).
  const visibleAudiences = filterHorizontalAudiences(audiences);

  return (
    <div className={cn("relative min-h-full text-foreground", className)}>
      <div className="mx-auto w-full max-w-[880px] px-4 pb-24 pt-6 lg:px-6">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
              Audiences
            </h1>
          </div>
          {/* The ONE action the manager owns. The retired rail cards said the same thing in
              marketing voice ("the moat that makes a prediction yours") — deleted. */}
          {!loading && !error && audiences.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/audience/new")}
              className="pointer-coarse:h-11 shrink-0"
            >
              New audience
            </Button>
          )}
        </header>

        {loading && <AudienceListSkeleton />}

        {!loading && error && (
          <p className="py-8 text-center text-sm text-error">{error}</p>
        )}

        {!loading && !error && audiences.length === 0 && (
          <SurfaceEmptyState
            className="mx-auto max-w-xl"
            icon={<ConstellationMark width={80} litNodeIndex={-1} className="opacity-80" />}
            title="No custom audiences yet"
            action={
              <Button variant="primary" onClick={() => router.push("/audience/new")}>
                Create audience
              </Button>
            }
          >
            {`You're using `}
            <strong className="text-foreground">General</strong>
            {` — Maven's universal audience. Calibrate a personal audience from your own @handle, or start from a template, to test against the people who actually watch you.`}
          </SurfaceEmptyState>
        )}

        {!loading && !error && audiences.length > 0 && (
          <div className="rv-in">
            <AudienceIndex
              audiences={visibleAudiences}
              accounts={accounts}
              defaultAudienceId={defaultAudienceId}
              onSetDefault={(a) => void handleSetDefault(a)}
              onOpen={(a) => router.push(`/audience/${a.id}`)}
              onOpenAccount={(a) => router.push(`/audience/${a.id}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
