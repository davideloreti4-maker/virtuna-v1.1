'use client';
import type { ReactNode, KeyboardEvent } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel';
import { cn } from '@/lib/utils';
import type { Camera, NodeSpec, NodeStatus } from './board-types';

interface Props {
  spec: NodeSpec;
  camera: Camera;
  status: NodeStatus;
  selected: boolean;
  onTap?: () => void;
  children: ReactNode;
  className?: string;
}

export function NodeOverlay({ spec, camera, status, selected, onTap, children, className }: Props) {
  const screenX = spec.bounds.x * camera.scale + camera.x;
  const screenY = spec.bounds.y * camera.scale + camera.y;
  const screenW = spec.bounds.width * camera.scale;
  const screenH = spec.bounds.height * camera.scale;

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={spec.tabIndex ?? 0}
      aria-label={spec.ariaLabel}
      aria-pressed={selected}
      onClick={onTap}
      onKeyDown={handleKey}
      data-node-id={spec.id}
      data-status={status}
      className={cn(
        'pointer-events-auto absolute',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'transition-[background-color] hover:bg-white/[0.02]',
        className,
      )}
      style={{
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
      }}
    >
      {/* GlassPanel-styled container per UI-SPEC §Input Node + brand bible. */}
      <GlassPanel className="flex h-full w-full flex-col overflow-hidden rounded-[8px]">
        {children}
      </GlassPanel>
    </div>
  );
}
