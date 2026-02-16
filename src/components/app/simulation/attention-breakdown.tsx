'use client';

import { Info } from 'lucide-react';
import { GlassCard } from '@/components/ui/card';
import { GlassProgress } from '@/components/primitives';
import { Text } from '@/components/ui/typography';

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
 * Uses 3 individual GlassProgress bars (coral, blue, purple) instead of a segmented bar.
 * Each bar has a label row above it with metric name and percentage.
 */
export function AttentionBreakdown({ attention }: AttentionBreakdownProps) {
  return (
    <GlassCard className="p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" muted>
            Attention
          </Text>
          <Info className="h-4 w-4 text-foreground-muted" />
        </div>

        {/* Individual progress bars */}
        <div className="space-y-3">
          {/* Full Attention */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Text as="span" size="sm" muted>
                Full
              </Text>
              <Text as="span" size="sm" className="font-medium">
                {attention.full}%
              </Text>
            </div>
            <GlassProgress value={attention.full} variant="accent" size="md" />
          </div>

          {/* Partial Attention */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Text as="span" size="sm" muted>
                Partial
              </Text>
              <Text as="span" size="sm" className="font-medium">
                {attention.partial}%
              </Text>
            </div>
            <GlassProgress value={attention.partial} size="md" />
          </div>

          {/* Ignored */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Text as="span" size="sm" muted>
                Ignored
              </Text>
              <Text as="span" size="sm" className="font-medium">
                {attention.ignore}%
              </Text>
            </div>
            <GlassProgress value={attention.ignore} size="md" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
