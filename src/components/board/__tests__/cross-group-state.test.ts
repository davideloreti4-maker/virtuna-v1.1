/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBoardStore } from '@/stores/board-store';
import {
  useAntiViralityAffectedFrames,
  getFrameAntiViralityState,
} from '../cross-group-state';

describe('cross-group-state', () => {
  beforeEach(() => {
    // Reset board state between tests
    useBoardStore.setState({ boardState: 'idle' });
  });

  describe('useAntiViralityAffectedFrames', () => {
    it('returns empty Set when boardState is idle', () => {
      useBoardStore.setState({ boardState: 'idle' });
      const { result } = renderHook(() => useAntiViralityAffectedFrames());
      expect(result.current.size).toBe(0);
    });

    it('returns empty Set when boardState is streaming', () => {
      useBoardStore.setState({ boardState: 'streaming' });
      const { result } = renderHook(() => useAntiViralityAffectedFrames());
      expect(result.current.size).toBe(0);
    });

    it('returns empty Set when boardState is complete', () => {
      useBoardStore.setState({ boardState: 'complete' });
      const { result } = renderHook(() => useAntiViralityAffectedFrames());
      expect(result.current.size).toBe(0);
    });

    it('returns {verdict, audience, actions} when boardState is anti-virality', () => {
      useBoardStore.setState({ boardState: 'anti-virality' });
      const { result } = renderHook(() => useAntiViralityAffectedFrames());
      expect(result.current.has('verdict')).toBe(true);
      expect(result.current.has('audience')).toBe(true);
      expect(result.current.has('actions')).toBe(true);
      expect(result.current.has('input')).toBe(false);
      expect(result.current.has('engine')).toBe(false);
      expect(result.current.has('content-analysis')).toBe(false);
      expect(result.current.size).toBe(3);
    });
  });

  describe('getFrameAntiViralityState', () => {
    it.each([
      ['verdict', 'idle', 'idle'],
      ['actions', 'streaming', 'streaming'],
      ['verdict', 'anti-virality', 'anti-virality'],
      ['audience', 'anti-virality', 'anti-virality'],
      ['actions', 'anti-virality', 'anti-virality'],
      ['input', 'anti-virality', 'complete'],
      ['engine', 'anti-virality', 'complete'],
      ['content-analysis', 'anti-virality', 'complete'],
      ['verdict', 'complete', 'complete'],
    ] as const)('returns %s for frame=%s, state=%s', (frameId, state, expected) => {
      expect(getFrameAntiViralityState(frameId as never, state as never)).toBe(expected);
    });
  });
});
