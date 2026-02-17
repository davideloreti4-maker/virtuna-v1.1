import {
  VideoCamera,
  Clock,
  Lightning,
  Palette,
} from "@phosphor-icons/react/dist/ssr";
import type { Recommendations } from "@/lib/ai/types";

interface RecommendationsCardProps {
  data: Recommendations | null;
}

const categoryIcons: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  format: VideoCamera,
  timing: Clock,
  hooks: Lightning,
  content_style: Palette,
};

const categoryLabels: Record<string, string> = {
  format: "Format",
  timing: "Timing",
  hooks: "Hooks",
  content_style: "Content Style",
};

const priorityStyles: Record<string, string> = {
  high: "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-white/[0.06] text-foreground-muted",
};

/**
 * Personalized recommendations display card (INTL-04).
 *
 * Groups recommendations by category with priority badges
 * and actionable checklists. Sorted by priority (high first).
 * Server-compatible component — no "use client".
 */
export function RecommendationsCard({ data }: RecommendationsCardProps) {
  if (!data) return null;

  // Sort by priority: high -> medium -> low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...data.recommendations].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // Group by category
  const grouped = sorted.reduce(
    (acc, rec) => {
      const key = rec.category;
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(rec);
      return acc;
    },
    {} as Record<string, typeof sorted>
  );

  return (
    <div className="border border-white/[0.06] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
        Recommendations
      </h3>

      {/* Summary */}
      <p className="text-sm text-foreground-muted leading-relaxed mb-5">
        {data.summary}
      </p>

      {/* Recommendations grouped by category */}
      <div className="space-y-5">
        {Object.entries(grouped).map(([category, recs]) => {
          const IconComponent = categoryIcons[category];
          const label = categoryLabels[category] ?? category;

          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                {IconComponent && (
                  <IconComponent
                    size={16}
                    className="text-foreground-muted"
                  />
                )}
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  {label}
                </h4>
              </div>

              <div className="space-y-3">
                {recs.map((rec, i) => (
                  <div
                    key={i}
                    className="border border-white/[0.06] rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {rec.title}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityStyles[rec.priority] ?? priorityStyles.low}`}
                      >
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-muted leading-relaxed mb-2">
                      {rec.description}
                    </p>

                    {/* Action items checklist */}
                    {rec.action_items.length > 0 && (
                      <ul className="space-y-1">
                        {rec.action_items.map((item, j) => (
                          <li
                            key={j}
                            className="text-xs text-foreground-muted flex gap-2"
                          >
                            <span className="text-foreground-muted shrink-0">
                              []
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
