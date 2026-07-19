'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApolloRewrite } from '@/lib/engine/types';

// RewriteItem — a single copyable hook rewrite (READ-08, D-15).
//
// Lifted nearly verbatim from InsightHeroFrame's RewriteItem (L97-149), with two
// changes: (1) the OLD Raycast white-alpha palette is repointed to the flat-warm
// cream tokens (text-foreground-muted / text-foreground); (2) the
// `dropLabel` prop is dropped — Fix First owns the timestamped context, this atom is
// strictly original + variant + Copy. The Copy button is ONE of the three sanctioned
// coral affordances (UI-SPEC §accent-reserved) — a coral surface with the dark-brown
// accent-foreground; matte, NO glow.
//
// The copyable rewrite is the literal product payload (D-15): the creator copies the
// variant and pastes it as their new hook. Copy writes ONLY the in-app `rewrite.variant`
// on explicit click and reads nothing back (threat T-02-09 — accept).

export interface RewriteItemProps {
  rewrite: ApolloRewrite;
  /** Render the struck-through original inside the card (default). The list
   *  passes false when every rewrite shares one original and hoists it once
   *  above the cards instead of repeating it per item. */
  showOriginal?: boolean;
}

export function RewriteItem({ rewrite, showOriginal = true }: RewriteItemProps) {
  const [copied, setCopied] = useState(false);
  // WR-01: track the "Copied" revert timer so it's cleared on unmount and before
  // re-scheduling — RewriteItem can unmount within the 1.5s window (drill toggles /
  // route changes), and a pending setCopied on an unmounted component leaks + warns.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function handleCopy() {
    navigator.clipboard.writeText(rewrite.variant)
      .then(() => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // clipboard unavailable (insecure context / permission denied) — no-op,
        // the visual "Copied" affordance simply doesn't fire (graceful failure).
      });
  }

  return (
    <div
      data-testid="reading-rewrite"
      className="flex flex-col gap-1 rounded-md border border-[var(--color-border)] p-3"
    >
      {/* Struck-through original — the verbatim hook line being replaced.
          Omitted when the list hoists a shared original above the cards. */}
      {showOriginal && (
        <del className="text-[12px] leading-[1.4] text-foreground-muted">
          {rewrite.original}
        </del>
      )}

      {/* Variant + Copy (the product payload). */}
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-[13px] leading-[1.5] text-foreground">
          {rewrite.variant}
        </p>
        <button
          type="button"
          aria-label="Copy rewrite"
          onClick={handleCopy}
          // Sanctioned coral surface: coral bg + dark-brown accent-foreground text.
          // Matte (no glow). Focus ring is the accent (also a reserved coral use).
          className="shrink-0 rounded-sm bg-action px-2 py-1 text-[11px] font-medium text-action-foreground transition-colors hover:bg-action/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/10"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

RewriteItem.displayName = 'RewriteItem';
