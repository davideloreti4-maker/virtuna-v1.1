'use client';

import type { SignalAvailability } from '@/lib/engine/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Ordered list of signals to show in the chip row (D-02).
 *  Keys must match SignalAvailability interface exactly.
 *  Only these 4 are shown — other availability keys are internal. */
const CHIP_SIGNALS: Array<{ key: keyof SignalAvailability; label: string }> = [
  { key: 'audio', label: 'Audio' },
  { key: 'personas', label: 'Personas' },
  { key: 'retrieval', label: 'Retrieval' },
  { key: 'ml', label: 'ML' },
];

interface SignalAvailabilityChipsProps {
  signalAvailability: SignalAvailability;
  className?: string;
}

/** Horizontal chip row showing which signals fired on this prediction (D-02).
 *  Available signals → Badge variant="success" ✓.
 *  Unavailable → Badge variant="default" + line-through opacity-40 ✕. */
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
        const available = (signalAvailability[key] as boolean | undefined) ?? false;
        return (
          <Badge
            key={key}
            variant={available ? 'success' : 'default'}
            size="sm"
            className={available ? '' : 'line-through opacity-40'}
          >
            {label} {available ? '✓' : '✕'}
          </Badge>
        );
      })}
    </div>
  );
}
