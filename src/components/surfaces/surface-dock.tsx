"use client";

/**
 * SurfaceDock — the app-wide living-presence dock (Seam 3, THE-CONTRACT.md §3), now REAL.
 *
 * Was a stub (a local `AudienceConstellation` + switcher fed `MOCK_AUDIENCES`). GRAFTED
 * 2026-07-05: a thin host wrapper around the Room-owned `<AudiencePresence variant='surface'>`,
 * fed the user's REAL audiences (`listAudiences` / `resolveUserAudience`, resolved server-side in
 * `/start`). One presence atom, Room-owned, so /start and /home never drift.
 *
 * ⚠️ TYPE-FLOW (SURFACE-SEAM-SPEC §2.4 correction): `AudiencePresence` consumes the DB `Audience`
 * type (`audience-presence.tsx:86-92`), NOT the contract `ActiveAudience`. So this dock is fed the
 * RAW `Audience[]` from the server — the `audienceToActiveAudience` adapter is bypassed here (it
 * only matters where the contract `ActiveAudience` shape is genuinely consumed, e.g. a card layer).
 *
 * Read-only (§3 sign-off delta): `variant='surface'` gates off the composer-bound affordances (no
 * ask input, Rewrite CTA forced off) — a surface has no composer field to route asks into. The
 * start page's own embedded composer (Seam 4) is what makes asks work there.
 *
 * `layout='dock'` at every breakpoint: /start pins the dock + composer as ONE bottom object across
 * all widths (its content right-rail already occupies the desktop right column), so the /home-style
 * desktop `layout='rail'` presentation does not apply here.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Audience } from "@/lib/audience/audience-types";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { AudiencePresence } from "@/components/audience-lens/audience-presence";
import { cn } from "@/lib/utils";

export interface SurfaceDockProps {
  /** The active audience (null = General — the presence renders the General state, no crash). */
  audience: Audience | null;
  /** All selectable audiences (from `listAudiences` — includes the General baseline + presets). */
  audiences: Audience[];
  /** The selected audience id (null = General) — drives the switcher's checked row. */
  selectedAudienceId: string | null;
  /** Switch the active audience (the host persists user_settings.last_audience_id). */
  onSelectAudience: (audience: Audience) => void;
  /** A room-reaction is in flight → the constellation blinks + "N new" arrival badge. */
  reacting?: boolean;
  className?: string;
}

export function SurfaceDock({
  audience,
  audiences,
  selectedAudienceId,
  onSelectAudience,
  reacting = false,
  className,
}: SurfaceDockProps) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  // The panel open state is host-owned in the presence contract; on a read-only surface the dock
  // simply owns it locally (no composer field to coordinate with — cf. /home, where it's shared).
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <AudiencePresence
        variant="surface"
        layout="dock"
        audience={audience}
        audiences={audiences}
        selectedAudienceId={selectedAudienceId}
        onSelectAudience={onSelectAudience}
        // Peek-only at rest (SURFACE-SEAM-SPEC §2.1): no card is anchored on the /start dock, so
        // the presence shows the honest idle band ("General · N people ready"), never a focus.
        focus={null}
        open={open}
        onOpenChange={setOpen}
        reducedMotion={reducedMotion}
        reacting={reacting}
        // The switcher's `+ Build an audience` row → the real calibration flow (mirrors FirstRun).
        onBuildAudience={() => router.push("/audience/new")}
      />
    </div>
  );
}
