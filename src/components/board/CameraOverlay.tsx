'use client';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import type { CameraPresetKey } from './board-types';

interface CameraOverlayProps {
  activePreset: CameraPresetKey | null;
  onSelect: (key: CameraPresetKey) => void;
}

const PRESET_LABELS: Record<CameraPresetKey, string> = {
  overview: 'Overview',
  verdict: 'Verdict',
  audience: 'Audience',
  'content-analysis': 'Content Analysis',
};

const PRESET_KEYS: Record<CameraPresetKey, string> = {
  overview: '0',
  verdict: '1',
  audience: '2',
  'content-analysis': '3',
};

const PRESET_ORDER: CameraPresetKey[] = ['overview', 'verdict', 'audience', 'content-analysis'];

export function CameraOverlay({ activePreset, onSelect }: CameraOverlayProps) {
  return (
    <div
      className="fixed bottom-20 right-4 z-[100] flex flex-col gap-1"
      aria-label="Camera presets"
    >
      {PRESET_ORDER.map((key) => (
        <Button
          key={key}
          variant="ghost"
          size="sm"
          aria-label={`${PRESET_LABELS[key]} view`}
          aria-keyshortcuts={PRESET_KEYS[key]}
          aria-pressed={activePreset === key}
          onClick={() => onSelect(key)}
          className={activePreset === key ? 'bg-white/[0.08]' : ''}
        >
          <span className="hidden md:inline">{PRESET_LABELS[key]}</span>
          <span className="md:hidden">{PRESET_LABELS[key].slice(0, 3)}</span>
          <Kbd size="sm" className="ml-1 hidden md:inline-flex">{PRESET_KEYS[key]}</Kbd>
        </Button>
      ))}
      {/* Reset button — same target as overview, different label */}
      <Button
        variant="ghost"
        size="sm"
        aria-label="Reset view"
        aria-keyshortcuts="R"
        onClick={() => onSelect('overview')}
      >
        <span className="hidden md:inline">Reset</span>
        <span className="md:hidden">Rst</span>
        <Kbd size="sm" className="ml-1 hidden md:inline-flex">R</Kbd>
      </Button>
    </div>
  );
}
