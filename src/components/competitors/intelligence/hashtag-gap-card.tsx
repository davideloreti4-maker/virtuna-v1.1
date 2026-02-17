import type { HashtagGap } from "@/lib/ai/types";

interface HashtagGapCardProps {
  data: HashtagGap | null;
}

/**
 * Hashtag gap analysis display card (INTL-03).
 *
 * Compares competitor-only, user-only, and shared hashtags
 * with AI-generated recommendations.
 * Server-compatible component — no "use client".
 */
export function HashtagGapCard({ data }: HashtagGapCardProps) {
  if (!data) return null;

  const isEmpty =
    data.competitor_only.length === 0 &&
    data.user_only.length === 0 &&
    data.shared.length === 0;

  if (isEmpty) {
    return (
      <div className="border border-white/[0.06] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-4">
          Hashtag Gap Analysis
        </h3>
        <p className="text-sm text-foreground-muted text-center py-6">
          No significant hashtag differences found
        </p>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-4">
        Hashtag Gap Analysis
      </h3>

      <div className="space-y-5">
        {/* Competitor Only */}
        {data.competitor_only.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-foreground mb-2">
              Competitor Uses (You Don&apos;t)
            </h4>
            <div className="space-y-2">
              {data.competitor_only.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-b-0"
                >
                  <span className="text-sm font-medium text-[var(--color-accent)] shrink-0">
                    #{h.tag}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground-muted shrink-0">
                    {h.count}x
                  </span>
                  <p className="text-xs text-foreground-muted flex-1">
                    {h.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Only */}
        {data.user_only.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-foreground mb-2">
              You Use (Competitor Doesn&apos;t)
            </h4>
            <div className="space-y-2">
              {data.user_only.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-b-0"
                >
                  <span className="text-sm font-medium text-foreground shrink-0">
                    #{h.tag}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground-muted shrink-0">
                    {h.count}x
                  </span>
                  <p className="text-xs text-foreground-muted flex-1">
                    {h.assessment}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared */}
        {data.shared.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-foreground mb-2">
              Shared Hashtags
            </h4>
            <div className="space-y-1">
              {data.shared.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-b-0"
                >
                  <span className="text-sm text-foreground shrink-0">
                    #{h.tag}
                  </span>
                  <div className="flex gap-2 text-xs text-foreground-muted">
                    <span>Them: {h.competitor_count}x</span>
                    <span className="text-white/[0.1]">|</span>
                    <span>You: {h.user_count}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overall Recommendation */}
        {data.overall_recommendation && (
          <div className="border-t border-white/[0.06] pt-4 mt-4">
            <p className="text-sm text-foreground-muted leading-relaxed">
              {data.overall_recommendation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
