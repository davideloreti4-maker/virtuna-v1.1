'use client';
import { Children, forwardRef } from 'react';
import type { ReactNode } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Camera, GroupFrameLayout } from './board-types';
import { TITLE_BAR_HEIGHT } from './board-constants';
import type { FrameVisualState } from './GroupFrame';

const EMPTY_STATE_COPY: Record<string, { title: string; sub: string }> = {
  audience: {
    title: 'Predicted retention across 10 personas',
    sub: 'Submit a video to see the live curve, dropoffs, and per-persona reactions.',
  },
  verdict: {
    title: 'Final virality call',
    sub: 'Score, headline insight, and predicted reach surface here after analysis.',
  },
  actions: {
    title: 'Recommended next moves',
    sub: 'Specific rework or reshoot suggestions appear once the engine completes.',
  },
  'content-analysis': {
    title: 'Hook breakdown · tags · drivers',
    sub: 'Tone, format, niche fit, and detected hooks fill in here after Wave 0.',
  },
  input: { title: '', sub: '' },
  engine: { title: '', sub: '' },
};

function hasRealChildren(children: ReactNode): boolean {
  let real = 0;
  Children.forEach(children, (c) => {
    if (c !== null && c !== undefined && c !== false && c !== '') real++;
  });
  return real > 0;
}

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
  // World → screen.
  // D-10: Actions frame grows from 200px to 360px in anti-virality state so
  // the Reshoot hero slot has room to span the top and the 3-cell bottom row
  // doesn't get cropped. Other frames keep their bounds.height verbatim.
  const worldH =
    layout.id === 'actions' && visual === 'anti-virality'
      ? 360
      : layout.bounds.height;
  const screenX = layout.bounds.x * camera.scale + camera.x;
  const screenY = layout.bounds.y * camera.scale + camera.y;
  const screenW = layout.bounds.width * camera.scale;
  const screenH = worldH * camera.scale;

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
          {(() => {
            const empty = EMPTY_STATE_COPY[layout.id];
            if (hasRealChildren(children) || !empty?.title) return null;
            return (
              <div className="flex h-full w-full flex-col items-start justify-center gap-1 opacity-60">
                <p className="text-sm font-medium leading-tight">{empty.title}</p>
                <p className="max-w-[28ch] text-xs leading-snug text-foreground-muted">{empty.sub}</p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
});
