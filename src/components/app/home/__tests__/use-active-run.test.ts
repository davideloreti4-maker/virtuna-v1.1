/** @vitest-environment happy-dom */
/**
 * useActiveRun — the tail-turn selector.
 *
 * The case that matters here is THE LATE FOLLOW-UP (measured live 2026-07-28, walk-through of
 * Lane 1). Every generative route sends `done` before its closing line and keeps the SSE open ~2s
 * to stream it. The composer folds the run into history on `done` — reload history, then
 * `reset()` the stream — so the `followup` frame lands on a stream that has ALREADY been reset and
 * refills exactly one field of an otherwise empty hook.
 *
 * If that lone field counts as content, the emptied stream re-claims the tail and the thread shows
 * the just-folded run twice: the persisted turn with its cards, then a second Maven block with the
 * same intro and the same closing line but no cards and no receipt — and a duplicate of the user's
 * own bubble above it. It never clears, because `reset()` cleared `isDone` too, so the
 * run-completion effect has nothing left to fire on.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActiveRun, type RunCandidate } from '../use-active-run';

const candidate = (over: Partial<RunCandidate> = {}): RunCandidate => ({
  skill: 'hooks',
  isStreaming: false,
  stop: () => {},
  reset: () => {},
  ...over,
});

describe('useActiveRun — the tail turn', () => {
  it('does NOT hold the tail on follow-up text alone (the post-reset ghost turn)', () => {
    // Exactly the state a reset stream is left in when the late `followup` frame lands: no blocks,
    // no stages, not streaming, no error — one string.
    const { result } = renderHook(() =>
      useActiveRun([
        candidate({
          skill: 'hooks',
          followupText: 'Hook #1 wins by quantifying the saved cost.',
        }),
      ]),
    );
    expect(result.current.activeRun).toBeNull();
  });

  it('still holds the tail for a settled run that has its cards (the fold has not landed yet)', () => {
    const { result } = renderHook(() =>
      useActiveRun([
        candidate({
          skill: 'hooks',
          blocks: [{ type: 'hook-card' }],
          stages: [{ name: 'Ran your audience', status: 'done' }],
          followupText: 'Hook #1 wins.',
        }),
      ]),
    );
    expect(result.current.activeRun?.skill).toBe('hooks');
    // The outro still rides along — excluding it from `hasContent` must not drop it from the run.
    expect(result.current.activeRun?.followupText).toBe('Hook #1 wins.');
  });

  it('a streaming run always wins the tail, even against a settled one with cards', () => {
    const { result } = renderHook(() =>
      useActiveRun([
        candidate({ skill: 'hooks', blocks: [{ type: 'hook-card' }] }),
        candidate({ skill: 'script', isStreaming: true }),
      ]),
    );
    expect(result.current.activeRun?.skill).toBe('script');
    expect(result.current.isAnyStreaming).toBe(true);
  });

  it('a failed run keeps the tail on its error alone, so the retry stays reachable', () => {
    const { result } = renderHook(() =>
      useActiveRun([candidate({ skill: 'hooks', error: 'Hooks stream error' })]),
    );
    expect(result.current.activeRun?.error).toBe('Hooks stream error');
  });

  /**
   * `isClosed` is what the composer's fold now waits on, so its DEFAULT is a behavioural decision,
   * not a formality: a stream that cannot say when it closed must fold on `done` exactly as it
   * always did. Getting this backwards would strand every non-generative run — chat, explore,
   * account-read, test — live on screen forever, because none of them will ever report a close.
   */
  it('defaults isClosed TRUE for a stream that does not report closure', () => {
    const { result } = renderHook(() =>
      useActiveRun([candidate({ skill: 'chat', isDone: true, blocks: [{}] })]),
    );
    expect(result.current.activeRun?.isClosed).toBe(true);
  });

  it('carries a reported isClosed through unchanged — including the not-yet-closed beat', () => {
    // The ~2s a generative route spends writing its closing line: done, but not closed. The fold
    // must be able to see that state, or it reloads before the outro exists and needs a second one.
    const { result } = renderHook(() =>
      useActiveRun([candidate({ skill: 'hooks', isDone: true, isClosed: false, blocks: [{}] })]),
    );
    expect(result.current.activeRun?.isDone).toBe(true);
    expect(result.current.activeRun?.isClosed).toBe(false);
  });

  it('an idle thread has no tail', () => {
    const { result } = renderHook(() => useActiveRun([candidate(), candidate({ skill: 'script' })]));
    expect(result.current.activeRun).toBeNull();
    expect(result.current.isAnyStreaming).toBe(false);
  });
});
