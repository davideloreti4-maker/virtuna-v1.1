'use client';
import { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { CaretDown } from '@phosphor-icons/react';
import type { PredictionResult } from '@/lib/engine/types';
import { assembleReasoningBuckets } from './assembleReasoningBuckets';
import { TopFixesList } from './TopFixesList';
import { COPY, TELEMETRY } from './verdict-constants';
import { logger } from '@/lib/logger';

interface WhyVerdictCollapsibleProps {
  result: PredictionResult;
}

export function WhyVerdictCollapsible({ result }: WhyVerdictCollapsibleProps) {
  const buckets = assembleReasoningBuckets(result);
  const defaultOpen = result.anti_virality_gated === true;

  // W3 fix: derive the top-3 fixes that TopFixesList will render so we can
  // exclude them from the plain counterfactual list (no duplicate rendering in AV state).
  const topFixesShown = useMemo(() => {
    if (!result.anti_virality_gated) return [] as typeof buckets.counterfactual;
    return buckets.counterfactual
      .filter((s) => s.type === 'fix')
      .slice(0, 3);
  }, [result.anti_virality_gated, buckets.counterfactual]);

  const topFixesKeys = useMemo(
    () => new Set(topFixesShown.map((s) => `${s.timestamp_ms}-${s.headline}`)),
    [topFixesShown],
  );

  // Plain list = full counterfactual list MINUS items already shown in TopFixesList.
  // In NON-AV state, topFixesKeys is empty so the plain list shows everything.
  const plainList = useMemo(
    () =>
      buckets.counterfactual.filter(
        (s) => !topFixesKeys.has(`${s.timestamp_ms}-${s.headline}`),
      ),
    [buckets.counterfactual, topFixesKeys],
  );

  const handleToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      if (event.currentTarget.open) {
        // logger has no .event method — use logger.info per Plan 5.2 precedent
        logger.info(TELEMETRY.VERDICT_REASONING_EXPANDED, {
          score: result.overall_score,
        });
      }
    },
    [result.overall_score],
  );

  // Counterfactual sub-section is visible when EITHER TopFixesList has items OR the plain list has items.
  const showCounterfactualSection =
    topFixesShown.length > 0 || plainList.length > 0;

  return (
    <details
      open={defaultOpen || undefined}
      onToggle={handleToggle}
      className="group rounded-[8px] border border-white/[0.06] bg-white/[0.02] open:bg-white/[0.04]"
      data-testid="why-verdict-collapsible"
    >
      <summary
        className="flex cursor-pointer items-center justify-between p-2 text-sm font-medium list-none min-h-10"
      >
        <span>{COPY.WHY_VERDICT_SUMMARY}</span>
        <CaretDown size={12} className="opacity-60 motion-safe:transition-transform group-open:rotate-180" />
      </summary>

      <div className="p-3 pt-0 text-xs">
        {/* Intro paragraph — markdown w/ XSS sanitization.
            prose-xs is unavailable in Tailwind v4; explicit utility classes applied instead. */}
        {buckets.intro && (
          <div
            className="mb-3 max-w-none leading-[1.45] [&_p]:mb-2 [&_p]:leading-[1.45]"
            data-testid="why-verdict-intro"
          >
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{buckets.intro}</ReactMarkdown>
          </div>
        )}

        {/* Sub-section: Why this works */}
        {buckets.works.length > 0 && (
          <section className="mb-2" data-testid="sub-works">
            <h4 className="text-[10px] uppercase tracking-[0.04em] text-white/50 mb-1 font-normal">
              {COPY.SUB_WORKS}
            </h4>
            <ul className="flex flex-col space-y-1.5">
              {buckets.works.map((f) => (
                <li key={f.name} className="text-xs leading-[1.45]">
                  <span className="font-medium">{f.name}: </span>
                  <span className="text-foreground-muted">{f.rationale}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sub-section: Why this might not */}
        {buckets.mightNot.length > 0 && (
          <section className="mb-2" data-testid="sub-might-not">
            <h4 className="text-[10px] uppercase tracking-[0.04em] text-white/50 mb-1 font-normal">
              {COPY.SUB_MIGHT_NOT}
            </h4>
            <ul className="flex flex-col space-y-1.5">
              {buckets.mightNot.map((f) => (
                <li key={f.name} className="text-xs leading-[1.45]">
                  <span className="font-medium">{f.name}: </span>
                  <span className="text-foreground-muted">{f.improvement_tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sub-section: What the engine flagged */}
        {buckets.flagged.length > 0 && (
          <section className="mb-2" data-testid="sub-flagged">
            <h4 className="text-[10px] uppercase tracking-[0.04em] text-white/50 mb-1 font-normal">
              {COPY.SUB_FLAGGED}
            </h4>
            <ul className="flex flex-col space-y-1.5">
              {buckets.flagged.map((w, i) => (
                <li key={i} className="text-xs leading-[1.45] text-foreground-muted">
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sub-section: Counterfactual considered.
            W3: In AV state, TopFixesList renders top-3 fixes; the plain list below
            FILTERS OUT items already shown in TopFixesList so they don't render twice.
            If the plain list is empty after filtering, omit it entirely.
            In NON-AV state, TopFixesList is hidden and the plain list shows everything. */}
        {showCounterfactualSection && (
          <section data-testid="sub-counterfactual">
            <h4 className="text-[10px] font-normal uppercase tracking-[0.04em] text-white/50 mb-1">
              {COPY.SUB_COUNTERFACTUAL}
            </h4>

            {/* Top-3 fixes ONLY when anti_virality_gated */}
            {result.anti_virality_gated && topFixesShown.length > 0 && (
              <TopFixesList suggestions={buckets.counterfactual} />
            )}

            {/* Plain counterfactuals list (fix + stretch) — excludes items
                already rendered in TopFixesList per W3. */}
            {plainList.length > 0 && (
              <ul className="flex flex-col gap-1 mt-2" data-testid="counterfactual-plain-list">
                {plainList.map((s, i) => (
                  <li key={`${s.timestamp_ms}-${i}`} className="text-xs">
                    <span className="font-medium">{s.headline}</span>
                    <span className="text-foreground-muted"> — {s.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </details>
  );
}
