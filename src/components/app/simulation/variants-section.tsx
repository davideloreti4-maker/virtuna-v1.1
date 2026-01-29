'use client';

import { cn } from '@/lib/utils';
import { Info, Sparkles } from 'lucide-react';
import type { Variant } from '@/types/test';

interface VariantsSectionProps {
  variants: Variant[];
}

/**
 * VariantsSection - Displays content variants (original + AI-generated)
 *
 * Matches societies.io layout:
 * - Vertical list with variant label/preview on left, score on right
 * - Original content distinct from AI variants
 * - Generate new variants button at bottom
 */
export function VariantsSection({ variants }: VariantsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-400">Variants</h3>
        <Info className="h-4 w-4 text-zinc-500" />
      </div>

      <div className="space-y-2">
        {variants.map((variant) => (
          <div
            key={variant.id}
            className={cn(
              'flex items-center justify-between rounded-xl border p-3',
              variant.type === 'original'
                ? 'border-zinc-700 bg-zinc-800/50'
                : 'border-zinc-700 bg-zinc-900'
            )}
          >
            {/* Left side: label and preview */}
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">
                  {variant.type === 'original' ? 'Original' : variant.label}
                </span>
                {variant.type === 'ai-generated' && (
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                )}
              </div>
              <p className="text-xs text-zinc-500 truncate">
                {variant.content}
              </p>
            </div>

            {/* Right side: score */}
            <span className="text-2xl font-bold text-white flex-shrink-0">
              {variant.impactScore}
            </span>
          </div>
        ))}
      </div>

      {/* Generate button - UI only for now */}
      <button
        type="button"
        onClick={() => {
          // Future: generate new variants
          console.log('Generate new variants - coming soon');
        }}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl p-3',
          'border border-dashed border-zinc-700',
          'text-sm text-zinc-400',
          'transition-colors hover:border-zinc-500 hover:text-white'
        )}
      >
        <Sparkles className="h-4 w-4" />
        Generate New Variants
      </button>
    </div>
  );
}
