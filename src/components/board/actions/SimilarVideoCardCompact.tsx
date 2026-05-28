'use client';
import { GlassPill } from '@/components/primitives';
import { Card } from '@/components/ui/card';
import type { RetrievalEvidenceItem } from '@/lib/engine/types';

interface Props {
  item: RetrievalEvidenceItem;
  onTap: (item: RetrievalEvidenceItem) => void;
}

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Cross-link: see src/components/trending/video-card.tsx (~190 lines, grid-tile model,
// depends on useBookmarkStore). This compact variant intentionally diverges —
// 1-column horizontal row at 56x56 thumb, no bookmarking, no velocity indicator.
export function SimilarVideoCardCompact({ item, onTap }: Props) {
  const handle = item.creator_handle ?? '';
  const ariaLabel = `Similar video by @${handle || 'unknown'}, ${formatCompactNumber(item.views)} views`;
  const similarityPct = Math.round(item.similarity_score * 100);

  return (
    <Card
      onClick={() => onTap(item)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap(item);
        }
      }}
      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-white/[0.02]"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      data-testid="similar-video-card-compact"
    >
      {/* Thumb placeholder — no thumbnail_url in RetrievalEvidenceItem (Phase 5 limitation) */}
      <div
        className="h-14 w-14 shrink-0 rounded-[6px] bg-white/[0.06] overflow-hidden"
        data-testid="similar-video-thumb"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className="truncate text-xs font-medium text-foreground"
          data-testid="similar-video-handle"
        >
          @{handle || '—'}
        </span>
        <span
          className="text-[10px] text-foreground-muted"
          data-testid="similar-video-views"
        >
          {formatCompactNumber(item.views)} views
        </span>
      </div>
      <GlassPill size="sm">
        <span data-testid="similar-video-similarity">{similarityPct}%</span>
      </GlassPill>
    </Card>
  );
}
