"use client";

import { useEffect, useState } from "react";
import { SENTINEL_IDS } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";

/**
 * The user's OWN calibrated audience, or null.
 *
 * ⚠️ THE TRAP THIS EXISTS TO AVOID. `/api/audiences` does not return rows — it returns rows
 * COMPOSED with five virtual constants (PRESET_AUDIENCES + two GENERAL_TEMPLATES), which carry
 * `user_id: "__virtual__"` and never touch the DB. Two of those templates ship a runnable
 * persona panel and are `is_general: false`, so the obvious predicate
 * `!is_general && personas.length > 0` matches "Analyst Panel" for an account that owns
 * nothing. That exact confusion stamped every new signup as onboarded ~9s after account
 * creation and made onboarding unreachable for every user until PR #423.
 *
 * `personas.length` IS the app's calibrated test (select-persona-targets.ts:111). It is simply
 * not an OWNERSHIP test, and any predicate over this endpoint needs both. `SENTINEL_IDS` is the
 * repo's own answer to "is this a real row"; four other call sites already use it, and this is
 * the fifth.
 */
export function useCalibratedAudience(): { audience: Audience | null; loading: boolean } {
  const [audience, setAudience] = useState<Audience | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/audiences");
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { audiences?: Audience[] };

        const owned = (body.audiences ?? []).filter((a) => !SENTINEL_IDS.has(a.id));
        const calibrated =
          owned.find((a) => !a.is_general && (a.personas?.length ?? 0) > 0) ?? null;

        if (!cancelled) setAudience(calibrated);
      } catch {
        // A wall that cannot read the audience shows its generic copy. Degrading to the
        // ordinary message is correct; blocking the wall on this fetch is not.
        if (!cancelled) setAudience(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { audience, loading };
}
