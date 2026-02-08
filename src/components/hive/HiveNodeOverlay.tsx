'use client';

// ---------------------------------------------------------------------------
// HiveNodeOverlay.tsx -- GlassCard overlay for selected node info
// ---------------------------------------------------------------------------
//
// Positioned absolutely over the canvas near the selected node.
// Uses computeOverlayPosition for smart edge-aware placement.
// Fades in after first render (measures dimensions, then positions).
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';

import { X } from '@phosphor-icons/react';

import { GlassCard } from '@/components/primitives/GlassCard';
import { Caption, Text } from '@/components/ui/typography';

import { computeOverlayPosition } from './hive-interaction';
import type { LayoutNode } from './hive-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HiveNodeOverlayProps {
  node: LayoutNode;
  screenPosition: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HiveNodeOverlay({
  node,
  screenPosition,
  containerWidth,
  containerHeight,
  onClose,
}: HiveNodeOverlayProps): React.JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  // Compute position after mount / when screenPosition changes
  useEffect(() => {
    if (!overlayRef.current) return;
    const { offsetWidth, offsetHeight } = overlayRef.current;
    const { left, top } = computeOverlayPosition(
      screenPosition.x,
      screenPosition.y,
      offsetWidth,
      offsetHeight,
      containerWidth,
      containerHeight,
    );
    setPosition({ left, top });
    setIsPositioned(true);
  }, [screenPosition.x, screenPosition.y, containerWidth, containerHeight]);

  const tierLabel =
    node.tier === 0 ? 'Center' : node.tier === 1 ? 'Theme' : 'Sub-theme';

  return (
    <div
      ref={overlayRef}
      className="absolute z-10 pointer-events-auto"
      style={{
        left: position.left,
        top: position.top,
        opacity: isPositioned ? 1 : 0,
        transition: 'opacity 150ms ease-out',
      }}
    >
      <GlassCard padding="sm" blur="md" className="w-[220px]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white/40 hover:text-white/80 transition-colors"
          aria-label="Close overlay"
        >
          <X size={14} />
        </button>

        {/* Node info */}
        <div className="space-y-2 pr-6">
          <Text size="sm" className="text-white/90 font-medium">
            {node.name ?? node.id}
          </Text>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: node.color }}
            />
            <Caption className="text-white/50">{tierLabel}</Caption>
          </div>
          {/* Show meta values if present */}
          {node.meta &&
            Object.entries(node.meta)
              .slice(0, 3)
              .map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <Caption className="text-white/40 capitalize">{key}</Caption>
                  <Caption className="text-white/70">
                    {String(value)}
                  </Caption>
                </div>
              ))}
        </div>
      </GlassCard>
    </div>
  );
}
