'use client';

/**
 * AudienceLens — the reusable living-audience SHEET (P9 W1).
 *
 * The single v1 entry across all 6 skills (D-04, degrade-by-feature). As of P13 this is a
 * thin `<Sheet>` wrapper around `<AudienceLensContent>` — the body (the Read, the Panel ⇄
 * Population scale, the constellation/swarm, the per-persona chat list, the sticky Rewrite
 * CTA, the persona-chat drawer) lives in AudienceLensContent so it can ALSO mount, byte-
 * identical, inside the ambient `<AudiencePresence>` FULL detent (no nested sheet there —
 * the detent panel IS the surface; P13 fork #5). Every door (per-card LensTrigger, the
 * Reading panel, the ambient presence) renders the SAME content (the don't-duplicate rule).
 *
 * Color: flat-matte THEME-06 surfaces only. NO glass / backdrop-filter class. Coral reserved
 * for the worst cluster + the Rewrite CTA + the inherited Read lever ONLY.
 */

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { AudienceLensContent, type AudienceLensContentProps } from './AudienceLensContent';

// Re-exported so the long-standing `import { LensRewrite } from './AudienceLens'` call sites
// (card-rewrite.ts, LensTrigger.tsx) stay byte-identical after the content split.
export type { LensRewrite } from './AudienceLensContent';

export interface AudienceLensProps extends AudienceLensContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AudienceLens({ open, onOpenChange, ...content }: AudienceLensProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] gap-0 overflow-y-auto rounded-t-[20px] border-t border-[var(--color-border)] bg-background p-0"
      >
        <SheetTitle className="px-5 pt-5 text-[15px]">Audience</SheetTitle>
        <AudienceLensContent {...content} />
      </SheetContent>
    </Sheet>
  );
}
