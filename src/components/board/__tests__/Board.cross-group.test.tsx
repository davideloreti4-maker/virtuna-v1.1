/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardStore } from '@/stores/board-store';
import { getFrameAntiViralityState } from '../cross-group-state';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Board.tsx cross-group anti-virality wiring', () => {
  beforeEach(() => {
    useBoardStore.setState({ boardState: 'idle' });
  });

  it('AV state propagates to verdict + audience + actions in a single resolver call', () => {
    useBoardStore.setState({ boardState: 'anti-virality' });
    const boardState = useBoardStore.getState().boardState;
    expect(getFrameAntiViralityState('verdict', boardState)).toBe('anti-virality');
    expect(getFrameAntiViralityState('audience', boardState)).toBe('anti-virality');
    expect(getFrameAntiViralityState('actions', boardState)).toBe('anti-virality');
  });

  it('non-affected frames return complete during AV (no accidental ripple)', () => {
    useBoardStore.setState({ boardState: 'anti-virality' });
    const boardState = useBoardStore.getState().boardState;
    expect(getFrameAntiViralityState('input', boardState)).toBe('complete');
    expect(getFrameAntiViralityState('engine', boardState)).toBe('complete');
    expect(getFrameAntiViralityState('content-analysis', boardState)).toBe('complete');
  });

  it('Board.tsx no longer contains inline frameId string check (refactor verified)', () => {
    const boardSrc = readFileSync(
      resolve(process.cwd(), 'src/components/board/Board.tsx'),
      'utf8',
    );
    // Strip comments before checking — header prose should not invalidate the gate
    const code = boardSrc
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    expect(code).not.toMatch(/frameId\s*===\s*['"]verdict['"]\s*\|\|\s*frameId\s*===\s*['"]audience['"]/);
  });
});
