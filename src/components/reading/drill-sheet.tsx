'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

// Generic two-tier-disclosure container (READ-07, D-09/D-11) — THE Phase-3/5 mount
// point. Heavy drill-downs (a row's detail, every Phase-3 rich chart, the Phase-5
// chat panel) open here as a bottom sheet on mobile / right drawer on desktop. The
// Reading stays mounted behind it; dismiss returns the user in place.
//
// Panel-agnostic ON PURPOSE: the caller passes the panel as `children`; this file
// owns ONLY the surface + the mobile/desktop side switch + a11y. Phase 3 and Phase 5
// add panel TYPES without touching this component (no panel registry, no switch on a
// panelId baked in here). One shared useState at the container drives a single
// DrillSheet instance; the rendered child is chosen by the caller.
//
// Side switch via the existing useIsMobile hook (returns false SSR→first-paint, flips
// after mount) — harmless here because the Sheet renders into a portal that only opens
// post-hydration on user interaction, so the value is correct by the time it opens.
//
// Flat-warm reskin (UI-SPEC §Two-tier): charcoal surface + hairline border; the
// default floating drop-shadow is removed (the overlay bg-black/50 already dims) and
// there is no inner-shine highlight; matte (no backdrop blur). Mobile bottom variant
// gets a rounded top edge for the sheet-handle feel. Title is REQUIRED — Radix Dialog
// warns without a SheetTitle.

export interface DrillSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required for a11y (Radix Dialog warns if absent). */
  title: string;
  /** ANY panel: Phase-2 native content, Phase-3 rich chart, Phase-5 chat. */
  children: React.ReactNode;
  /** Optional extra classes for the scrollable content region. */
  className?: string;
}

export function DrillSheet({ open, onOpenChange, title, children, className }: DrillSheetProps) {
  const isMobile = useIsMobile(); // bottom on mobile, right on desktop (D-11)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        // Panels are freeform (Phase-3 charts, Phase-5 chat) — no fixed description.
        // Explicitly opt out of Radix's aria-describedby requirement (the title names it).
        aria-describedby={undefined}
        className={cn(
          // flat-warm: charcoal surface, hairline border, matte (drop-shadow off, no inner shine)
          'border-[--color-border] bg-surface shadow-none',
          'sm:max-w-[560px]',
          'data-[side=bottom]:max-h-[85vh] data-[side=bottom]:rounded-t-xl',
          'sm:rounded-none',
        )}
      >
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground">{title}</SheetTitle>
        </SheetHeader>
        <div className={cn('overflow-y-auto px-6 pb-6', className)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
