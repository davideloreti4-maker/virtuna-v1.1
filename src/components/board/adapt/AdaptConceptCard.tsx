import { cn } from '@/lib/utils';
import type { AdaptConcept } from '@/lib/engine/remix/decode-types';

interface AdaptConceptCardProps {
  concept: AdaptConcept;
  onDevelop?: () => void;
  isPending?: boolean;
}

/**
 * AdaptConceptCard — one Raycast-conformant card rendering a single AdaptConcept.
 *
 * Anatomy (D-09, UI-SPEC §Surface Patterns §Concept Card):
 *   1. Hook headline — bold, text-base, leads with the most actionable element
 *   2. format_borrowed chip — coral accent, pill shape, "Borrowed:" prefix
 *   3. Divider — border-t border-white/[0.04]
 *   4. Angle muted row — uppercase label + secondary value
 *   5. Who it's for muted row — uppercase label + secondary value
 *
 * Raycast card rules (CLAUDE.md verified):
 *   - bg-transparent, border-white/[0.06], rounded-xl (12px), inset shadow
 *   - hover: bg-white/[0.02] ONLY — no translate-y, no border change
 *   - coral accent reserved for the chip only (UI-SPEC reserved-for rule)
 *   - no dangerouslySetInnerHTML (T-04-09 XSS mitigation — React escapes text children)
 */
export function AdaptConceptCard({ concept, onDevelop, isPending }: AdaptConceptCardProps) {
  return (
    <article
      className={cn(
        'relative flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-transparent p-4',
        'hover:bg-white/[0.02]',
      )}
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset' }}
    >
      {/* 1. Hook headline */}
      <p className="text-base font-semibold text-foreground">{concept.hook}</p>

      {/* 2. format_borrowed chip — coral, pill, "Borrowed:" prefix */}
      <span className="inline-flex w-fit text-xs font-medium text-accent bg-accent/[0.12] rounded-full px-2 py-0.5">
        Borrowed: {concept.format_borrowed}
      </span>

      {/* 3. Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* 4. Angle muted row */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-white/45 uppercase tracking-widest">Angle</span>
        <span className="text-xs font-medium text-foreground-secondary">{concept.angle}</span>
      </div>

      {/* 5. Who it's for muted row */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-white/45 uppercase tracking-widest">{"Who it's for"}</span>
        <span className="text-xs font-medium text-foreground-secondary">{concept.who_its_for}</span>
      </div>

      {/* 6. Develop trigger — Raycast secondary action, full-width, bottom of card */}
      {onDevelop && (
        <>
          <div className="border-t border-white/[0.04]" />
          <button
            type="button"
            onClick={onDevelop}
            disabled={isPending}
            className={cn(
              'w-full text-left text-xs font-medium text-white/55',
              'flex items-center justify-between',
              'py-3',
              'hover:text-foreground transition-colors',
              isPending && 'opacity-40 pointer-events-none',
            )}
          >
            Develop &amp; predict
            <span className="text-white/30">→</span>
          </button>
        </>
      )}
    </article>
  );
}
