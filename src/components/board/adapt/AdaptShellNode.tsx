'use client';
/**
 * AdaptShellNode — static DOM shell for the Adapt frame in remix mode.
 *
 * D-10/D-11: titled frame + one muted descriptor; no skeleton/shimmer/spinner,
 * no "coming soon" text. The frame title comes from GroupFrameOverlay's title bar
 * (layout.label = "Adapt") — this component renders the descriptor body only.
 *
 * DOM component (returns <div>), NOT a Konva node (RESEARCH Pattern 1 / Pitfall 1).
 * Content phases (Adapt frame body) are Phase 4 (ADAPT-01/02).
 */

export function AdaptShellNode() {
  return (
    <div className="relative flex w-full flex-col gap-2" data-testid="adapt-shell">
      <p
        className="max-w-[44ch] text-xs leading-[1.4] text-white/35"
        style={{ textWrap: 'balance' } as React.CSSProperties}
      >
        Niche-adapted concepts drawn from the source format.
      </p>
    </div>
  );
}
