'use client';
/**
 * DecodeShellNode — static DOM shell for the Decode frame in remix mode.
 *
 * D-10/D-11: titled frame + one muted descriptor; no skeleton/shimmer/spinner,
 * no "coming soon" text. The frame title comes from GroupFrameOverlay's title bar
 * (layout.label = "Decode") — this component renders the descriptor body only.
 *
 * DOM component (returns <div>), NOT a Konva node (RESEARCH Pattern 1 / Pitfall 1).
 * Content phases (Decode frame body) are Phase 3 (DECODE-01/02).
 */

export function DecodeShellNode() {
  return (
    <div className="relative flex w-full flex-col gap-2" data-testid="decode-shell">
      <p
        className="max-w-[44ch] text-xs leading-[1.4] text-white/35"
        style={{ textWrap: 'balance' } as React.CSSProperties}
      >
        Structural breakdown of why this video worked.
      </p>
    </div>
  );
}
