'use client';
import { useState } from 'react';
import { ArrowUpRight, CaretRight, Check } from '@phosphor-icons/react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { logger } from '@/lib/logger';
import { formatTime } from '@/lib/script-utils';
import { ACTIONS_COPY, TELEMETRY } from './actions-constants';
import { ActionsBestTime } from './ActionsBestTime';
import type { ActionsView, FixItem } from './actions-derive';
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
}

export function ActionsContent({ view, openingLine, analysisId, bestTime }: Props) {
  switch (view.kind) {
    case 'loading':
      return <Skeleton />;
    case 'strong':
      return (
        <div data-testid="actions-strong">
          <ActionsBestTime variant="hero" {...bestTime} />
          {view.polish.length > 0 && (
            <>
              <Rule />
              <Kicker label={ACTIONS_COPY.KICKER_POLISH} tone="good" />
              <Rows>
                {view.polish.map((f, i) => (
                  <FixRow key={`polish-${i}`} fix={f} analysisId={analysisId} />
                ))}
              </Rows>
            </>
          )}
        </div>
      );
    case 'degraded':
      return (
        <div data-testid="actions-degraded">
          <Kicker label={view.kicker} tone="neutral" />
          <Rows>
            {view.rows.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 border-t border-white/[0.06] py-[11px] first:border-t-0"
              >
                <span className="text-[13.5px] leading-[1.45] tracking-[-0.008em] text-white/95">
                  {s.text}
                </span>
              </div>
            ))}
          </Rows>
          <Rule />
          <ActionsBestTime variant="foot" {...bestTime} />
        </div>
      );
    case 'all-set':
      return (
        <div data-testid="actions-all-set">
          <div className="text-[16px] font-semibold leading-[1.3] tracking-[-0.015em] text-white/95">
            {ACTIONS_COPY.ALL_SET}
          </div>
          <p className="mt-[7px] text-[13px] leading-[1.55] text-white/55">
            {ACTIONS_COPY.ALL_SET_SUB}
          </p>
          <Rule />
          <ActionsBestTime variant="foot" {...bestTime} />
        </div>
      );
    case 'needs-work': {
      const rewrite = openingLine ?? `${view.hero.headline}. ${view.hero.detail}`;
      return (
        <div data-testid="actions-needs-work">
          <Kicker
            label={view.kicker}
            count={view.tone === 'crit' ? view.count : undefined}
            tone={view.tone === 'crit' ? 'crit' : 'neutral'}
          />
          <HeroFix fix={view.hero} rewrite={rewrite} analysisId={analysisId} />
          {view.secondary.length > 0 && (
            <>
              <Rule />
              <Rows>
                {view.secondary.map((f, i) => (
                  <FixRow key={`fix-${i}`} fix={f} analysisId={analysisId} />
                ))}
              </Rows>
            </>
          )}
          <Rule />
          <ActionsBestTime variant="foot" {...bestTime} />
        </div>
      );
    }
  }
}

function Rule() {
  return <div className="my-[18px] h-px bg-white/[0.06]" />;
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

function Kicker({
  label,
  count,
  tone,
}: {
  label: string;
  count?: number;
  tone: 'crit' | 'good' | 'neutral';
}) {
  const dot =
    tone === 'crit' ? 'bg-[#ef6360]' : tone === 'good' ? 'bg-[#62cda1]' : 'bg-white/20';
  return (
    <div className="mb-[13px] flex items-center gap-2 text-[11px] font-medium tracking-[0.01em] text-white/30">
      <span className={`h-[5px] w-[5px] rounded-full ${dot}`} aria-hidden />
      <span>
        {label}
        {count ? ` · ${count} ${ACTIONS_COPY.COUNT_SUFFIX}` : ''}
      </span>
    </div>
  );
}

function HeroFix({
  fix,
  rewrite,
  analysisId,
}: {
  fix: FixItem;
  rewrite: string;
  analysisId: string | null;
}) {
  const { copied, copy } = useCopyToClipboard();
  async function onCopy() {
    const ok = await copy(rewrite);
    if (ok) {
      logger.info(TELEMETRY.ACTIONS_REWRITE_COPIED, { analysis_id: analysisId });
    }
  }
  return (
    <div data-testid="actions-hero-fix">
      <div className="text-[16px] font-semibold leading-[1.3] tracking-[-0.015em] text-white/95">
        {fix.headline}
      </div>
      {fix.detail && (
        <p className="mt-[7px] max-w-[300px] text-[13px] leading-[1.55] text-white/55">
          {fix.detail}
        </p>
      )}
      {rewrite.trim().length > 0 && (
        <button
          type="button"
          onClick={onCopy}
          className="mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[-0.005em] text-[#FF7F50] hover:opacity-80 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
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
      )}
    </div>
  );
}

function FixRow({ fix, analysisId }: { fix: FixItem; analysisId: string | null }) {
  const [open, setOpen] = useState(false);
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) logger.info(TELEMETRY.ACTIONS_FIX_EXPANDED, { analysis_id: analysisId });
  }
  return (
    <div className="border-t border-white/[0.06] first:border-t-0" data-testid="actions-fix-row">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-[11px] text-left focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
      >
        <span className="text-[13.5px] font-normal tracking-[-0.008em] text-white/95">
          {fix.headline}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {fix.timestamp_ms > 0 && (
            <span className="font-mono text-[10.5px] tabular-nums text-white/25">
              {formatTime(fix.timestamp_ms)}
            </span>
          )}
          <CaretRight
            size={13}
            weight="regular"
            aria-hidden
            className={`text-white/25 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </span>
      </button>
      {open && fix.detail && (
        <p className="pb-3 text-[12.5px] leading-[1.5] text-white/55">{fix.detail}</p>
      )}
    </div>
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
