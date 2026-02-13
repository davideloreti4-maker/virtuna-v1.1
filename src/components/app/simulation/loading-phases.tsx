'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { GlassCard } from '@/components/ui/card';
import { GlassSkeleton, SkeletonText } from '@/components/primitives';
import { Button } from '@/components/ui/button';
import type { SimulationPhase } from '@/stores/test-store';

/**
 * Phase order for mapping simulation progress to skeleton visibility.
 */
const PHASE_ORDER: SimulationPhase[] = [
  'analyzing',
  'matching',
  'simulating',
  'generating',
];

// ---------------------------------------------------------------------------
// Section skeleton components -- mirror the stacked-card results layout
// ---------------------------------------------------------------------------

/** ImpactScore section skeleton */
function ImpactScoreSkeleton() {
  return (
    <GlassCard padding="md" blur="none">
      <GlassSkeleton width="120px" height="14px" />
      <GlassSkeleton width="80px" height="12px" className="mt-2" />
      <GlassSkeleton width="160px" height="48px" className="mt-3" />
    </GlassCard>
  );
}

/** AttentionBreakdown section skeleton */
function AttentionSkeleton() {
  return (
    <GlassCard padding="md" blur="none">
      <GlassSkeleton width="160px" height="14px" />
      <div className="mt-4 space-y-4">
        {[1, 2, 3].map((i) => (
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

/** Variants section skeleton */
function VariantsSkeleton() {
  return (
    <GlassCard padding="md" blur="none">
      <GlassSkeleton width="80px" height="14px" />
      <div className="mt-3 space-y-2">
        {[1, 2].map((i) => (
          <GlassSkeleton key={i} shape="rectangle" height={64} />
        ))}
      </div>
    </GlassCard>
  );
}

/** Insights + Themes combined section skeleton */
function InsightsThemesSkeleton() {
  return (
    <>
      {/* Insights */}
      <GlassCard padding="md" blur="none">
        <GlassSkeleton width="80px" height="14px" />
        <SkeletonText lines={3} className="mt-3" />
      </GlassCard>

      {/* Themes */}
      <GlassCard padding="md" blur="none">
        <GlassSkeleton width="120px" height="14px" />
        <div className="mt-3 space-y-2">
          {[1, 2].map((i) => (
            <GlassSkeleton key={i} shape="rectangle" height={48} />
          ))}
        </div>
      </GlassCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Section configuration -- maps each simulation phase to its skeleton
// ---------------------------------------------------------------------------

interface SectionConfig {
  phase: SimulationPhase;
  skeleton: React.ReactNode;
}

const SECTIONS: SectionConfig[] = [
  { phase: 'analyzing', skeleton: <ImpactScoreSkeleton /> },
  { phase: 'matching', skeleton: <AttentionSkeleton /> },
  { phase: 'simulating', skeleton: <VariantsSkeleton /> },
  { phase: 'generating', skeleton: <InsightsThemesSkeleton /> },
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
 * fades in as its corresponding simulation phase activates, providing
 * visual continuity between loading and results states.
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
