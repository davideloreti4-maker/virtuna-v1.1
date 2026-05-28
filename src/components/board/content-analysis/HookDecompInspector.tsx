'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { HookDecomposition } from '@/lib/engine/qwen/schemas';
import type { CounterfactualSuggestionItem } from '@/lib/engine/types';
import { HOOK_BAR_LABELS, HOOK_BAR_ORDER, cognitiveLoadBucket } from './content-analysis-constants';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decomp: HookDecomposition | null;
  counterfactuals: ReadonlyArray<CounterfactualSuggestionItem> | undefined;
}

export function HookDecompInspector({ open, onOpenChange, decomp, counterfactuals }: Props) {
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : 'right';

  const hookFixes = (counterfactuals ?? []).filter((s) => s.signal_anchor === 'hook');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'border-white/[0.06] bg-[#18191a]',
          side === 'right' && 'max-w-[360px]',
          side === 'bottom' && 'max-h-[85dvh]',
        )}
        data-testid="hook-decomp-inspector"
      >
        <SheetHeader>
          <SheetTitle className="text-sm font-semibold">Hook decomposition</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex flex-col gap-3 text-xs">
          {decomp ? (
            <>
              {/* Per-modality detail */}
              <section>
                <h3
                  className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                  style={{ color: 'rgba(249,249,249,0.4)' }}
                >
                  Per-modality
                </h3>
                <ul className="flex flex-col gap-2">
                  {HOOK_BAR_ORDER.map((key) => (
                    <li key={key}>
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            key === decomp.weakest_modality && 'text-accent',
                          )}
                        >
                          {HOOK_BAR_LABELS[key]}
                          {key === decomp.weakest_modality && (
                            <span className="ml-1 text-[10px] text-accent">weakest</span>
                          )}
                        </span>
                        <span className="text-xs tabular-nums">{decomp[key].toFixed(1)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Coherence + cognitive load */}
              <section>
                <h3
                  className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                  style={{ color: 'rgba(249,249,249,0.4)' }}
                >
                  Composition
                </h3>
                <div className="flex flex-col gap-1 text-xs">
                  <span>Visual–audio coherence: {decomp.visual_audio_coherence.toFixed(1)}/10</span>
                  <span>Cognitive load: {cognitiveLoadBucket(decomp.cognitive_load)}</span>
                </div>
              </section>

              {/* Fix suggestions */}
              {hookFixes.length > 0 && (
                <section>
                  <h3
                    className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                    style={{ color: 'rgba(249,249,249,0.4)' }}
                  >
                    How to fix
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {hookFixes.slice(0, 3).map((fix, i) => (
                      <li key={`${fix.timestamp_ms}-${i}`}>
                        <span className="text-xs font-medium">{fix.headline}</span>
                        <p className="text-xs text-foreground-muted mt-0.5">{fix.detail}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <p className="text-xs italic text-foreground-muted">
              Hook analysis unavailable.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
