'use client';

import { Info, Sparkles } from 'lucide-react';
import type { Variant } from '@/types/test';
import { GlassCard } from '@/components/primitives';
import { Text } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface VariantsSectionProps {
  variants: Variant[];
}

/**
 * VariantsSection - Displays content variants (original + AI-generated)
 *
 * Uses GlassCard wrapper with design token-styled variant rows.
 * - Vertical list with variant label/preview on left, score on right
 * - Badge + Sparkles icon for AI-generated variants
 * - Ghost Button with dashed border for generate action
 */
export function VariantsSection({ variants }: VariantsSectionProps) {
  return (
    <GlassCard padding="md" hover="lift" blur="none">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" muted>
            Variants
          </Text>
          <Info className="h-4 w-4 text-foreground-muted" />
        </div>

        <div className="space-y-2">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className={
                variant.type === 'original'
                  ? 'flex items-center justify-between rounded-xl border border-border bg-surface-elevated/50 p-3'
                  : 'flex items-center justify-between rounded-xl border border-border bg-surface p-3'
              }
            >
              {/* Left side: label and preview */}
              <div className="min-w-0 flex-1 pr-4">
                <div className="mb-1 flex items-center gap-2">
                  <Text as="span" size="sm" className="font-medium">
                    {variant.type === 'original' ? 'Original' : variant.label}
                  </Text>
                  {variant.type === 'ai-generated' && (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                      <Badge variant="accent" size="sm">
                        AI
                      </Badge>
                    </>
                  )}
                </div>
                <Text as="p" size="sm" muted className="truncate">
                  {variant.content}
                </Text>
              </div>

              {/* Right side: score */}
              <Text as="span" size="lg" className="flex-shrink-0 text-xl font-bold">
                {variant.impactScore}
              </Text>
            </div>
          ))}
        </div>

        {/* Generate button */}
        <Button
          variant="ghost"
          size="md"
          className="w-full border border-dashed border-border hover:border-foreground-muted"
          onClick={() => {
            // Future: generate new variants
            console.log('Generate new variants - coming soon');
          }}
        >
          <Sparkles className="h-4 w-4" />
          Generate New Variants
        </Button>
      </div>
    </GlassCard>
  );
}
