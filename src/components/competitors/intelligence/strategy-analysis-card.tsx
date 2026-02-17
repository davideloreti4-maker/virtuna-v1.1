import type { StrategyAnalysis } from "@/lib/ai/types";

interface StrategyAnalysisCardProps {
  data: StrategyAnalysis | null;
}

/**
 * Strategy analysis display card (INTL-01).
 *
 * Shows hooks, content series, psychological triggers,
 * overall strategy, and strengths/weaknesses.
 * Server-compatible component — no "use client".
 */
export function StrategyAnalysisCard({ data }: StrategyAnalysisCardProps) {
  if (!data) return null;

  return (
    <div className="border border-white/[0.06] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-4">
        Overall Strategy
      </h3>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-6">
        {data.overall_strategy}
      </p>

      {/* Content Hooks */}
      {data.hooks.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
            Content Hooks
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.hooks.map((hook, i) => (
              <div
                key={i}
                className="border border-white/[0.06] rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {hook.pattern}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground-muted">
                    {hook.frequency}x
                  </span>
                </div>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  &ldquo;{hook.example}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Series */}
      {data.content_series.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
            Content Series
          </h3>
          <div className="space-y-2">
            {data.content_series.map((series, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">
                    {series.name}
                  </span>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {series.description}
                  </p>
                </div>
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground-muted">
                  {series.video_count} videos
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Psychological Triggers */}
      {data.psychological_triggers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
            Psychological Triggers
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.psychological_triggers.map((trigger, i) => (
              <span
                key={i}
                className="text-xs px-3 py-1 rounded-full bg-white/[0.06] text-foreground"
              >
                {trigger}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strengths / Weaknesses */}
      {(data.strengths.length > 0 || data.weaknesses.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.strengths.length > 0 && (
            <div className="rounded-lg border border-green-500/10 bg-green-500/[0.03] p-3">
              <h3 className="text-sm font-semibold text-green-400 mb-2">
                Strengths
              </h3>
              <ul className="space-y-1">
                {data.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="text-xs text-foreground-muted flex gap-2"
                  >
                    <span className="text-green-400 shrink-0">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.weaknesses.length > 0 && (
            <div className="rounded-lg border border-red-500/10 bg-red-500/[0.03] p-3">
              <h3 className="text-sm font-semibold text-red-400 mb-2">
                Weaknesses
              </h3>
              <ul className="space-y-1">
                {data.weaknesses.map((w, i) => (
                  <li
                    key={i}
                    className="text-xs text-foreground-muted flex gap-2"
                  >
                    <span className="text-red-400 shrink-0">-</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
