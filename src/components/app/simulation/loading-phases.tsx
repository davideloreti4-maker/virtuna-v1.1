'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { GlassCard } from '@/components/ui/card';
import { GlassSkeleton, SkeletonText } from '@/components/primitives';
import { Button } from '@/components/ui/button';
import type { SimulationPhase } from '@/stores/test-store';

/**
 * v2 phase order matching SSE pipeline stages (analyzing -> reasoning -> scoring).
 */
const PHASE_ORDER: SimulationPhase[] = ['analyzing', 'reasoning', 'scoring'];

// ---------------------------------------------------------------------------
// Section skeleton components -- mirror the v2 stacked-card results layout
// ---------------------------------------------------------------------------

/** ImpactScore section skeleton */
function ImpactScoreSkeleton() {
  return (
    <GlassCard className="p-4">
      <GlassSkeleton width="120px" height="14px" />
      <GlassSkeleton width="80px" height="12px" className="mt-2" />
      <GlassSkeleton width="160px" height="48px" className="mt-3" />
    </GlassCard>
  );
}

/** FactorBreakdown section skeleton -- 5 rows of label + progress bar */
function FactorBreakdownSkeleton() {
  return (
    <GlassCard className="p-4">
      <GlassSkeleton width="160px" height="14px" />
      <div className="mt-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <GlassSkeleton width="100px" />
              <GlassSkeleton width="40px" />
            </div>
            <GlassSkeleton shape="rectangle" height={8} />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/** BehavioralPredictions skeleton -- 4 stat cards in 2x2 grid */
function BehavioralPredictionsSkeleton() {
  return (
    <div className="space-y-3">
      <GlassSkeleton width="140px" height="14px" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <GlassCard key={i} className="p-3">
            <div className="flex flex-col gap-1.5">
              <GlassSkeleton width="60px" height="10px" />
              <GlassSkeleton width="48px" height="28px" />
              <GlassSkeleton width="80px" height="10px" />
              <GlassSkeleton shape="rectangle" height={4} />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

/** Suggestions skeleton -- 3 text block skeletons */
function SuggestionsSkeleton() {
  return (
    <GlassCard className="p-4">
      <GlassSkeleton width="100px" height="14px" />
      <div className="mt-3 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5 border-b border-border pb-3 last:border-b-0 last:pb-0">
            <div className="flex justify-between">
              <GlassSkeleton width="70px" height="10px" />
              <GlassSkeleton width="60px" height="18px" />
            </div>
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Section configuration -- maps each v2 simulation phase to its skeleton
// ---------------------------------------------------------------------------

interface SectionConfig {
  phase: SimulationPhase;
  skeleton: React.ReactNode;
}

const SECTIONS: SectionConfig[] = [
  {
    phase: 'analyzing',
    skeleton: (
      <>
        <ImpactScoreSkeleton />
        <FactorBreakdownSkeleton />
      </>
    ),
  },
  { phase: 'reasoning', skeleton: <BehavioralPredictionsSkeleton /> },
  { phase: 'scoring', skeleton: <SuggestionsSkeleton /> },
];

// ---------------------------------------------------------------------------
// LoadingPhases
// ---------------------------------------------------------------------------

interface LoadingPhasesProps {
  simulationPhase: SimulationPhase | null;
  phaseMessage?: string;
  onCancel: () => void;
}

/**
 * LoadingPhases - Skeleton shimmer loading with progressive reveal.
 *
 * Pure presentational component driven by props. Each skeleton section
 * fades in as its corresponding v2 simulation phase activates, providing
 * visual continuity between loading and results states.
 *
 * v2 phases: analyzing -> reasoning -> scoring
 *
 * A cancel button below the skeleton area returns to filling-form state.
 */
export function LoadingPhases({ simulationPhase, phaseMessage, onCancel }: LoadingPhasesProps) {
  const currentIdx = simulationPhase
    ? PHASE_ORDER.indexOf(simulationPhase)
    : -1;

  /** A section is visible once its phase has started (currentIdx >= phaseIdx). */
  const isVisible = (phase: SimulationPhase): boolean =>
    currentIdx >= PHASE_ORDER.indexOf(phase);

  return (
    <div className="space-y-3">
      {phaseMessage && (
        <p className="text-sm text-foreground-muted text-center animate-pulse">
          {phaseMessage}
        </p>
      )}
      <AnimatePresence mode="popLayout">
        {SECTIONS.map(
          (section) =>
            isVisible(section.phase) && (
              <motion.div
                key={section.phase}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.35,
                  ease: [0.215, 0.61, 0.355, 1],
                }}
              >
                {section.skeleton}
              </motion.div>
            )
        )}
      </AnimatePresence>

      {/* Cancel button */}
      <Button
        variant="secondary"
        onClick={onCancel}
        className="mt-4 w-full"
      >
        Cancel
      </Button>
    </div>
  );
}
