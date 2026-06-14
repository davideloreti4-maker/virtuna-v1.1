'use client';

import { useState } from 'react';
import type { CounterfactualSuggestionItem, ApolloRewrite } from '@/lib/engine/types';
import { RewriteItem } from './rewrite-item';

// FixFirstList — the actionable bottom of the Reading (READ-07/08, D-08/D-14/D-15).
//
// Reuses TopFixesList's fix-item card markup + the type='fix' filter (board L24/L34-62)
// but SEVERS the board coupling: no board store hook, and the dead audience-filmstrip
// jump anchor is dropped (no Konva preset in the thread — RESEARCH Landmine 3).
//
// Two-tier disclosure (D-10): the top-3 fixes are always inline; any overflow collapses
// behind an inline "{n} more fixes →" toggle that reveals the rest IN THE THREAD — a light
// useState height toggle, NOT a Sheet (the heavy half is DrillSheet, owned by DriverRows).
//
// D-14 (correctness, not polish): zero fixes is a WIN ("Nothing urgent to fix" / "This one's
// solid."), NOT a blank — it replaces the analog's `return null`. When rewrites are empty/null
// the fixes render WITHOUT the rewrite section (no placeholder chip).
//
// READ-10 / threat T-02-08: only the whitelisted fields (headline / detail) are rendered —
// the raw PredictionResult is never spread.

export interface FixFirstListProps {
  /** counterfactuals.suggestions — top-level engine field (fixes can exist when
   *  rewrites don't). Undefined when the analysis produced no counterfactuals. */
  fixes: CounterfactualSuggestionItem[] | undefined;
  /** apollo_reasoning.rewrites (dual-read at the container). Null/empty when the
   *  DeepSeek reasoner is unavailable — the rewrite section then omits silently. */
  rewrites: ApolloRewrite[] | null | undefined;
}

function FixCard({ fix }: { fix: CounterfactualSuggestionItem }) {
  // Card markup reused from TopFixesList L34-62 (sans the dead audience-jump anchor).
  return (
    <li
      data-testid="fix-first-item"
      className="rounded-[8px] border border-[var(--color-border)] bg-white/[0.02] p-2"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-medium text-foreground" data-testid="fix-first-headline">
          {fix.headline}
        </span>
        <span className="text-xs text-foreground-muted" data-testid="fix-first-detail">
          {fix.detail}
        </span>
      </div>
    </li>
  );
}

export function FixFirstList({ fixes, rewrites }: FixFirstListProps) {
  const [expanded, setExpanded] = useState(false);

  const fixItems = (fixes ?? []).filter((s) => s.type === 'fix');
  const hasRewrites = Array.isArray(rewrites) && rewrites.length > 0;

  // ── D-14 empty win ─────────────────────────────────────────────────────────
  // Zero fixes is a positive signal, not a blank surface.
  if (fixItems.length === 0) {
    return (
      <section data-testid="fix-first" className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-foreground-muted">
          Fix first
        </h3>
        <div data-testid="fix-first-empty" className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">Nothing urgent to fix</p>
          <p className="text-xs text-foreground-muted">This one&apos;s solid.</p>
        </div>
        {/* No-rewrites: omit the rewrite section entirely (D-14, no placeholder). */}
        {hasRewrites && <RewriteSection rewrites={rewrites!} />}
      </section>
    );
  }

  const top = fixItems.slice(0, 3);
  const rest = fixItems.slice(3);
  const overflow = rest.length;

  return (
    <section data-testid="fix-first" className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-foreground-muted">
        Fix first
      </h3>

      <ul className="flex flex-col gap-1.5" data-testid="fix-first-list">
        {top.map((fix, i) => (
          <FixCard key={`top-${fix.timestamp_ms}-${i}`} fix={fix} />
        ))}
        {/* Inline overflow reveal (D-10) — light, in-thread, NOT a Sheet. */}
        {expanded &&
          rest.map((fix, i) => <FixCard key={`rest-${fix.timestamp_ms}-${i}`} fix={fix} />)}
      </ul>

      {overflow > 0 && !expanded && (
        <button
          type="button"
          data-testid="fix-first-more"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="self-start text-xs text-foreground-secondary underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"
        >
          {overflow} more fixes &rarr;
        </button>
      )}

      {/* Hook rewrites — the copyable payload (D-15). Omitted entirely when absent. */}
      {hasRewrites && <RewriteSection rewrites={rewrites!} />}
    </section>
  );
}

function RewriteSection({ rewrites }: { rewrites: ApolloRewrite[] }) {
  return (
    <div className="flex flex-col gap-2" data-testid="fix-first-rewrites">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-foreground-muted">
        Hook rewrites
      </p>
      {rewrites.map((rw, i) => (
        <RewriteItem key={`${rw.lever_fixed}-${i}`} rewrite={rw} />
      ))}
    </div>
  );
}

FixFirstList.displayName = 'FixFirstList';
