'use client';
import { Desktop } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { GROUP_FRAMES } from './board-constants';
import { MobileFrameCard } from './MobileFrameCard';
import { EngineGroup } from './EngineGroup';
import { AudienceNode } from './audience/AudienceNode';
import { VerdictNode } from './verdict/VerdictNode';
import { ActionsNode } from './actions/ActionsNode';
import { ContentAnalysisFrame } from './content-analysis/ContentAnalysisFrame';
import { InputResultCard } from './InputResultCard';
import { DecodeShellNode } from './decode/DecodeShellNode';
import { AdaptShellNode } from './adapt/AdaptShellNode';
import { FrameErrorBoundary } from './FrameErrorBoundary';
import { getFrameAntiViralityState } from './cross-group-state';
import type { Camera, GroupId, GroupFrameLayout } from './board-types';
import type { BoardMachineState } from '@/stores/board-store';
import type { BehavioralPredictions, ConfidenceLevel } from '@/lib/engine/types';

/** Card view never zooms — content renders at its natural 1:1 size. */
const CARD_CAMERA: Camera = { x: 0, y: 0, scale: 1 };

/**
 * Mobile reading orders (D-09 one-board-two-config):
 * Score: the video → the call → why → what to do → the breakdown → how it was computed.
 * Remix: same structure but Decode (why it worked) + Adapt (niche concepts) replace
 * Score (verdict) + Actions.
 */
const MOBILE_ORDER_SCORE: GroupId[] = [
  'input',
  'verdict',
  'audience',
  'actions',
  'content-analysis',
  'engine',
];

const MOBILE_ORDER_REMIX: GroupId[] = [
  'input',
  'decode',
  'audience',
  'adapt',
  'content-analysis',
  'engine',
];

/**
 * Fallback labels for GroupIds not in GROUP_FRAMES (decode/adapt are remix-only
 * and are not in the score-mode GROUP_FRAMES constant — LAYOUT_BY_ID guard).
 */
const MOBILE_LABELS: Partial<Record<GroupId, string>> = {
  decode: 'Decode',
  adapt: 'Adapt',
};

export interface BoardMobileInput {
  behavioral: BehavioralPredictions | null;
  confidence: number | null;
  confidenceLabel: ConfidenceLevel | null;
  gated: boolean;
  isStreaming: boolean;
}

interface Props {
  boardMachineState: BoardMachineState;
  input: BoardMobileInput;
  /** False when there's no analysis to show (bare /analyze, no permalink id). */
  hasAnalysis: boolean;
  /**
   * Intent mode — selects which card order to use (D-08/D-09).
   * Defaults to 'score' so existing callers are byte-identical.
   * Plan 03 threads the live value from stream/permalink.
   */
  boardMode?: 'score' | 'remix';
}

const LAYOUT_BY_ID = new Map<GroupId, GroupFrameLayout>(
  GROUP_FRAMES.map((f) => [f.id, f]),
);

/**
 * Phone layout for the analysis board: a single scrollable column of cards that
 * reuses the exact content nodes from the canvas. The nodes self-hydrate from
 * the analysis stream / permalink hooks, so the card stack needs no data wiring
 * beyond the input video card and the cross-group anti-virality accent.
 */
export function BoardMobile({ boardMachineState, input, hasAnalysis, boardMode = 'score' }: Props) {
  // No analysis context (bare /analyze on a phone): running one is desktop-first
  // for now, so show a single intentional hint instead of a stack of empty cards.
  if (!hasAnalysis) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background px-8 text-center"
        role="region"
        aria-label="Analysis (card view)"
        data-testid="board-mobile"
      >
        <Icon icon={Desktop} size={32} className="text-foreground-muted" />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">Analysis is desktop-only for now</p>
          <p className="max-w-[34ch] text-xs leading-snug text-foreground-muted">
            Open Virtuna on a larger screen to run a new analysis. Shared result links open here
            just fine.
          </p>
        </div>
      </div>
    );
  }

  const renderBody = (id: GroupId) => {
    // LAYOUT_BY_ID only contains score-mode GROUP_FRAMES ids (verdict/actions).
    // decode/adapt are remix-only — guard the lookup to avoid undefined crashes.
    const layout = LAYOUT_BY_ID.get(id);
    switch (id) {
      case 'input':
        return (
          <InputResultCard
            behavioral={input.behavioral}
            confidence={input.confidence}
            confidenceLabel={input.confidenceLabel}
            gated={input.gated}
            isStreaming={input.isStreaming}
          />
        );
      case 'engine':
        return <EngineGroup />;
      case 'audience':
        return <AudienceNode camera={CARD_CAMERA} layout={layout!} />;
      case 'verdict':
        return <VerdictNode camera={CARD_CAMERA} layout={layout!} />;
      case 'actions':
        return <ActionsNode camera={CARD_CAMERA} layout={layout!} />;
      case 'content-analysis':
        return <ContentAnalysisFrame camera={CARD_CAMERA} layout={layout!} />;
      case 'decode':
        return (
          <FrameErrorBoundary frameLabel="Decode">
            <DecodeShellNode />
          </FrameErrorBoundary>
        );
      case 'adapt':
        return (
          <FrameErrorBoundary frameLabel="Adapt">
            <AdaptShellNode camera={CARD_CAMERA} layout={layout} />
          </FrameErrorBoundary>
        );
      default:
        return null;
    }
  };

  const mobileOrder = boardMode === 'remix' ? MOBILE_ORDER_REMIX : MOBILE_ORDER_SCORE;

  return (
    <div
      className="absolute inset-0 overflow-y-auto overflow-x-hidden bg-background"
      role="region"
      aria-label="Analysis (card view)"
      data-testid="board-mobile"
    >
      {/* Opaque strip reserving the top-left zone for the app's fixed
          SidebarHamburger (fixed left-4 top-4, 34px). Sticky + opaque so card
          titles scroll *behind* it instead of colliding with the hamburger. */}
      <div className="sticky top-0 z-10 h-14 bg-background" aria-hidden="true" />
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3 px-3 pb-28">
        {mobileOrder.map((id) => (
          <MobileFrameCard
            key={id}
            label={LAYOUT_BY_ID.get(id)?.label ?? MOBILE_LABELS[id] ?? id}
            accent={getFrameAntiViralityState(id, boardMachineState) === 'anti-virality'}
          >
            {renderBody(id)}
          </MobileFrameCard>
        ))}
      </div>
    </div>
  );
}
