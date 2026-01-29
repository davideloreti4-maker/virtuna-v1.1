'use client';

import { Info } from 'lucide-react';

interface AttentionBreakdownProps {
  attention: {
    full: number;
    partial: number;
    ignore: number;
  };
}

/**
 * AttentionBreakdown - Displays audience attention distribution
 *
 * Features:
 * - Horizontal stacked progress bar with 3 segments
 * - Full (emerald), Partial (amber), Ignore (zinc) color coding
 * - Legend with percentages for each segment
 */
export function AttentionBreakdown({ attention }: AttentionBreakdownProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-400">Attention</h3>
        <Info className="h-4 w-4 text-zinc-500" />
      </div>

      {/* Stacked bar - Red/Amber/Gray to match societies.io reference */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${attention.full}%` }}
        />
        <div
          className="bg-amber-400 transition-all"
          style={{ width: `${attention.partial}%` }}
        />
        <div
          className="bg-zinc-600 transition-all"
          style={{ width: `${attention.ignore}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-zinc-400">Full</span>
          <span className="font-medium text-white">{attention.full}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-zinc-400">Partial</span>
          <span className="font-medium text-white">{attention.partial}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-zinc-600" />
          <span className="text-zinc-400">Ignore</span>
          <span className="font-medium text-white">{attention.ignore}%</span>
        </div>
      </div>
    </div>
  );
}
