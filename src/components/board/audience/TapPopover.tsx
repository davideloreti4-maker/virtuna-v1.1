'use client';

import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import type { TapPopoverPayload } from './audience-types';

// ─── GlassPanel inline style ───────────────────────────────────────────────
// Must use inline style — Lightning CSS strips Tailwind backdrop-filter classes.
const GLASS_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)',
  backdropFilter: 'blur(5px)',
  WebkitBackdropFilter: 'blur(5px)',
  boxShadow: 'rgba(255,255,255,0.15) 0px 1px 1px 0px inset',
  zIndex: 300,
};

// ─── Prop interfaces ───────────────────────────────────────────────────────

export interface TapPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: TapPopoverPayload | null;
  anchorPos: { x: number; y: number } | null;
  onSeeFull?: () => void;
}

// ─── Content variants ──────────────────────────────────────────────────────

function CellContent({
  payload,
  onSeeFull,
}: {
  payload: Extract<TapPopoverPayload, { kind: 'cell' }>;
  onSeeFull?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#FF7F50' }}>
        {payload.personaId}
      </div>
      <div className="text-sm font-semibold" style={{ color: 'rgba(249,249,249,0.9)' }}>
        {Math.round(payload.attention * 100)}% attention
      </div>
      <div className="text-xs" style={{ color: 'rgba(249,249,249,0.5)' }}>
        Segment {payload.segmentIdx}
      </div>
      {payload.reason && (
        <div className="text-xs" style={{ color: 'rgba(249,249,249,0.7)' }}>
          {payload.reason}
        </div>
      )}
      {onSeeFull && (
        <button
          type="button"
          onClick={onSeeFull}
          className="mt-1 text-xs text-left"
          style={{ color: '#FF7F50' }}
        >
          See full →
        </button>
      )}
    </div>
  );
}

function MarkerContent({
  payload,
  onSeeFull,
}: {
  payload: Extract<TapPopoverPayload, { kind: 'marker' }>;
  onSeeFull?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-semibold" style={{ color: 'rgba(249,249,249,0.9)' }}>
        Swipe at {payload.t}s
      </div>
      <div className="text-xs" style={{ color: 'rgba(249,249,249,0.7)' }}>
        {Math.round(payload.attention * 100)}% attention at swipe
      </div>
      {onSeeFull && (
        <button
          type="button"
          onClick={onSeeFull}
          className="mt-1 text-xs text-left"
          style={{ color: '#FF7F50' }}
        >
          See full →
        </button>
      )}
    </div>
  );
}

function ClusterContent({
  payload,
}: {
  payload: Extract<TapPopoverPayload, { kind: 'cluster' }>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(249,249,249,0.5)' }}>
        {payload.markers.length} personas
      </div>
      <ul className="flex flex-col gap-1">
        {payload.markers.map((m) => (
          <li key={m.personaId} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(249,249,249,0.8)' }}>
            <span
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: '#FF7F50', flexShrink: 0 }}
            />
            <span>{m.archetype}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CurvePointContent({
  payload,
}: {
  payload: Extract<TapPopoverPayload, { kind: 'curve-point' }>;
}) {
  // Sort by attention desc — top 3
  const sorted = [...payload.contributingPersonas].sort((a, b) => b.attention - a.attention);
  const top3 = sorted.slice(0, 3);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-semibold" style={{ color: 'rgba(249,249,249,0.9)' }}>
        {Math.round(payload.weightedAttention * 100)}% weighted attention
      </div>
      <div className="text-xs" style={{ color: 'rgba(249,249,249,0.5)' }}>
        at {payload.t}s
      </div>
      <ul className="flex flex-col gap-1 mt-1">
        {top3.map((p) => (
          <li key={p.personaId} className="text-xs flex justify-between gap-3" style={{ color: 'rgba(249,249,249,0.7)' }}>
            <span>{p.personaId}</span>
            <span>{Math.round(p.attention * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FixChipContent({
  payload,
  onSeeFull,
}: {
  payload: Extract<TapPopoverPayload, { kind: 'fix-chip' }>;
  onSeeFull?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold" style={{ color: 'var(--color-warning, oklch(0.75 0.15 85))' }}>
        Segment {payload.segmentIdx} — fix
      </div>
      <div className="text-sm" style={{ color: 'rgba(249,249,249,0.9)' }}>
        {payload.fixText}
      </div>
      {onSeeFull && (
        <button
          type="button"
          onClick={onSeeFull}
          className="mt-1 text-xs text-left"
          style={{ color: '#FF7F50' }}
        >
          See all fixes in Verdict →
        </button>
      )}
    </div>
  );
}

function PopoverVariant({
  payload,
  onSeeFull,
}: {
  payload: TapPopoverPayload;
  onSeeFull?: () => void;
}) {
  if (payload.kind === 'cell') return <CellContent payload={payload} onSeeFull={onSeeFull} />;
  if (payload.kind === 'marker') return <MarkerContent payload={payload} onSeeFull={onSeeFull} />;
  if (payload.kind === 'cluster') return <ClusterContent payload={payload} />;
  if (payload.kind === 'curve-point') return <CurvePointContent payload={payload} />;
  if (payload.kind === 'fix-chip') return <FixChipContent payload={payload} onSeeFull={onSeeFull} />;
  return null;
}

// ─── Main component ────────────────────────────────────────────────────────

export function TapPopover({ open, onOpenChange, payload, anchorPos, onSeeFull }: TapPopoverProps) {
  // Track initial scrollY for delta calculation
  const scrollYRef = React.useRef<number>(typeof window !== 'undefined' ? window.scrollY : 0);

  // Scroll-dismiss: close when scroll delta > 40px
  React.useEffect(() => {
    if (!open) return;
    // Reset ref when popover opens
    scrollYRef.current = window.scrollY;

    function onScroll() {
      const delta = Math.abs(window.scrollY - scrollYRef.current);
      if (delta > 40) {
        onOpenChange(false);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open, onOpenChange]);

  if (!payload || !anchorPos) return null;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {/* Transparent 0x0 anchor div — positioned at tap coordinates */}
      <div
        data-tap-anchor
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: anchorPos.x,
          top: anchorPos.y,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />
      <PopoverPrimitive.Anchor
        style={{
          position: 'fixed',
          left: anchorPos.x,
          top: anchorPos.y,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-tap-popover-content
          role="tooltip"
          aria-live="polite"
          sideOffset={8}
          className="rounded-[12px] border border-white/[0.06] p-5 w-56 outline-none"
          style={GLASS_STYLE}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <PopoverVariant payload={payload} onSeeFull={onSeeFull} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
