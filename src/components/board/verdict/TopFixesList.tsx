'use client';
import { useBoardStore } from '@/stores/board-store';
import type { CounterfactualSuggestionItem } from '@/lib/engine/types';

interface TopFixesListProps {
  suggestions: ReadonlyArray<CounterfactualSuggestionItem>;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function TopFixesList({ suggestions }: TopFixesListProps) {
  const setActivePreset = useBoardStore((s) => s.setActivePreset);

  // Filter to type='fix' only (TopFixesList is strictly the top-3 fix anchors per D-08).
  const fixes = suggestions.filter((s) => s.type === 'fix').slice(0, 3);

  if (fixes.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5" data-testid="top-fixes-list">
      {fixes.map((fix, idx) => (
        <li
          key={`${fix.timestamp_ms}-${idx}`}
          className="rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-2"
          data-testid="top-fix-item"
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => setActivePreset('audience')}
              className="rounded-[4px] border px-1.5 py-0.5 text-[10px]"
              style={{
                borderColor: 'rgba(255, 127, 80, 0.3)', // accent/30
                color: 'var(--color-accent)',
              }}
              aria-label={`Jump to ${formatTime(fix.timestamp_ms)} on audience filmstrip`}
              data-testid="top-fix-timestamp"
            >
              [seg · {formatTime(fix.timestamp_ms)}]
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs font-medium" data-testid="top-fix-headline">
                {fix.headline}
              </span>
              <span className="text-xs text-foreground-muted" data-testid="top-fix-detail">
                {fix.detail}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
