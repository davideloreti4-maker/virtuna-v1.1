'use client';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Camera, GroupFrameLayout } from './board-types';
import { TITLE_BAR_HEIGHT } from './board-constants';
import type { FrameVisualState } from './GroupFrame';

const EMPTY_STATE_COPY: Record<string, string> = {
  audience: 'Audience data will appear here',
  verdict: 'Verdict will appear here',
  actions: 'Actions will appear here',
  'content-analysis': 'Content analysis will appear here',
  input: '', // Input node renders its own card (plan 2.7)
  engine: '', // Engine renders 5 stage glyphs (plan 2.13)
};

const ARIA_LABEL: Record<string, string> = {
  audience: 'Audience analysis',
  verdict: 'Verdict',
  actions: 'Actions',
  'content-analysis': 'Content analysis',
  input: 'Input',
  engine: 'Engine pipeline',
};

interface Props {
  layout: GroupFrameLayout;
  camera: Camera;
  visual: FrameVisualState;
  expanded: boolean;
  onToggleExpanded: () => void;
  childCount?: number;
  children?: ReactNode; // body content slot (plan 2.7 Input node, plan 2.13 engine stages)
  reducedMotion: boolean;
  /** Roving tabindex — exactly one frame has 0, all others -1. NEVER positive values. */
  tabIndex: 0 | -1;
  /** Called when this frame receives focus (click or keyboard). Updates roving active index. */
  onFocus?: () => void;
}

export const GroupFrameOverlay = forwardRef<HTMLDivElement, Props>(function GroupFrameOverlay(
  { layout, camera, visual, expanded, onToggleExpanded, childCount = 0, children, reducedMotion, tabIndex, onFocus },
  ref,
) {
  // World → screen
  const screenX = layout.bounds.x * camera.scale + camera.x;
  const screenY = layout.bounds.y * camera.scale + camera.y;
  const screenW = layout.bounds.width * camera.scale;
  const screenH = layout.bounds.height * camera.scale;

  const showShimmer = visual === 'streaming' && !reducedMotion;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ARIA_LABEL[layout.id] ?? layout.label}
      tabIndex={tabIndex}
      onFocus={onFocus}
      className="pointer-events-auto absolute focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      style={{
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
      }}
    >
      {/* Title bar (UI-SPEC §Group Container Frames).
          Using <div> (not <header>) because <header> has implicit role="banner" which axe
          requires to be top-level; inside a role="region" it triggers landmark-banner-is-top-level. */}
      <div
        className={cn(
          'flex items-center justify-between px-2',
          'border-b border-white/[0.06]',
        )}
        style={{ height: TITLE_BAR_HEIGHT }}
      >
        <span className="text-xs font-semibold text-foreground">{layout.label}</span>
        <div className="flex items-center gap-2">
          {childCount > 0 && (
            <Badge variant="secondary" size="sm">{childCount}</Badge>
          )}
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? `Collapse ${layout.label}` : `Expand ${layout.label}`}
            aria-expanded={expanded}
            className="text-foreground-muted hover:text-foreground"
          >
            <Icon icon={expanded ? CaretUp : CaretDown} size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div
          className="relative overflow-hidden p-4"
          style={{ height: screenH - TITLE_BAR_HEIGHT }}
        >
          {/* aria-live announcements handled by EngineGroup to avoid double announcements */}
          {showShimmer && (
            <Skeleton className="absolute inset-2 opacity-40" />
          )}
          {children}
          {!children && EMPTY_STATE_COPY[layout.id] && (
            <p className="text-sm text-foreground-muted">{EMPTY_STATE_COPY[layout.id]}</p>
          )}
        </div>
      )}
    </div>
  );
});
