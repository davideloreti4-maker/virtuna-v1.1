'use client';

import { useEffect, useState } from 'react';

interface ParentSummary {
  id: string;
  caption: string | null;
  created_at: string;
}

interface Props {
  parentId: string;
}

/**
 * RemixedFromChip — renders a navigable "Remixed from '[caption]'" chip on
 * developed child boards. Fetches the minimal parent summary via the ownership-
 * scoped ?summary endpoint (D-10). The link is always rendered (T-05-07 safe:
 * caption is a React text child, auto-escaped). Raycast chip styling: 6% border,
 * no glow, no accent tint, muted secondary text.
 */
export function RemixedFromChip({ parentId }: Props) {
  const [summary, setSummary] = useState<ParentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analysis/${parentId}?summary`)
      .then((res) => {
        if (!res.ok) throw new Error('summary fetch failed');
        return res.json() as Promise<ParentSummary>;
      })
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  const caption = summary?.caption
    ? summary.caption.slice(0, 40) + (summary.caption.length > 40 ? '…' : '')
    : null;

  const label = loading
    ? 'Remixed from …'
    : caption
    ? `Remixed from “${caption}”`
    : 'Remixed from source';

  return (
    <a
      href={`/analyze/${parentId}`}
      data-testid="remixed-from-chip"
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-2 py-1 text-xs font-medium text-white/55 hover:text-foreground hover:bg-white/[0.04] transition-colors w-fit"
    >
      {label}
    </a>
  );
}
