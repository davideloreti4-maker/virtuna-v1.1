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
 * Features:
 * - Horizontal scrollable card row
 * - Original content card distinct from AI variants
 * - Impact score displayed on each card
 * - Generate new variants button (UI only for now)
 */
export function VariantsSection({ variants }: VariantsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-400">Variants</h3>
        <Info className="h-4 w-4 text-zinc-500" />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {variants.map((variant) => (
          <div
            key={variant.id}
            className={cn(
              'flex-shrink-0 w-48 rounded-xl border p-4',
              variant.type === 'original'
                ? 'border-zinc-700 bg-zinc-800/50'
                : 'border-zinc-700 bg-zinc-900'
            )}
          >
            {/* Score */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-white">
                {variant.impactScore}
              </span>
              {variant.type === 'ai-generated' && (
                <Sparkles className="h-4 w-4 text-purple-400" />
              )}
            </div>

            {/* Label */}
            <p className="mb-2 text-xs font-medium text-zinc-500">
              {variant.type === 'original' ? 'Original' : variant.label}
            </p>

            {/* Content preview */}
            <p className="line-clamp-3 text-sm text-zinc-400">
              {variant.content}
            </p>
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
          'flex items-center gap-2 text-sm text-zinc-400',
          'transition-colors hover:text-white'
        )}
      >
        <Sparkles className="h-4 w-4" />
        Generate New Variants
      </button>
    </div>
  );
}
