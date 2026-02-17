import { formatCount } from "@/lib/competitors-utils";
import type { ViralExplanation } from "@/lib/ai/types";

interface ViralDetectionCardProps {
  data: ViralExplanation | null;
  competitorHandle: string;
}

/**
 * Viral video detection display card (INTL-02).
 *
 * Surfaces videos exceeding 3x average views with AI-generated
 * explanations and key factors. Limits display to top 5.
 * Server-compatible component — no "use client".
 */
export function ViralDetectionCard({
  data,
  competitorHandle,
}: ViralDetectionCardProps) {
  if (!data || data.videos.length === 0) return null;

  const displayVideos = data.videos.slice(0, 5);

  return (
    <div className="border border-white/[0.06] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-4">
        Viral Videos — @{competitorHandle}
      </h3>

      <div className="space-y-4">
        {displayVideos.map((video, i) => (
          <div
            key={i}
            className="border border-white/[0.06] rounded-lg p-4"
          >
            {/* Caption + metrics row */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm text-foreground flex-1 min-w-0">
                {video.caption.length > 80
                  ? `${video.caption.slice(0, 80)}...`
                  : video.caption}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                  {video.viral_multiplier}x avg
                </span>
                <span className="text-xs text-foreground-muted">
                  {formatCount(video.views)} views
                </span>
              </div>
            </div>

            {/* AI explanation */}
            <p className="text-xs text-foreground-muted leading-relaxed mb-2">
              {video.explanation}
            </p>

            {/* Key factors */}
            {video.key_factors.length > 0 && (
              <ul className="space-y-1">
                {video.key_factors.map((factor, j) => (
                  <li
                    key={j}
                    className="text-xs text-foreground-muted flex gap-2"
                  >
                    <span className="text-[var(--color-accent)] shrink-0">
                      *
                    </span>
                    {factor}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
