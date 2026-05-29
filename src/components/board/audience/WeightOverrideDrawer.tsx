'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
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
  established: 'Established',
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
 *
 * Board UX overhaul: rendered as an INLINE expander inside the Audience frame
 * (no Sheet/popup) — consistent with the no-overlay rule. Returns null when
 * closed; the parent slots it directly under HeadlineChips where the
 * "Weighted: …" badge lives.
 */
export function WeightOverrideDrawer({
  open,
  onOpenChange,
  currentWeights,
  onWeightsChange,
  onApply,
}: WeightOverrideDrawerProps) {
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const initialWeights = DEFAULT_PERSONA_WEIGHT_CONFIG.default;
  const isDirty = !weightsEqual(currentWeights, initialWeights, WEIGHT_PRESET_EPSILON);
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

  if (!open) return null;

  return (
    <section
      data-testid="weight-override-panel"
      aria-label="Audience mix override"
      className="flex flex-col gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/90">Audience mix</span>
        <button
          type="button"
          aria-label="Close audience mix override"
          onClick={() => onOpenChange(false)}
          className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={activePreset === key}
            onClick={() => handlePresetClick(key)}
            className={[
              'rounded-[6px] border px-2 py-0.5 text-[11px] transition-colors',
              activePreset === key
                ? 'border-[#FF7F50] text-[#FF7F50] bg-[rgba(255,127,80,0.08)]'
                : 'border-white/[0.06] text-white/70 bg-transparent hover:bg-white/[0.05]',
            ].join(' ')}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
        <span
          aria-pressed={activePreset === 'custom'}
          className={[
            'rounded-[6px] border px-2 py-0.5 text-[11px]',
            activePreset === 'custom'
              ? 'border-[#FF7F50] text-[#FF7F50] bg-[rgba(255,127,80,0.08)]'
              : 'border-white/[0.06] text-white/40 bg-transparent',
          ].join(' ')}
        >
          Custom
        </span>
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-2.5">
        {SLIDER_LABELS.map(({ key, label }) => {
          const pct = Math.round(currentWeights[key] * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <label
                htmlFor={`slider-${key}`}
                className="w-28 shrink-0 truncate text-[11px] text-foreground-muted"
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
                className="flex-1 cursor-pointer accent-[#FF7F50]"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  height: '4px',
                  background: `linear-gradient(to right, #FF7F50 ${pct}%, rgba(255,255,255,0.10) ${pct}%)`,
                  borderRadius: '9999px',
                }}
              />
              <span className="w-9 text-right text-[11px] tabular-nums text-white/80">{pct}%</span>
            </div>
          );
        })}
      </div>

      {/* Sum display */}
      <div
        aria-live="polite"
        className="text-right text-[11px] tabular-nums"
        style={{ color: sumPct === 100 ? 'var(--color-foreground-muted)' : '#E05252' }}
      >
        Sum: {sumPct}%{sumPct === 100 ? ' ✓' : ''}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-2.5">
        <label className="flex items-center gap-2 text-[11px] text-foreground-muted cursor-pointer">
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
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset to defaults"
            className="rounded-md border border-white/[0.06] bg-transparent px-2.5 py-1 text-[11px] text-foreground-muted transition-colors hover:text-[#E05252]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!isDirty || isApplying}
            aria-label="Apply Audience Mix"
            className="rounded-md border border-[#FF7F50] bg-[rgba(255,127,80,0.12)] px-3 py-1 text-[11px] text-[#FF7F50] transition-colors hover:bg-[rgba(255,127,80,0.20)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isApplying ? 'Applying…' : 'Apply mix'}
          </button>
        </div>
      </div>
    </section>
  );
}
