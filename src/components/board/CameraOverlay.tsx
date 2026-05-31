'use client';
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
  'content-analysis': 'Content craft',
};

const PRESET_KEYS: Record<CameraPresetKey, string> = {
  overview: '0',
  engine: '',  // no keyboard shortcut — internal-only
  verdict: '1',
  audience: '2',
  'content-analysis': '3',
};

const PRESET_ORDER: CameraPresetKey[] = ['overview', 'verdict', 'audience', 'content-analysis'];

/**
 * Keyboard-shortcut hint. Hidden (zero-width) at rest so a bare "0/1/2/3" never
 * reads as a count badge; slides in as a mono keycap on hover of its tab. The
 * shortcut also lives in the button's title/aria for persistent discoverability.
 */
function KeyBadge({ glyph, active = false }: { glyph: string; active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-0 hidden h-5 max-w-0 items-center justify-center overflow-hidden rounded-[5px] border font-mono text-[11px] leading-none tabular-nums opacity-0 transition-all duration-200 group-hover:ml-1.5 group-hover:max-w-[28px] group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-[28px] group-focus-visible:opacity-100 sm:inline-flex ${
        active
          ? 'border-[#FF7F50]/30 bg-[#FF7F50]/10 px-1.5 text-[#FF7F50]'
          : 'border-white/[0.1] bg-white/[0.02] px-1.5 text-foreground/60'
      }`}
    >
      {glyph}
    </span>
  );
}

export function CameraOverlay({ activePreset, onSelect }: CameraOverlayProps) {
  return (
    <div
      className="fixed top-4 left-[60px] z-[100] flex items-center gap-0.5 rounded-xl border border-white/[0.06] p-1 sm:left-1/2 sm:-translate-x-1/2"
      style={{
        background: 'linear-gradient(137deg, rgba(17,18,20,0.85) 4.87%, rgba(12,13,15,0.95) 75.88%)',
        backdropFilter: 'blur(8px)',
        boxShadow:
          'rgba(0,0,0,0.4) 0 8px 24px -6px, rgba(255,255,255,0.08) 0 1px 0 0 inset',
      }}
      aria-label="Camera presets"
    >
      {PRESET_ORDER.map((key) => {
        const isActive = activePreset === key;
        return (
          <button
            key={key}
            aria-label={`${PRESET_LABELS[key]} view`}
            aria-keyshortcuts={PRESET_KEYS[key]}
            aria-pressed={isActive}
            title={`Press ${PRESET_KEYS[key]} to switch view`}
            onClick={() => onSelect(key)}
            className={`group flex items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50] ${
              isActive
                ? 'bg-white/[0.08] text-foreground'
                : 'text-foreground/55 hover:bg-white/[0.04] hover:text-foreground/90'
            }`}
          >
            <span>
              {key === 'content-analysis'
                ? <><span className="sm:hidden">Craft</span><span className="hidden sm:inline">Content craft</span></>
                : PRESET_LABELS[key]}
            </span>
            <KeyBadge glyph={PRESET_KEYS[key]} active={isActive} />
          </button>
        );
      })}
      <div className="mx-1 hidden h-5 w-px bg-white/[0.06] sm:block" aria-hidden="true" />
      <button
        aria-label="Reset view"
        aria-keyshortcuts="R"
        title="Press R to switch view"
        onClick={() => onSelect('overview')}
        className="group hidden items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-foreground/55 transition-colors duration-150 hover:bg-white/[0.04] hover:text-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50] sm:flex"
      >
        <span>Reset</span>
        <KeyBadge glyph="R" />
      </button>
    </div>
  );
}
