'use client';
import type { CameraPresetKey } from './board-types';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

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

/** Mono keycap chip rendered inside a (light) tooltip — dark-on-light. */
function Kbd({ glyph }: { glyph: string }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-black/15 bg-black/[0.08] px-1 font-mono text-[10px] font-medium leading-none tabular-nums text-background">
      {glyph}
    </kbd>
  );
}

const TAB_BASE =
  'flex items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 motion-reduce:transition-none pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]';

/**
 * Top-center view switcher. Tabs are clean text at rest — the keyboard shortcut
 * lives in a styled tooltip (with a kbd chip) on hover/focus, not an inline
 * badge. This avoids the count-badge misread of persistent "0/1/2/3" AND the
 * hover-reflow that an animated inline keycap caused (siblings shifted ~13px).
 */
export function CameraOverlay({ activePreset, onSelect }: CameraOverlayProps) {
  return (
    <TooltipProvider delayDuration={300}>
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
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  aria-label={`${PRESET_LABELS[key]} view`}
                  aria-keyshortcuts={PRESET_KEYS[key]}
                  aria-pressed={isActive}
                  onClick={() => onSelect(key)}
                  className={`${TAB_BASE} ${
                    isActive
                      ? 'bg-white/[0.08] text-foreground'
                      : 'text-foreground/55 hover:bg-white/[0.04] hover:text-foreground/90'
                  }`}
                >
                  {key === 'content-analysis' ? (
                    <>
                      <span className="sm:hidden">Craft</span>
                      <span className="hidden sm:inline">Content craft</span>
                    </>
                  ) : (
                    PRESET_LABELS[key]
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <span className="flex items-center gap-1.5">
                  Switch view
                  <Kbd glyph={PRESET_KEYS[key]} />
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
        <div className="mx-1 hidden h-5 w-px bg-white/[0.06] sm:block" aria-hidden="true" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Reset view"
              aria-keyshortcuts="R"
              onClick={() => onSelect('overview')}
              className={`hidden text-foreground/55 hover:bg-white/[0.04] hover:text-foreground/90 sm:flex ${TAB_BASE}`}
            >
              Reset
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <span className="flex items-center gap-1.5">
              Reset view
              <Kbd glyph="R" />
            </span>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
