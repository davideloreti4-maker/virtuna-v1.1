'use client';

/**
 * ClusterView — the cluster-by-segment lens (P9 W3, D-04).
 *
 * Shows WHICH segment of the room loved/hated the concept, grouped by the
 * Temp × Disposition lens that `buildSegmentGroups` already computes (the pure,
 * shipped grouping — we render presentation only on top, never re-derive it).
 *
 * Color (UI-SPEC §Color): coral is reserved EXCLUSIVELY for the single worst
 * cluster (`worstBadGroupKey` — the one below ~40%, ≤2 coral marks per frame).
 * Every other cluster reads cream-alpha; the watch-through number itself uses the
 * established score-zone data colors only on the bar fill, never as chrome.
 *
 * Two signal shapes feed this (degrade-by-feature, D-06):
 *  - Rich (video Test): groups = buildSegmentGroups(heatmap, simResults).
 *  - Flat (text skills / Read): groups = clusterFlatNodes(nodes) (stop-% per slot).
 * Both produce the same `SegmentGroup[]` + worst-key shape, so this view is shared.
 */

import type { SegmentGroup, SlotKey } from '@/components/board/audience/audience-derive';

export interface ClusterViewProps {
  /** Slot groups, already folded by buildSegmentGroups / clusterFlatNodes (pure). */
  groups: SegmentGroup[];
  /** The single worst (coral) cluster key, or null when none qualifies (<40% rule). */
  worstKey: SlotKey | null;
}

export function ClusterView({ groups, worstKey }: ClusterViewProps) {
  // Only show clusters that actually carry personas (count > 0) — an empty slot is
  // not a reaction, and a zero-row would imply a segment that did not react.
  const visible = groups.filter((g) => g.count > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" aria-label="Audience reaction by segment">
      <p className="text-[13px] font-medium text-foreground-muted">By segment</p>
      <ul className="flex flex-col gap-2" role="list">
        {visible.map((g) => {
          const isWorst = g.key === worstKey;
          const pct = Math.round(g.pct);
          return (
            <li
              key={g.key}
              className="flex flex-col gap-1 rounded-[8px] border border-[var(--color-border)] bg-surface px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-medium text-foreground">{g.label}</span>
                <span
                  className="text-[13px] tabular-nums"
                  style={{ color: isWorst ? 'var(--color-accent)' : 'var(--color-cream-muted)' }}
                >
                  {pct}%
                </span>
              </div>
              {/* Watch-through bar — coral fill ONLY for the worst cluster (≤2 coral
                  marks: the % label + this bar share the one coral treatment). */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, pct))}%`,
                    backgroundColor: isWorst
                      ? 'var(--color-accent)'
                      : 'rgba(236, 231, 222, 0.45)',
                  }}
                />
              </div>
              <span className="text-[11px] text-[var(--color-cream-muted)]">{g.desc}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
