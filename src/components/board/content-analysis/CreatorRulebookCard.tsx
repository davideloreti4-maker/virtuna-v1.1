'use client';
import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { FrameHero, DataTable, type DataColumn, type HeroTone } from '../_kit';
import {
  deriveCreatorRulebook,
  type CreatorRulebook,
  type RulebookCheck,
  type RuleStatus,
} from '@/lib/engine/creator-rulebook';
import type { PredictionResult } from '@/lib/engine/types';

/**
 * Creator Rulebook scorecard — renders deriveCreatorRulebook() as an attributed,
 * problems-first checklist. Display-only: this reflects the deterministic rule checks,
 * NOT the overall_score (see creator-rulebook.ts honesty contract).
 *
 * Drop-in: <CreatorRulebookCard result={result} /> inside any frame's GlassPanel.
 * Self-contained (own card chrome) so it also reads fine standalone. Imported by
 * nothing yet — wiring into the Content-craft frame is deferred until the board
 * rework settles.
 */
export interface CreatorRulebookCardProps {
  /** Engine result — the Rulebook is derived from it. */
  result?: PredictionResult | null;
  /** Pre-derived Rulebook override (tests / storybook). Wins over `result`. */
  rulebook?: CreatorRulebook;
  isLoading?: boolean;
  className?: string;
}

const STATUS_DOT: Record<RuleStatus, string> = {
  pass: 'bg-success',
  warn: 'bg-warning',
  fail: 'bg-accent',
  unknown: 'bg-white/20',
};

const STATUS_TEXT: Record<RuleStatus, string> = {
  pass: 'text-success',
  warn: 'text-warning',
  fail: 'text-accent',
  unknown: 'text-white/30',
};

// Problems first — the actionable order. fail → warn → pass; unknowns drop out of the table.
const STATUS_RANK: Record<RuleStatus, number> = { fail: 0, warn: 1, pass: 2, unknown: 3 };

function heroFromCounts(rb: CreatorRulebook): { tone: HeroTone; word: string } {
  if (rb.failCount === 0 && rb.warnCount === 0) return { tone: 'good', word: 'On-pattern' };
  if (rb.failCount === 0) return { tone: 'warn', word: 'Minor gaps' };
  return { tone: 'crit', word: 'Off-pattern' };
}

/** Lead insight = the single most important miss (first fail, else first warn), creator-cited. */
function leadInsight(checks: RulebookCheck[]): ReactNode {
  const top = checks.find((c) => c.status === 'fail') ?? checks.find((c) => c.status === 'warn');
  if (!top) return 'Every computable creator rule is on-pattern.';
  return (
    <>
      <span className="text-white/80">{top.rule}</span>
      {top.actual ? ` — ${top.actual} vs ${top.target}` : ` — target ${top.target}`}{' '}
      <span className="text-white/40">(per {top.creator})</span>. {top.note}
    </>
  );
}

const COLUMNS: DataColumn<RulebookCheck>[] = [
  {
    key: 'rule',
    label: 'Rule',
    render: (c) => (
      <div className="flex items-start gap-2.5">
        <span
          className={cn('mt-[5px] inline-block h-[7px] w-[7px] shrink-0 rounded-full', STATUS_DOT[c.status])}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] text-white/85">{c.rule}</div>
          <div
            className="mt-0.5 text-[11px] leading-[1.35] text-white/40"
            style={{ textWrap: 'balance' }}
          >
            {c.note}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'creator',
    label: 'Source',
    render: (c) => <span className="text-[11px] text-white/45">{c.creator}</span>,
  },
  {
    key: 'actual',
    label: 'Actual',
    align: 'right',
    render: (c) => (
      <span className={cn('text-[13px] tabular-nums', STATUS_TEXT[c.status])}>{c.actual ?? '—'}</span>
    ),
  },
  {
    key: 'target',
    label: 'Target',
    align: 'right',
    render: (c) => <span className="text-[12px] tabular-nums text-white/35">{c.target}</span>,
  },
];

function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn('rounded-[12px] border border-white/[0.06] bg-transparent p-4', className)}
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0 1px 0 0 inset' }}
      data-testid="creator-rulebook"
    >
      {children}
    </section>
  );
}

export function CreatorRulebookCard({ result, rulebook, isLoading, className }: CreatorRulebookCardProps) {
  const rb = useMemo<CreatorRulebook | null>(
    () => rulebook ?? (result ? deriveCreatorRulebook(result) : null),
    [rulebook, result],
  );

  if (isLoading || !rb) {
    return (
      <Shell className={className}>
        <Skeleton className="h-[14px] w-[120px] rounded-[4px]" />
        <Skeleton className="mt-3 h-[34px] w-[90px] rounded-[6px]" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[30px] w-full rounded-[6px]" />
          ))}
        </div>
      </Shell>
    );
  }

  // No video → every check is "unknown". Don't render an empty table of dashes.
  if (rb.knownCount === 0) {
    return (
      <Shell className={className}>
        <FrameHero label="Creator Rulebook" value="—" status={{ word: 'Needs video', tone: 'neutral' }} />
        <p className="mt-2 max-w-[46ch] text-[12px] leading-[1.45] text-white/45">
          The hook, pacing, CTA and audio checks read from the video signal. Upload a clip to score
          it against Hoyos, Yuergens &amp; Hormozi.
        </p>
      </Shell>
    );
  }

  const visible = [...rb.checks]
    .filter((c) => c.status !== 'unknown')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  const hero = heroFromCounts(rb);
  const deferred = rb.checks.length - rb.knownCount;

  return (
    <Shell className={className}>
      <FrameHero
        label="Creator Rulebook"
        value={`${rb.passCount}/${rb.knownCount}`}
        unit="on-pattern"
        status={{ word: hero.word, tone: hero.tone }}
        insight={leadInsight(visible)}
      />
      <DataTable
        className="mt-3"
        columns={COLUMNS}
        rows={visible}
        rowKey={(c) => c.id}
        dense
      />
      {deferred > 0 && (
        <p className="mt-2.5 text-[11px] text-white/30">
          {deferred} more rule{deferred === 1 ? '' : 's'} unlock with richer video signal.
        </p>
      )}
    </Shell>
  );
}
