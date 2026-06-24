'use client';
import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataColumn } from '../_kit';
import {
  deriveCreatorRulebook,
  type CreatorRulebook,
  type RulebookCheck,
  type RulebookInput,
  type RuleStatus,
} from '@/lib/engine/creator-rulebook';

/**
 * Creator Rulebook — an attributed, problems-first checklist derived from
 * deriveCreatorRulebook(). Display-only: reflects the deterministic rule checks,
 * NOT the overall_score (see creator-rulebook.ts honesty contract).
 *
 * Altitude: this is a SUBORDINATE module inside the Content-craft frame, rendered
 * below the headline / filmstrip / pillar rail — NOT a standalone frame. So it owns
 * no card chrome and no FrameHero (one hero per frame): it leads with a hairline
 * divider + caps header + a compact pass/known count, matching the frame's inline
 * sections (CraftRail). Props unchanged, so it still renders fine in the showcase.
 */
export interface CreatorRulebookCardProps {
  /** Engine signals the Rulebook is derived from. A full PredictionResult is assignable. */
  result?: RulebookInput | null;
  /** Authoritative duration (board derives from segments — see creator-rulebook RulebookOptions). */
  durationOverride?: number | null;
  /** Pre-derived Rulebook override (tests / storybook). Wins over `result`. */
  rulebook?: CreatorRulebook;
  isLoading?: boolean;
  className?: string;
}

const STATUS_DOT: Record<RuleStatus, string> = {
  pass: 'bg-success',
  warn: 'bg-warning',
  fail: 'bg-action',
  unknown: 'bg-white/20',
};

const STATUS_TEXT: Record<RuleStatus, string> = {
  pass: 'text-success',
  warn: 'text-warning',
  fail: 'text-foreground-secondary',
  unknown: 'text-white/30',
};

// Problems first — the actionable order. fail → warn → pass; unknowns drop out of the table.
const STATUS_RANK: Record<RuleStatus, number> = { fail: 0, warn: 1, pass: 2, unknown: 3 };

type SummaryTone = 'good' | 'warn' | 'crit';
const SUMMARY_TEXT: Record<SummaryTone, string> = {
  good: 'text-success',
  warn: 'text-warning',
  crit: 'text-foreground-secondary',
};

function summaryFromCounts(rb: CreatorRulebook): { tone: SummaryTone; word: string } {
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

// Two columns only — four cramped in a narrow board node. The rule cell carries the
// status dot, label, a small creator chip (attribution, since the dedicated Source
// column is gone) and the note; the right cell stacks the measured read over its target.
const COLUMNS: DataColumn<RulebookCheck>[] = [
  {
    key: 'rule',
    render: (c) => (
      <div className="flex items-start gap-2.5">
        <span
          className={cn('mt-[5px] inline-block h-[7px] w-[7px] shrink-0 rounded-full', STATUS_DOT[c.status])}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] text-white/85">{c.rule}</span>
            <span className="shrink-0 rounded-[3px] bg-white/[0.05] px-1 py-px text-[9px] uppercase tracking-[0.04em] text-white/40">
              {c.creator}
            </span>
          </div>
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
    key: 'reads',
    align: 'right',
    render: (c) => (
      <div className="leading-tight">
        <div className={cn('text-[13px] tabular-nums', STATUS_TEXT[c.status])}>{c.actual ?? '—'}</div>
        <div className="mt-0.5 text-[11px] tabular-nums text-white/35">{c.target}</div>
      </div>
    ),
  },
];

/** Divider-led section — no card chrome (the frame already supplies the GlassPanel). */
function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn('mt-5 border-t border-white/[0.06] pt-4', className)}
      data-testid="creator-rulebook"
    >
      {children}
    </section>
  );
}

/** Caps header + compact pass/known count — the inline stand-in for a FrameHero. */
function SectionHeader({
  count,
  summary,
}: {
  count?: ReactNode;
  summary: { tone: SummaryTone; word: string };
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-[0.1em] text-white/45">Creator Rulebook</span>
        <p className="mt-1 text-[11px] text-white/35">Scored against Hoyos · Ava · Hormozi</p>
      </div>
      <div className="shrink-0 text-right" data-testid="rulebook-summary">
        {count != null && (
          <div className="text-[15px] font-semibold tabular-nums text-white/90">
            {count}
            <span className="ml-1 text-[11px] font-medium text-white/35">on-pattern</span>
          </div>
        )}
        <div className={cn('mt-0.5 text-[12px] font-semibold', SUMMARY_TEXT[summary.tone])}>
          {summary.word}
        </div>
      </div>
    </div>
  );
}

export function CreatorRulebookCard({
  result,
  durationOverride,
  rulebook,
  isLoading,
  className,
}: CreatorRulebookCardProps) {
  const rb = useMemo<CreatorRulebook | null>(
    () => rulebook ?? (result ? deriveCreatorRulebook(result, { durationOverride }) : null),
    [rulebook, result, durationOverride],
  );

  if (isLoading || !rb) {
    return (
      <Section className={className}>
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-[12px] w-[120px] rounded-[4px]" />
          <Skeleton className="h-[12px] w-[64px] rounded-[4px]" />
        </div>
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[30px] w-full rounded-[6px]" />
          ))}
        </div>
      </Section>
    );
  }

  // No video → every check is "unknown". Don't render an empty table of dashes.
  if (rb.knownCount === 0) {
    return (
      <Section className={className}>
        <div className="flex items-start justify-between gap-4">
          <span className="text-[10px] uppercase tracking-[0.1em] text-white/45">Creator Rulebook</span>
          <span className="shrink-0 text-[12px] font-semibold text-white/55">Needs video</span>
        </div>
        <p className="mt-2 max-w-[46ch] text-[12px] leading-[1.45] text-white/45">
          The hook, pacing, CTA and audio checks read from the video signal. Upload a clip to score
          it against Hoyos, Ava (@personalbrandlaunch) &amp; Hormozi.
        </p>
      </Section>
    );
  }

  const visible = [...rb.checks]
    .filter((c) => c.status !== 'unknown')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  const summary = summaryFromCounts(rb);
  const deferred = rb.checks.length - rb.knownCount;

  return (
    <Section className={className}>
      <SectionHeader count={`${rb.passCount}/${rb.knownCount}`} summary={summary} />

      {/* Lead miss — the single most important off-pattern check, creator-cited. */}
      <p
        className="mt-3 max-w-[52ch] text-[13px] leading-[1.45] text-white/60"
        style={{ textWrap: 'balance' }}
        data-testid="rulebook-insight"
      >
        {leadInsight(visible)}
      </p>

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
    </Section>
  );
}
