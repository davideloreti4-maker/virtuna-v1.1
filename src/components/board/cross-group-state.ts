import { useBoardStore } from '@/stores/board-store';
import type { BoardMachineState } from '@/stores/board-store';
import type { GroupId } from './board-types';
import type { FrameVisualState } from './GroupFrame';

// D-24: Extendable signal name; currently only 'anti-virality'.
// Future signals (high-confidence-loop, exceptional-hook-score) add entries to AFFECTED_FRAMES.
type CrossGroupSignal = 'anti-virality';

const AFFECTED_FRAMES: Record<CrossGroupSignal, Set<GroupId>> = {
  'anti-virality': new Set<GroupId>(['verdict', 'audience', 'actions']),
};

export function useAntiViralityAffectedFrames(): Set<GroupId> {
  const boardState = useBoardStore((s) => s.boardState);
  return boardState === 'anti-virality' ? AFFECTED_FRAMES['anti-virality'] : new Set<GroupId>();
}

export function getFrameAntiViralityState(
  frameId: GroupId,
  boardState: BoardMachineState,
): FrameVisualState {
  if (boardState === 'idle') return 'idle';
  if (boardState === 'streaming') return 'streaming';
  if (boardState === 'anti-virality' && AFFECTED_FRAMES['anti-virality'].has(frameId)) {
    return 'anti-virality';
  }
  return 'complete';
}
