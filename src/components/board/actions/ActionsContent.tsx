'use client';
import { useState } from 'react';
import { ArrowUpRight, CaretRight, Check } from '@phosphor-icons/react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { logger } from '@/lib/logger';
import { formatTime } from '@/lib/script-utils';
import {
  FrameHero,
  DataTable,
  type DataColumn,
  KeyframeImage,
  resolveKeyframeUrl,
  type KeyframeSegmentLike,
} from '@/components/board/_kit';
import { ACTIONS_COPY, TELEMETRY } from './actions-constants';
import { ActionsBestTime } from './ActionsBestTime';
import {
  deriveActionsHero,
  deriveActionsRows,
  type ActionsView,
  type AdviceRow,
} from './actions-derive';
import type { OptimalPostOverride } from './optimal-post/OptimalPostCard';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';

interface BestTime {
  window: OptimalPostWindow | null;
  override: OptimalPostOverride | null;
  analysisId: string | null;
}

interface Props {
  view: ActionsView;
  /** Engine-derived hook rewrite for the hero "Copy rewrite" link (may be null). */
  openingLine: string | null;
  analysisId: string | null;
  bestTime: BestTime;
  /** Merged keyframe URLs (live SSE + permalink replay), segment idx → signed URL.
   *  Empty in text / tiktok_url modes with no real timeline. */
  filmstrips: Record<number, string>;
  /** Heatmap segments carrying time ranges (seconds) — used to map a fix's
   *  timestamp to its keyframe. */
  segments: ReadonlyArray<KeyframeSegmentLike>;
  /** True only when there's a real video timeline (filmstrips non-empty, or the
   *  engine flagged has_video). Gates the per-row keyframe thumb. */
  hasVideo: boolean;
}

/**
 * Unified Actions frame: Hero (the ONE move) + body (best-time, plus a rewrite
 * block when needs-work) + a clean list of fixes/polish. Every view-kind shares
 * the SAME layout — the kind only changes the hero verb/tone and which rows fill
 * the list — so the frame reads as one screen, not five.
 */
export function ActionsContent({
  view,
  openingLine,
  analysisId,
  bestTime,
  filmstrips,
  segments,
  hasVideo,
}: Props) {
  if (view.kind === 'loading') return <Skeleton />;

  const hero = deriveActionsHero(view);
  const rows = deriveActionsRows(view);

  // needs-work leads with a concrete rewrite (engine opening line, or the hero
  // fix headline/detail as a fallback) the creator can copy and act on.
  const rewrite =
    view.kind === 'needs-work'
      ? openingLine ?? `${view.hero.headline}. ${view.hero.detail ?? ''}`.trim()
      : null;

  const rowsLabel =
    view.kind === 'strong' ? ACTIONS_COPY.SECTION_POLISH : ACTIONS_COPY.SECTION_FIXES;

  return (
    <div className="flex flex-col gap-4" data-testid={`actions-${view.kind}`}>
      {hero && (
        <FrameHero
          label={hero.label}
          value={hero.verb}
          size="prose"
          status={hero.status ? { word: hero.status, tone: hero.tone } : undefined}
          insight={hero.insight || undefined}
        />
      )}

      {view.kind === 'needs-work' && rewrite && (
        <HeroRewrite rewrite={rewrite} analysisId={analysisId} />
      )}

      {rows.length > 0 && (
        <Section label={rowsLabel}>
          <RowList
            rows={rows}
            analysisId={analysisId}
            filmstrips={filmstrips}
            segments={segments}
            hasVideo={hasVideo}
          />
        </Section>
      )}

      <Section label={ACTIONS_COPY.SECTION_WHEN}>
        <ActionsBestTime
          variant={view.kind === 'strong' || view.kind === 'all-set' ? 'hero' : 'foot'}
          {...bestTime}
        />
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.08em] text-white/45">{label}</span>
      {children}
    </div>
  );
}

/** Concrete rewrite the creator can copy — the action that follows the verb hero. */
function HeroRewrite({
  rewrite,
  analysisId,
}: {
  rewrite: string;
  analysisId: string | null;
}) {
  const { copied, copy } = useCopyToClipboard();
  async function onCopy() {
    const ok = await copy(rewrite);
    if (ok) logger.info(TELEMETRY.ACTIONS_REWRITE_COPIED, { analysis_id: analysisId });
  }
  if (rewrite.trim().length === 0) return null;
  return (
    <div
      className="rounded-[12px] border border-white/[0.06] bg-white/[0.016] px-3 py-[11px]"
      data-testid="actions-hero-fix"
    >
      <p className="text-[13px] leading-[1.5] text-white/80">{rewrite}</p>
      <button
        type="button"
        onClick={onCopy}
        className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[-0.005em] text-accent hover:opacity-80 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
      >
        {copied ? (
          <>
            <Check size={13} weight="bold" aria-hidden />
            {ACTIONS_COPY.COPIED}
          </>
        ) : (
          <>
            {ACTIONS_COPY.COPY_REWRITE}
            <ArrowUpRight size={13} weight="bold" aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Linear-style task rows via the kit DataTable. Each row's full detail expands
 * inline on tap (kept from the prior design).
 *
 * When there's a real video timeline (`hasVideo`), each fix leads with a small
 * square keyframe resolved from its `timestampMs` — the thumb's timecode carries
 * the moment, so the separate right-aligned time chip is dropped. In text /
 * tiktok_url modes (no timeline) rows render exactly as before: headline + the
 * right-aligned time chip, no thumb, no layout shift.
 */
function RowList({
  rows,
  analysisId,
  filmstrips,
  segments,
  hasVideo,
}: {
  rows: AdviceRow[];
  analysisId: string | null;
  filmstrips: Record<number, string>;
  segments: ReadonlyArray<KeyframeSegmentLike>;
  hasVideo: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);

  function toggle(i: number, hasDetail: boolean) {
    if (!hasDetail) return;
    const next = open === i ? null : i;
    setOpen(next);
    if (next !== null) logger.info(TELEMETRY.ACTIONS_FIX_EXPANDED, { analysis_id: analysisId });
  }

  const headlineColumn: DataColumn<{ row: AdviceRow; i: number }> = {
    key: 'headline',
    align: 'left',
    render: ({ row, i }) => {
      const hasDetail =
        row.detail.trim().length > 0 && row.detail.trim() !== row.headline.trim();
      const isOpen = open === i;
      return (
        <button
          type="button"
          onClick={() => toggle(i, hasDetail)}
          aria-expanded={hasDetail ? isOpen : undefined}
          disabled={!hasDetail}
          className="flex w-full flex-col gap-1 text-left focus:outline-2 focus:outline-offset-2 focus:outline-white/40 disabled:cursor-default"
          data-testid="actions-advice-row"
        >
          <span className="flex items-center gap-2">
            <span className="text-[13px] leading-[1.4] text-white/90">{row.headline}</span>
            {hasDetail && (
              <CaretRight
                size={12}
                weight="regular"
                aria-hidden
                className={`shrink-0 text-white/25 transition-transform ${isOpen ? 'rotate-90' : ''}`}
              />
            )}
          </span>
          {isOpen && hasDetail && (
            <span className="text-[12.5px] leading-[1.5] text-white/55">{row.detail}</span>
          )}
        </button>
      );
    },
  };

  // Real timeline → lead with the keyframe at the fix's moment; the thumb's
  // timecode replaces the separate right-aligned time chip. A fix with no
  // timestamp gets no thumb (an empty, fixed-width cell keeps the rows aligned).
  if (hasVideo) {
    const thumbColumn: DataColumn<{ row: AdviceRow; i: number }> = {
      key: 'keyframe',
      align: 'left',
      className: 'shrink-0 grow-0 basis-auto',
      render: ({ row }) => {
        const ts = row.timestampMs && row.timestampMs > 0 ? row.timestampMs : null;
        if (ts === null) return <div className="w-10" aria-hidden />;
        const src = resolveKeyframeUrl(filmstrips, segments, ts);
        return (
          <div className="w-10">
            <KeyframeImage ratio="square" src={src} timecode={formatTime(ts)} energy={0.6} />
          </div>
        );
      },
    };
    return (
      <DataTable
        columns={[thumbColumn, headlineColumn]}
        rows={rows.map((row, i) => ({ row, i }))}
        rowKey={({ i }) => `row-${i}`}
      />
    );
  }

  // No timeline (text / tiktok_url) → unchanged: headline + right-aligned time chip.
  const timeColumn: DataColumn<{ row: AdviceRow; i: number }> = {
    key: 'time',
    align: 'right',
    render: ({ row }) =>
      row.timestampMs && row.timestampMs > 0 ? (
        <span className="font-mono text-[10.5px] tabular-nums text-white/30">
          {formatTime(row.timestampMs)}
        </span>
      ) : null,
  };

  return (
    <DataTable
      columns={[headlineColumn, timeColumn]}
      rows={rows.map((row, i) => ({ row, i }))}
      rowKey={({ i }) => `row-${i}`}
    />
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3" data-testid="actions-skeleton" aria-hidden>
      <div className="h-2.5 w-20 rounded bg-white/[0.05]" />
      <div className="mt-1 h-4 w-3/4 rounded bg-white/[0.05]" />
      <div className="h-3 w-full rounded bg-white/[0.04]" />
      <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
    </div>
  );
}
