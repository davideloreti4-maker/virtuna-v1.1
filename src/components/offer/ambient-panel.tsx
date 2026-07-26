"use client";

/**
 * AmbientPanel — the room in the hero, dressed as the PLATFORM's room.
 *
 * It mounts the shipped `<AmbientRoom>` (The brain ⇄ The people ⇄ The population), landing on
 * the BRAIN scale which auto-plays a labeled simulated neural read on mount.
 *
 * ⚠️ THE SHELL IS NOT DECORATION — it is a copy of a real surface, and it had drifted from it.
 * The room a logged-in creator sees lives in the ≥xl right rail (`audience-presence.tsx`, the
 * `isRail` branch): *"Persistent rail card: static, full-height, matte (12px radius, no shadow,
 * no bloom transform)."* This panel had invented its own treatment on every axis — `rounded-2xl`
 * against the rail's `rounded-[12px]`, `bg-surface-sunken` against its `surface-elevated`, and
 * `shadow-2xl` against an explicit `shadow-none` (also a straight design-system violation: the
 * system is matte — no glass, no glow). So the landing was showing a stale reproduction of the
 * product rather than the product.
 *
 * The header followed the rail too. It used to be browser-window chrome that mirrored
 * `ProductRender`, the fixture Test card that sat beside it — that card is gone (the slot now
 * holds the live composer), so the mirror had nothing left to reflect. It is now the rail's own
 * switcher bar: the audience identity, at the rail's `px-3 py-2.5` with its bottom border.
 *
 * The identity shown is **General, not calibrated** — which is not a placeholder but exactly what
 * an anonymous visitor gets: the shell defaults to the General baseline, and
 * `general-baseline-signature.ts` exists so an uncalibrated user still flows archetype-true axes.
 * It replaces a "1,000 simulated viewers" claim that sat directly above a fixture reading
 * "6 of 10 would stop" — the 10-vs-1,000 conflation §0b③ warns against, contradicting itself
 * inside one panel. The rail makes no such claim, so matching the rail also retires it.
 *
 * The switcher is intentionally NOT interactive here (no chevron, no menu): a dead control on a
 * landing page is worse than an absent one.
 *
 * Non-grounded (personas-only) so there's no gitignored sample-video dependency.
 * Own throwaway QueryClient as insurance for any child hook; `canRewrite` off —
 * the re-run lever is an in-app action, not a landing CTA.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AmbientRoom } from "@/components/audience-lens/AmbientRoom";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import {
  ROOM_CONCEPT,
  ROOM_FRACTION,
  ROOM_PERSONAS,
  ROOM_SIBLINGS,
} from "./room-fixture";

export function AmbientPanel({ className = "" }: { className?: string }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={qc}>
      {/* The rail card, byte-for-byte in treatment: 12px radius, matte, elevated, no shadow. */}
      <div
        className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-none ${className}`}
      >
        {/* The rail's switcher bar — same geometry (px-3 py-2.5, bottom border), same identity
            treatment (mark → name → liveness dot → the uncalibrated tag). */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2 py-1 pl-1 pr-1.5">
            <ConstellationMark width={40} />
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-foreground)]">
              <span className="max-w-[120px] truncate">General</span>
              <span
                aria-hidden
                className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]"
              />
            </span>
            {/* Quiet muted tag, never a warning: correct, just not yours yet. Verbatim from the
                rail, where it is what stops a creator testing against a generic crowd for a week
                while believing it is their own. */}
            <span className="shrink-0 rounded-[4px] border border-white/[0.09] bg-white/[0.03] px-[5px] py-px text-[9px] font-semibold uppercase leading-[1.5] tracking-[0.06em] text-[var(--color-foreground-muted)]">
              not calibrated
            </span>
          </div>
        </div>

        {/* the real ambient room — brain lands first and auto-plays */}
        <div className="min-h-0 flex-1">
          <AmbientRoom
            flatPersonas={ROOM_PERSONAS}
            conceptText={ROOM_CONCEPT}
            fraction={ROOM_FRACTION}
            kindLabel="Hook"
            canRewrite={false}
            focusId="h3"
            initialCompareOpen={false}
            siblings={ROOM_SIBLINGS}
          />
        </div>
      </div>
    </QueryClientProvider>
  );
}
