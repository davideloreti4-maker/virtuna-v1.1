'use client';

import { cn } from '@/lib/utils';
import { useTestStore, type SimulationPhase } from '@/stores/test-store';
import { Check } from 'lucide-react';

/**
 * Phase configuration for the loading display
 */
const PHASES: { id: SimulationPhase; label: string }[] = [
  { id: 'analyzing', label: 'Analyzing content...' },
  { id: 'matching', label: 'Matching profiles...' },
  { id: 'simulating', label: 'Running simulation...' },
  { id: 'generating', label: 'Generating insights...' },
];

/**
 * LoadingPhases - Displays 4-phase loading progress during AI simulation
 *
 * Shows:
 * - 4 phases with status indicators (checkmark for complete, pulse for current)
 * - Progress bar showing overall progress (0-100%)
 * - Cancel button to abort simulation
 */
export function LoadingPhases() {
  const simulationPhase = useTestStore((s) => s.simulationPhase);
  const phaseProgress = useTestStore((s) => s.phaseProgress);
  const cancelSimulation = useTestStore((s) => s.cancelSimulation);

  // Find current phase index (-1 if null)
  const currentPhaseIndex = simulationPhase
    ? PHASES.findIndex((p) => p.id === simulationPhase)
    : -1;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      {/* Header */}
      <h3 className="mb-4 text-sm font-medium text-zinc-400">
        Running Simulation
      </h3>

      {/* Phase list */}
      <div className="space-y-3">
        {PHASES.map((phase, index) => {
          const isComplete = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;
          const isPending = index > currentPhaseIndex;

          return (
            <div key={phase.id} className="flex items-center gap-3">
              {/* Status indicator */}
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full transition-colors',
                  isComplete && 'bg-emerald-500',
                  isCurrent && 'bg-emerald-500/20',
                  isPending && 'bg-zinc-800'
                )}
              >
                {isComplete ? (
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                ) : isCurrent ? (
                  <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                ) : null}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-sm transition-colors',
                  isCurrent && 'font-medium text-white',
                  isComplete && 'text-zinc-400',
                  isPending && 'text-zinc-600'
                )}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${phaseProgress}%` }}
          />
        </div>
        <p className="mt-2 text-right text-xs text-zinc-500">
          {phaseProgress}% complete
        </p>
      </div>

      {/* Cancel button */}
      <button
        type="button"
        onClick={cancelSimulation}
        className={cn(
          'mt-4 w-full rounded-xl px-4 py-2.5',
          'border border-zinc-700 bg-transparent text-zinc-400',
          'text-sm font-medium',
          'transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900'
        )}
      >
        Cancel
      </button>
    </div>
  );
}
