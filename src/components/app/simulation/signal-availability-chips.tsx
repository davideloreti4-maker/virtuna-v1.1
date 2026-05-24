'use client';

import type { SignalAvailability } from '@/lib/engine/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =====================================================
// Phase 13 Plan 02 — SignalAvailabilityChips three-state (D-30)
// States: available=success ✓, disabled=default ✕ (line-through opacity-40), failed=warning ⚠
// D-14, D-15, Phase 10 D-05 — ml, retrieval, rules are intentionally disabled in M1.
// =====================================================

/** Three-state discriminant for chip rendering. */
export type SignalState = 'available' | 'disabled' | 'failed';

const STATE_STYLES: Record<SignalState, {
  variant: 'success' | 'default' | 'warning';
  symbol: string;
  className: string;
}> = {
  available: { variant: 'success', symbol: '✓', className: '' },
  disabled:  { variant: 'default', symbol: '✕', className: 'line-through opacity-40' },
  failed:    { variant: 'warning', symbol: '⚠', className: '' },
};

// D-14, D-15, Phase 10 D-05 — these are intentionally disabled in M1.
// ml: Phase 10 audit disabled ML classifier contribution (ml weight=0).
// rules: D-14 — all 17 regex rules operate on caption text; weight=0 in video-mode.
// retrieval: D-15 — corpus embeddings are caption-derived; weight=0 in video-mode.
const DISABLED_THIS_PHASE = new Set<string>(['ml', 'rules', 'retrieval']);

/**
 * Derive SignalState for a given key from the availability object.
 * Three-value support: when backend sends a SignalState string, use it directly.
 * Boolean back-compat: true → available, false → failed.
 * DISABLED_THIS_PHASE always returns 'disabled' regardless of signal value.
 */
function deriveState(
  key: string,
  availability: SignalAvailability | undefined,
): SignalState {
  if (DISABLED_THIS_PHASE.has(key)) return 'disabled';
  const value = (availability as Record<string, unknown> | undefined)?.[key];
  // Three-state support: when backend sends a SignalState string, use it directly.
  if (value === 'available' || value === 'disabled' || value === 'failed') return value;
  // Boolean back-compat (current backend shape): true → available, false → failed.
  if (value === true) return 'available';
  return 'failed';
}

/** Ordered list of signals to show in the chip row (D-30 + D-02).
 *  Keys must match SignalAvailability interface exactly.
 *  Order: Audio, Personas, Retrieval, ML — same as Phase 11. */
const CHIP_SIGNALS: Array<{ key: string; label: string }> = [
  { key: 'audio', label: 'Audio' },
  { key: 'personas', label: 'Personas' },
  { key: 'retrieval', label: 'Retrieval' },
  { key: 'ml', label: 'ML' },
];

interface SignalAvailabilityChipsProps {
  signalAvailability: SignalAvailability;
  className?: string;
}

/** Horizontal chip row showing signal states for this prediction (D-30).
 *  Available → Badge variant="success" ✓.
 *  Disabled (M1 design choice) → Badge variant="default" + line-through opacity-40 ✕.
 *  Failed (transient) → Badge variant="warning" ⚠. */
export function SignalAvailabilityChips({
  signalAvailability,
  className,
}: SignalAvailabilityChipsProps) {
  return (
    <div
      data-testid="signal-availability-chips"
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {CHIP_SIGNALS.map(({ key, label }) => {
        const state = deriveState(key, signalAvailability);
        const styles = STATE_STYLES[state];
        return (
          <Badge
            key={key}
            variant={styles.variant}
            size="sm"
            className={styles.className}
          >
            {label} {styles.symbol}
          </Badge>
        );
      })}
    </div>
  );
}
