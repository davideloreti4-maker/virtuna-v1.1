'use client';
import { Kbd } from '@/components/ui/kbd';
import type { CameraPresetKey } from './board-types';

interface CameraOverlayProps {
  activePreset: CameraPresetKey | null;
  onSelect: (key: CameraPresetKey) => void;
}

const PRESET_LABELS: Record<CameraPresetKey, string> = {
  overview: 'Overview',
  engine: '', // internal-only auto-pan preset — not user-facing
  verdict: 'Verdict',
  audience: 'Audience',
  'content-analysis': 'Content Analysis',
};

const PRESET_KEYS: Record<CameraPresetKey, string> = {
  overview: '0',
  engine: '',  // no keyboard shortcut — internal-only
  verdict: '1',
  audience: '2',
  'content-analysis': '3',
};

const PRESET_ORDER: CameraPresetKey[] = ['overview', 'verdict', 'audience', 'content-analysis'];

export function CameraOverlay({ activePreset, onSelect }: CameraOverlayProps) {
  return (
    <div
      className="fixed top-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-0.5 rounded-[10px] border border-white/[0.06] px-1.5 py-1 shadow-[rgba(0,0,0,0.4)_0_4px_16px_0]"
      style={{
        background: 'linear-gradient(137deg, rgba(17,18,20,0.85) 4.87%, rgba(12,13,15,0.95) 75.88%)',
        backdropFilter: 'blur(8px)',
      }}
      aria-label="Camera presets"
    >
      {PRESET_ORDER.map((key) => (
        <button
          key={key}
          aria-label={`${PRESET_LABELS[key]} view`}
          aria-keyshortcuts={PRESET_KEYS[key]}
          aria-pressed={activePreset === key}
          title={`Press ${PRESET_KEYS[key]} to switch view`}
          onClick={() => onSelect(key)}
          className={`flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50] ${activePreset === key ? 'bg-white/[0.08] text-foreground' : 'text-foreground/70'}`}
        >
          <span>{PRESET_LABELS[key]}</span>
          <Kbd size="sm" className="opacity-50">{PRESET_KEYS[key]}</Kbd>
        </button>
      ))}
      <div className="mx-1 h-4 w-px bg-white/[0.06]" aria-hidden="true" />
      <button
        aria-label="Reset view"
        aria-keyshortcuts="R"
        title="Press R to switch view"
        onClick={() => onSelect('overview')}
        className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]"
      >
        <span>Reset</span>
        <Kbd size="sm" className="opacity-50">R</Kbd>
      </button>
    </div>
  );
}
