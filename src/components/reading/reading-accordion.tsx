'use client';

import type { ReactNode } from 'react';
import type { PredictionResult, ApolloDimension } from '@/lib/engine/types';
import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { formatTime } from '@/components/board/audience/audience-derive';
import { bandTone, type ScoreTone } from '@/components/board/verdict/verdict-derive';
import { cn } from '@/lib/utils';
import { renderPanel, buildAudienceNodes, type PanelId } from './reading-panels';
import { ReadingSection } from './reading-section';
import { ReadingRoom } from './reading-room';

// ReadingAccordion (redesign 2026-06-15, hero-v6 system) — the drill-downs, now
// grouped into two LABELED CARD SECTIONS instead of one undifferentiated stack:
//
//   Score drivers      → Hook · Retention · Shareability   (lever rows: name +
//                          128px score bar + value + caret; the weakest is amber,
//                          and a weak Retention carries a "⚠ drops at m:ss" subline)
//   Audience & context → Audience · Niche rank             (context rows: name +
//                          a short descriptor + caret, no bar)
//
// Every row still expands IN PLACE (one consistent mechanic, no bottom-sheet). The
// overall score now lives in the hero gauge, so it is NOT repeated as a row — the
// "Niche rank" row instead drills the niche distribution (panel 'score'). Each
// section is its own single-collapsible AccordionRoot so the AudienceOrbit can sit
// between them in the page. panelId stays a CLOSED union (never a reflected key).

/** Zone color tokens, keyed by bandTone (mirrors ScoreGauge's ZONE_VAR SSOT). */
const ZONE_VAR: Record<ScoreTone, string> = {
  good: 'var(--color-success)',
  warn: 'var(--color-warning)',
  crit: 'var(--color-error)',
  neutral: 'var(--color-warning)',
};

const NEUTRAL_FILL =
  'linear-gradient(90deg, rgba(236,231,222,0.22), rgba(236,231,222,0.38))';

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

// De-boxed (2026-07-18, B+tweak): the sections lost their surrounding card, so the rows
// align to the column edge (px-0.5, matching the section label) instead of being inset 20px
// inside a box. Hairline between rows stays — it is the only rule left, and it reads as an
// editorial divider, not a container.
const ITEM_CLASS =
  'rounded-none border-0 border-t border-[var(--color-border)] bg-transparent first:border-t-0 data-[disabled]:opacity-60';
const TRIGGER_CLASS = 'px-0.5 py-[15px] rounded-md hover:bg-white/[0.02] [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-foreground-muted';

interface LeverRow {
  panel: PanelId;
  label: string;
  /** Printed value (the lever score). */
  value: string;
  /** 0-100 score → bar fill; null = no data (disabled row). */
  score: number | null;
  /** The single weakest lever — value + bar paint in their score-zone color. */
  weak?: boolean;
  /** Amber subline under the name (weak Retention → "⚠ drops at m:ss"). */
  sub?: string;
  /** No data → row present but disabled (honest, never a fabricated 0). */
  disabled?: boolean;
}

export interface ReadingAccordionProps {
  data: PredictionResult;
  dims: ApolloDimension[] | null | undefined;
  /** heatmap.weighted_top_dropoff_t in SECONDS — the weak-Retention subline.
   *  Only the Score-drivers section reads it; optional for the context section. */
  dropT?: number | null;
  /** Analysis id — the Score panel's panel-local useComparisons(id) reads from it. */
  id: string | null;
  /** Pre-derived niche rank string for the context row's descriptor (e.g. "Top 38%"). */
  nicheRank?: string | null;
}

// ── Score drivers ──────────────────────────────────────────────────────────────

export function ScoreDriversSection({ data, dims, dropT, id }: ReadingAccordionProps) {
  const hook = dims?.find((d) => d.name === 'hook');
  const retention = dims?.find((d) => d.name === 'retention');
  const share = dims?.find((d) => d.name === 'share_pull');

  // Weakest = the single lowest score across the present levers (the one to fix).
  // Ties resolve to funnel order (hook → retention → share).
  const leverScores = [hook?.score, retention?.score, share?.score].filter(
    (n): n is number => typeof n === 'number',
  );
  const weakestScore = leverScores.length > 0 ? Math.min(...leverScores) : null;
  let weakestPanel: PanelId | null = null;
  if (weakestScore != null) {
    if (hook && hook.score === weakestScore) weakestPanel = 'hook';
    else if (retention && retention.score === weakestScore) weakestPanel = 'retention';
    else if (share && share.score === weakestScore) weakestPanel = 'shareability';
  }

  const retentionWeak = weakestPanel === 'retention';
  const rows: LeverRow[] = [
    hook
      ? { panel: 'hook', label: 'Hook', value: `${hook.score}`, score: hook.score, weak: weakestPanel === 'hook' }
      : { panel: 'hook', label: 'Hook', value: 'Not available', score: null, disabled: true },
    retention
      ? {
          panel: 'retention',
          label: 'Retention',
          value: `${retention.score}`,
          score: retention.score,
          weak: retentionWeak,
          sub: retentionWeak && dropT != null ? `⚠ drops at ${formatTime(dropT)}` : undefined,
        }
      : { panel: 'retention', label: 'Retention', value: 'Not available', score: null, disabled: true },
    share
      ? { panel: 'shareability', label: 'Shareability', value: `${share.score}`, score: share.score, weak: weakestPanel === 'shareability' }
      : { panel: 'shareability', label: 'Shareability', value: 'Not available', score: null, disabled: true },
  ];

  return (
    <ReadingSection label="Score drivers" card={false}>
      <AccordionRoot type="single" collapsible className="space-y-0" data-testid="reading-accordion">
        {rows.map((row) => (
          <LeverItem key={row.panel} row={row}>
            {renderPanel(row.panel, data, dims, id)}
          </LeverItem>
        ))}
      </AccordionRoot>
    </ReadingSection>
  );
}

function LeverItem({ row, children }: { row: LeverRow; children: ReactNode }) {
  const zone = row.score != null ? ZONE_VAR[bandTone(row.score)] : undefined;
  return (
    <AccordionItem
      value={row.panel}
      disabled={row.disabled}
      data-testid={`row-${row.panel}`}
      className={ITEM_CLASS}
    >
      <AccordionTrigger
        data-testid={`row-trigger-${row.panel}`}
        className={cn(TRIGGER_CLASS, row.disabled && 'cursor-default hover:bg-transparent [&>svg]:opacity-0')}
      >
        <span className="flex flex-1 items-center gap-3.5 pr-2">
          <span className="flex-1 text-left">
            <span className="block text-[15px] font-medium text-foreground">{row.label}</span>
            {row.sub && (
              <span className="mt-0.5 block text-[11px] font-semibold text-warning">{row.sub}</span>
            )}
          </span>
          {row.disabled ? (
            <span data-testid={`row-value-${row.panel}`} className="text-[14px] text-foreground-muted">
              Not available
            </span>
          ) : (
            <span className="flex items-center gap-3.5">
              {row.score != null && (
                <span className="h-[4px] w-16 overflow-hidden rounded-full bg-white/[0.06] sm:w-[132px]">
                  <span
                    data-testid={`row-fill-${row.panel}`}
                    className="block h-full rounded-full"
                    style={{
                      width: `${clampPct(row.score)}%`,
                      background: row.weak && zone ? zone : NEUTRAL_FILL,
                    }}
                  />
                </span>
              )}
              <span
                data-testid={`row-value-${row.panel}`}
                className="w-8 text-right text-[16px] font-semibold tabular-nums"
                style={row.weak && zone ? { color: zone } : { color: 'var(--color-foreground)' }}
              >
                {row.value}
              </span>
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

// ── Audience & context ───────────────────────────────────────────────────────

export function AudienceContextSection({ data, dims, id, nicheRank }: ReadingAccordionProps) {
  // The Room (Phase 3 · Option A): the persona deep-dive that used to open the old
  // AudienceLens drill is now the v6 Room, rendered INLINE — named voices + `ask →` +
  // The people ⇄ Population·1,000 + weak-spot + the video-only timeline replay. The
  // "Niche rank" context row stays below it (where the score sits in your niche);
  // nothing is removed. Honest empty (no personas) → a calm note, never an empty Room.
  const nodes = buildAudienceNodes(data);

  // AUD-FAIL-01 (2026-07-14) — an audience that FAILED is not an audience that shrugged.
  // "No audience reaction landed for this video" reads as a verdict — as if the room watched it
  // and felt nothing. In the live run that exposed this, the room never watched at all: the fold
  // timed out twice, produced zero personas, and the Read still showed a score under a HIGH
  // confidence badge. Say which of the two actually happened.
  //
  // Derived from PERSISTED fields (signal_availability JSONB + input_mode), not an engine-only
  // flag, so it survives the row → PredictionResult cast on a permalink reload.
  const audienceDidNotRun =
    data.input_mode !== 'text' && data.signal_availability?.personas === false;

  return (
    <ReadingSection label="The audience" card={false}>
      <div data-testid="reading-audience-context">
        {nodes.length > 0 ? (
          <ReadingRoom data={data} nodes={nodes} />
        ) : audienceDidNotRun ? (
          <div
            data-testid="reading-audience-did-not-run"
            className="px-5 py-8 text-center"
          >
            <p className="text-[13px] text-foreground">
              Your audience didn&rsquo;t get to watch this one.
            </p>
            <p className="mt-1.5 text-[13px] text-foreground-muted">
              The simulation failed, so nobody reacted — the score above is an expert read only,
              with no audience behind it. Running it again usually works.
            </p>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-[13px] text-foreground-muted">
            No audience reaction landed for this video.
          </p>
        )}
        {/* Niche rank — where the score sits in your niche (kept; expand-in-place). */}
        <AccordionRoot type="single" collapsible className="space-y-0 border-t border-[var(--color-border)]">
          <ContextItem panel="score" label="Niche rank" desc={nicheRank ?? 'vs your niche'}>
            {renderPanel('score', data, dims, id)}
          </ContextItem>
        </AccordionRoot>
      </div>
    </ReadingSection>
  );
}

function ContextItem({
  panel,
  label,
  desc,
  disabled,
  children,
}: {
  panel: PanelId;
  label: string;
  desc: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={panel} disabled={disabled} data-testid={`row-${panel}`} className={ITEM_CLASS}>
      <AccordionTrigger
        data-testid={`row-trigger-${panel}`}
        className={cn(TRIGGER_CLASS, disabled && 'cursor-default hover:bg-transparent [&>svg]:opacity-0')}
      >
        <span className="flex flex-1 items-center justify-between gap-3 pr-2">
          <span className="text-[15px] font-medium text-foreground">{label}</span>
          <span data-testid={`row-value-${panel}`} className="text-[14px] text-foreground-secondary">
            {desc}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}
