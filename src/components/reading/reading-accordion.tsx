'use client';

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

// ReadingAccordion (UX rework 2026-06-15) — replaces BOTH DriverRows and the
// DrillSheet. Every drill-down is now ONE consistent mechanic: a labelled row
// that expands IN PLACE (no hidden bottom-sheet, no 5-different-invisible-affordance
// problem). The hero gauge + cloud above are pure display; ALL detail lives here.
//
// Rows, in fixed order: Score · Audience · Hook · Retention · Shareability. Each
// trigger reads `label · value` with a thin score bar beneath (Audience is
// categorical → no bar). The caret (from ui/accordion) is the single, obvious
// "tap to expand" affordance — visible on touch, unlike the old cursor-only rows.
//
// type="single" collapsible → one panel open at a time; Radix mounts panel content
// lazily on open (so useComparisons / usePermalinkFilmstrips only fire when opened).
// panelId is a CLOSED union (never a reflected key — threat T-02-12).

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

interface RowSpec {
  panel: PanelId;
  label: string;
  /** What the value column prints (a score, or Retention's drop timestamp). */
  value: string;
  /** 0-100 score → the thin sub-bar fill; null = no bar (Audience is categorical). */
  score: number | null;
  /** The single weakest lever — its value + bar paint in their score-zone color. */
  weak?: boolean;
  /** No data for this lever → row present but disabled (honest, never a fake 0). */
  disabled?: boolean;
}

export interface ReadingAccordionProps {
  data: PredictionResult;
  dims: ApolloDimension[] | null | undefined;
  /** heatmap.weighted_top_dropoff_t in SECONDS — the Retention drop readout. */
  dropT: number | null | undefined;
  /** Analysis id — the Score panel's panel-local useComparisons(id) reads from it. */
  id: string | null;
}

export function ReadingAccordion({ data, dims, dropT, id }: ReadingAccordionProps) {
  const hook = dims?.find((d) => d.name === 'hook');
  const retention = dims?.find((d) => d.name === 'retention');
  const share = dims?.find((d) => d.name === 'share_pull');

  const score = Math.round(Number.isFinite(data.overall_score) ? data.overall_score : 0);
  const personaCount = buildAudienceNodes(data).length;

  // Weakest = the single lowest score across the three present levers (the one
  // lever to fix). Ties resolve to the first in funnel order (hook→ret→share).
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

  const rows: RowSpec[] = [];
  // Score — always present past the D-13 gate (overall_score is a real number).
  rows.push({ panel: 'score', label: 'Score', value: `${score}`, score });
  // Audience — only when personas exist (mirrors the cloud's omit-when-empty path).
  if (personaCount > 0) {
    rows.push({ panel: 'personas', label: 'Audience', value: `${personaCount} segments`, score: null });
  }
  // Levers — present even when degraded, but a missing dim → disabled + "Not available"
  // (honest: the lever exists, we just have no number — never a fabricated 0).
  rows.push(
    hook
      ? { panel: 'hook', label: 'Hook', value: `${hook.score}`, score: hook.score, weak: weakestPanel === 'hook' }
      : { panel: 'hook', label: 'Hook', value: 'Not available', score: null, disabled: true },
  );
  rows.push(
    retention
      ? {
          panel: 'retention',
          label: 'Retention',
          // value = the drop timestamp (where it breaks); bar still fills by score.
          value: dropT != null ? `⚠ ${formatTime(dropT)}` : `${retention.score}`,
          score: retention.score,
          weak: weakestPanel === 'retention',
        }
      : { panel: 'retention', label: 'Retention', value: 'Not available', score: null, disabled: true },
  );
  rows.push(
    share
      ? { panel: 'shareability', label: 'Shareability', value: `${share.score}`, score: share.score, weak: weakestPanel === 'shareability' }
      : { panel: 'shareability', label: 'Shareability', value: 'Not available', score: null, disabled: true },
  );

  return (
    <AccordionRoot
      type="single"
      collapsible
      data-testid="reading-accordion"
      className="space-y-0 overflow-hidden rounded-[10px] border border-[var(--color-border)]"
    >
      {rows.map((row) => {
        const zone = row.score != null ? ZONE_VAR[bandTone(row.score)] : undefined;
        // Prepend ⚠ to a weakest non-Retention value (Retention already carries it).
        const valueText =
          row.weak && !row.value.startsWith('⚠') ? `⚠ ${row.value}` : row.value;

        return (
          <AccordionItem
            key={row.panel}
            value={row.panel}
            disabled={row.disabled}
            data-testid={`row-${row.panel}`}
            className="rounded-none border-0 border-t border-[var(--color-border)] bg-transparent first:border-t-0 data-[disabled]:opacity-60"
          >
            <AccordionTrigger
              data-testid={`row-trigger-${row.panel}`}
              className={cn(
                'px-4 py-3 hover:bg-white/[0.02]',
                '[&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-foreground-muted',
                row.disabled && 'cursor-default hover:bg-transparent [&>svg]:opacity-0',
              )}
            >
              <span className="flex flex-1 flex-col gap-2 pr-2">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium text-foreground-secondary">
                    {row.label}
                  </span>
                  <span
                    data-testid={`row-value-${row.panel}`}
                    className={cn(
                      'whitespace-nowrap text-[14px] font-semibold tabular-nums',
                      row.disabled ? 'text-foreground-muted' : 'text-foreground',
                    )}
                    style={row.weak && zone ? { color: zone } : undefined}
                  >
                    {valueText}
                  </span>
                </span>
                {row.score != null && (
                  <span className="block h-[4px] w-full rounded-full bg-[var(--color-border)]">
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
              </span>
            </AccordionTrigger>
            <AccordionContent>{renderPanel(row.panel, data, dims, id)}</AccordionContent>
          </AccordionItem>
        );
      })}
    </AccordionRoot>
  );
}

ReadingAccordion.displayName = 'ReadingAccordion';
