'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { WEIGHT_PRESETS, WEIGHT_PRESET_EPSILON } from './audience-constants';
import { rebalance, weightsEqual } from './use-client-weights';
import {
  DEFAULT_PERSONA_WEIGHT_CONFIG,
  type PersonaWeights,
} from '@/lib/engine/persona-weights';

export interface WeightOverrideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  currentWeights: PersonaWeights;
  onWeightsChange: (w: PersonaWeights) => void;
  onApply: (w: PersonaWeights, saveAsDefault: boolean) => Promise<void>;
}

type PresetKey = 'default' | 'established' | 'niche_heavy' | 'new_creator';

const PRESET_LABELS: Record<PresetKey, string> = {
  default: 'Default mix',
  established: 'Established creator',
  niche_heavy: 'Niche-heavy',
  new_creator: 'New creator',
};

const SLIDER_LABELS: Array<{ key: keyof PersonaWeights; label: string }> = [
  { key: 'fyp', label: 'FYP non-followers' },
  { key: 'niche', label: 'Niche-aligned' },
  { key: 'loyalist', label: 'Loyalist' },
  { key: 'cross_niche', label: 'Cross-niche' },
];

function getActivePreset(weights: PersonaWeights): PresetKey | 'custom' {
  for (const [key, preset] of Object.entries(WEIGHT_PRESETS) as Array<[PresetKey, PersonaWeights]>) {
    if (weightsEqual(weights, preset, WEIGHT_PRESET_EPSILON)) return key;
  }
  return 'custom';
}

/**
 * WeightOverrideDrawer — preset chips + 4 sliders + Apply / Save-as-default / Reset.
 * D-18 / D-19 / D-20 / D-21 (CONTEXT.md).
 */
export function WeightOverrideDrawer({
  open,
  onOpenChange,
  currentWeights,
  onWeightsChange,
  onApply,
}: WeightOverrideDrawerProps) {
  const isMobile = useIsMobile();
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const initialWeights = DEFAULT_PERSONA_WEIGHT_CONFIG.default;
  const isDirty = !weightsEqual(currentWeights, initialWeights, WEIGHT_PRESET_EPSILON);
  // Desktop: side="right", 320px panel
  // Mobile: side="bottom", 70dvh sheet
  const drawerSide: 'right' | 'bottom' = isMobile ? 'bottom' : 'right';
  const activePreset = getActivePreset(currentWeights);
  const sumPct = Math.round(
    (currentWeights.fyp + currentWeights.niche + currentWeights.loyalist + currentWeights.cross_niche) * 100,
  );

  function handlePresetClick(key: PresetKey) {
    onWeightsChange(WEIGHT_PRESETS[key]);
  }

  function handleSliderChange(key: keyof PersonaWeights, rawValue: string) {
    const newValue = Number(rawValue) / 100;
    onWeightsChange(rebalance(currentWeights, key, newValue));
  }

  function handleReset() {
    onWeightsChange(DEFAULT_PERSONA_WEIGHT_CONFIG.default);
  }

  async function handleApply() {
    setIsApplying(true);
    try {
      await onApply(currentWeights, saveAsDefault);
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={drawerSide}
        className={
          isMobile
            ? 'max-h-[70dvh] overflow-y-auto'
            : 'max-w-[320px]'
        }
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="border-b border-white/[0.06] pb-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold text-foreground">
              Audience Mix
            </SheetTitle>
            <button
              aria-label="Close audience mix override"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* Preset chips */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Presets:</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  aria-pressed={activePreset === key}
                  onClick={() => handlePresetClick(key)}
                  className={[
                    'rounded-md px-3 py-1.5 text-sm border transition-colors',
                    activePreset === key
                      ? 'border-[#FF7F50] text-[#FF7F50] bg-[rgba(255,127,80,0.08)]'
                      : 'border-white/[0.06] text-foreground bg-transparent hover:bg-white/[0.02]',
                  ].join(' ')}
                >
                  {PRESET_LABELS[key]}
                </button>
              ))}
              {/* Custom chip */}
              <button
                aria-pressed={activePreset === 'custom'}
                className={[
                  'rounded-md px-3 py-1.5 text-sm border transition-colors',
                  activePreset === 'custom'
                    ? 'border-[#FF7F50] text-[#FF7F50] bg-[rgba(255,127,80,0.08)]'
                    : 'border-white/[0.06] text-foreground bg-transparent hover:bg-white/[0.02]',
                ].join(' ')}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Sliders */}
          <div className="flex flex-col gap-4">
            {SLIDER_LABELS.map(({ key, label }) => {
              const pct = Math.round(currentWeights[key] * 100);
              return (
                <div key={key} className="flex items-center gap-3">
                  <label
                    htmlFor={`slider-${key}`}
                    className="w-36 shrink-0 text-sm text-foreground-muted"
                  >
                    {label}
                  </label>
                  <input
                    id={`slider-${key}`}
                    role="slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={pct}
                    aria-label={`${label} weight`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    onChange={(e) => handleSliderChange(key, e.target.value)}
                    className="flex-1 h-1 accent-[#FF7F50] cursor-pointer"
                    style={{
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      height: '4px',
                      background: `linear-gradient(to right, #FF7F50 ${pct}%, rgba(255,255,255,0.10) ${pct}%)`,
                      borderRadius: '9999px',
                    }}
                  />
                  <span className="w-9 text-right text-sm tabular-nums text-foreground">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Sum display */}
          <div
            aria-live="polite"
            className="text-right text-sm tabular-nums"
            style={{ color: sumPct === 100 ? 'var(--color-foreground-muted)' : '#E05252' }}
          >
            Sum: {sumPct}%{sumPct === 100 ? ' ✓' : ''}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="border-t border-white/[0.06] pt-3 gap-3">
          {/* Save as default checkbox */}
          <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
              aria-label="Save as my default for future analyses"
              className="rounded border-white/[0.06] accent-[#FF7F50]"
            />
            Save as my default for future analyses
          </label>

          <div className="flex items-center justify-between gap-2">
            {/* Reset */}
            <button
              onClick={handleReset}
              aria-label="Reset to defaults"
              className="text-sm bg-transparent border border-white/[0.06] rounded-md px-3 py-1.5 text-foreground-muted hover:text-[#E05252] transition-colors"
            >
              Reset to defaults
            </button>

            {/* Apply */}
            <button
              onClick={handleApply}
              disabled={!isDirty || isApplying}
              aria-label="Apply Audience Mix"
              className="text-sm rounded-md px-4 py-1.5 bg-[rgba(255,127,80,0.12)] border border-[#FF7F50] text-[#FF7F50] hover:bg-[rgba(255,127,80,0.20)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isApplying ? 'Applying…' : 'Apply Audience Mix'}
            </button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
