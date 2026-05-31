'use client';

export interface MixFooterProps {
  /** Dominant-slot label, e.g. "FYP-heavy" / "Niche-focused". */
  label: string;
  /** Whether the override drawer is currently open (toggles the link text). */
  open: boolean;
  /** Toggle the inline WeightOverrideDrawer. */
  onToggle: () => void;
}

/**
 * Footer — "Weighted for {label} reach" + an "Adjust" toggle that reveals the
 * existing WeightOverrideDrawer inline. Quiet treatment (t3 text, no coral).
 * Matches audience-sketch-v7 `.foot`.
 */
export function MixFooter({ label, open, onToggle }: MixFooterProps) {
  return (
    <div
      className="mt-[18px] flex items-center gap-2 border-t border-white/[0.06] pt-[16px]"
      style={{ fontSize: 12, color: 'rgba(255,255,255,0.34)' }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
        <path d="M2 5h12M2 8h8M2 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span>
        Weighted for <b style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{label}</b> reach
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="ml-auto cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]"
        style={{ color: 'rgba(255,255,255,0.34)', fontWeight: 500 }}
      >
        {open ? 'Done' : 'Adjust'}
      </button>
    </div>
  );
}
