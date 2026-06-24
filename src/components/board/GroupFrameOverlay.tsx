'use client';
import { Children, forwardRef, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Camera, GroupFrameLayout } from './board-types';
import { GROUP_FRAMES, TITLE_BAR_HEIGHT } from './board-constants';
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
  // Remix shells: empty title so the empty-state block skips (the shell owns the descriptor).
  decode: { title: '', sub: '' },
  adapt: { title: '', sub: '' },
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
  // Remix shells (UI-SPEC §Accessibility)
  decode: 'Decode frame — structural breakdown',
  adapt: 'Adapt frame — niche concepts',
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
  /** When true the frame height tracks its measured content (no internal scroll);
   *  when false it keeps a fixed body height (Input video card, Engine stepper). */
  autoHeight?: boolean;
  /** Reports the measured world-space frame height (title bar + content) so Board
   *  can reflow the layout. Only fires for auto-height frames. */
  onMeasure?: (worldH: number) => void;
}

export const GroupFrameOverlay = forwardRef<HTMLDivElement, Props>(function GroupFrameOverlay(
  { layout, camera, visual, expanded, onToggleExpanded, childCount = 0, children, reducedMotion, tabIndex, onFocus, autoHeight = false, onMeasure },
  ref,
) {
  // World → screen.
  const worldH = layout.bounds.height;
  const screenX = layout.bounds.x * camera.scale + camera.x;
  const screenY = layout.bounds.y * camera.scale + camera.y;
  const screenW = layout.bounds.width * camera.scale;
  const screenH = worldH * camera.scale;

  const showShimmer = visual === 'streaming' && !reducedMotion;

  // Designed floor for auto frames: the original constant body height. Pinned as
  // a min-height so light/idle states keep the hand-tuned spatial composition and
  // only overflow content grows the frame. MUST read the constant (not the live
  // worldH) — using worldH would ratchet the height up and never let it shrink.
  const baseHeight =
    GROUP_FRAMES.find((f) => f.id === layout.id)?.bounds.height ?? worldH;
  const minBodyHeight = baseHeight - TITLE_BAR_HEIGHT;

  // Auto-height: measure the unscaled world interior (offsetHeight ignores the
  // CSS scale transform) and report it up so Board can reflow the columns. The
  // interior sizes to its content naturally, so this never feeds back into the
  // measured height — no ResizeObserver loop. Re-measures on expand/collapse.
  const interiorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!autoHeight || !onMeasure) return;
    const el = interiorRef.current;
    if (!el) return;
    const report = () => onMeasure(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoHeight, onMeasure, expanded]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ARIA_LABEL[layout.id] ?? layout.label}
      tabIndex={tabIndex}
      onFocus={onFocus}
      className={cn(
        'pointer-events-auto absolute focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2',
        // Auto-height frames render their full content (no clip); fixed frames
        // clip their bounded body. overflow-visible also avoids a one-frame clip
        // flash before the measured height propagates back from Board.
        !autoHeight && 'overflow-hidden',
      )}
      style={{
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
      }}
    >
      {/* World-space interior. Everything inside lives in the frame's world
          coordinate system (layout.bounds.width × worldH). We scale the whole
          interior by camera.scale so frame size and content scale together —
          previously the outer rect resized with zoom but children kept fixed
          pixel sizes, producing empty space when zoomed in and clipped text
          when zoomed out. */}
      <div
        ref={interiorRef}
        style={{
          transform: `scale(${camera.scale})`,
          transformOrigin: 'top left',
          width: layout.bounds.width,
          // Auto frames size to their content (measured back into worldH); fixed
          // frames pin the world height so their bounded body can clip/fill.
          height: autoHeight ? undefined : worldH,
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

        {/* Body. Auto frames flow at natural height (no fixed height, no scroll);
            fixed frames pin the body to the remaining world height. */}
        {expanded && (
          <div
            className={cn('relative p-4', !autoHeight && 'overflow-hidden')}
            style={
              autoHeight
                ? { minHeight: minBodyHeight }
                : { height: worldH - TITLE_BAR_HEIGHT }
            }
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
    </div>
  );
});
