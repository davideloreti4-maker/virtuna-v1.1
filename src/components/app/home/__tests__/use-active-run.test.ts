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
      useActiveRun([candidate({ skill: 'hooks', error: 'Hooks stream error', runs: 1 })]),
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

  it('a run stopped before anything arrived still holds the tail (its turn keeps the creator’s message)', () => {
    // Stop while "Thinking": not streaming, no blocks, no stages, no error. Only the flag says a
    // run was here.
    const { result, rerender } = renderHook(({ list }) => useActiveRun(list), {
      initialProps: { list: [candidate({ skill: 'chat', isStreaming: true })] },
    });
    rerender({ list: [candidate({ skill: 'chat', isStopped: true })] });
    expect(result.current.activeRun?.skill).toBe('chat');
    expect(result.current.activeRun?.isStreaming).toBe(false);
    expect(result.current.activeRun?.isDone).toBe(false);
    expect(result.current.isAnyStreaming).toBe(false);
  });

  it('a stopped run gives the tail up once another run starts, also after that run is reset', () => {
    // A chat stopped while thinking, then a hooks run: streaming, then folded into history
    // (`reset()`: nothing left in it). The stopped chat must not come back as the tail: it would
    // draw the creator's newest message a second time, under the folded run.
    const { result, rerender } = renderHook(({ list }) => useActiveRun(list), {
      initialProps: { list: [candidate({ skill: 'chat', isStreaming: true }), candidate({ skill: 'hooks' })] },
    });
    rerender({ list: [candidate({ skill: 'chat', isStopped: true }), candidate({ skill: 'hooks' })] });
    expect(result.current.activeRun?.skill).toBe('chat');
    rerender({ list: [candidate({ skill: 'chat', isStopped: true }), candidate({ skill: 'hooks', isStreaming: true })] });
    expect(result.current.activeRun?.skill).toBe('hooks');
    rerender({ list: [candidate({ skill: 'chat', isStopped: true }), candidate({ skill: 'hooks' })] });
    expect(result.current.activeRun).toBeNull();
  });

  it('a stopped run with words in it gives the tail up the same way', () => {
    // Stopped mid-answer: its words are blocks. Once another run has started and folded, the stopped
    // one must not come back as the tail: it would draw its words under the newer run's ask.
    const words = [{ type: 'markdown', props: { text: 'Post the gym' } }];
    const { result, rerender } = renderHook(({ list }) => useActiveRun(list), {
      initialProps: { list: [candidate({ skill: 'chat', isStreaming: true, blocks: words }), candidate({ skill: 'hooks' })] },
    });
    rerender({ list: [candidate({ skill: 'chat', isStopped: true, blocks: words }), candidate({ skill: 'hooks' })] });
    expect(result.current.activeRun?.skill).toBe('chat');
    expect(result.current.activeRun?.isStopped).toBe(true);
    rerender({ list: [candidate({ skill: 'chat', isStopped: true, blocks: words }), candidate({ skill: 'hooks', isStreaming: true })] });
    expect(result.current.activeRun?.skill).toBe('hooks');
    rerender({ list: [candidate({ skill: 'chat', isStopped: true, blocks: words }), candidate({ skill: 'hooks' })] });
    expect(result.current.activeRun).toBeNull();
  });

  it('runs are told apart by their stream: a chat stopped on a run it dispatched gives the tail up to that skill run on its own', () => {
    // The chat names its run by the skill it dispatched, so a stopped chat that dispatched hooks and
    // the hooks stream's own run share a skill. The hooks stream starting is still another run.
    const chat = (over: Partial<RunCandidate>) => candidate({ skill: 'hooks', stream: 'chat', ...over });
    const { result, rerender } = renderHook(({ list }) => useActiveRun(list), {
      initialProps: { list: [chat({ isStreaming: true }), candidate({ skill: 'hooks' })] },
    });
    rerender({ list: [chat({ isStopped: true }), candidate({ skill: 'hooks' })] });
    expect(result.current.activeRun?.isStopped).toBe(true);
    rerender({ list: [chat({ isStopped: true }), candidate({ skill: 'hooks', isStreaming: true })] });
    expect(result.current.activeRun?.isStopped).toBe(false);
    rerender({ list: [chat({ isStopped: true }), candidate({ skill: 'hooks' })] });
    expect(result.current.activeRun).toBeNull();
  });

  it('a failed run gives the tail up once another run starts, also after that run is reset', () => {
    // A hooks run that failed (its Retry on screen), then a chat run that folds into history. The
    // failed run is never reset, and must not come back with its Retry under the chat's ask.
    const { result, rerender } = renderHook(({ list }) => useActiveRun(list), {
      initialProps: { list: [candidate({ skill: 'hooks', isStreaming: true }), candidate({ skill: 'chat' })] },
    });
    rerender({ list: [candidate({ skill: 'hooks', error: 'boom' }), candidate({ skill: 'chat' })] });
    expect(result.current.activeRun?.error).toBe('boom');
    rerender({ list: [candidate({ skill: 'hooks', error: 'boom' }), candidate({ skill: 'chat', isStreaming: true })] });
    expect(result.current.activeRun?.skill).toBe('chat');
    rerender({ list: [candidate({ skill: 'hooks', error: 'boom' }), candidate({ skill: 'chat' })] });
    expect(result.current.activeRun).toBeNull();
  });

  it('a run refused before a render ever saw it streaming still holds the tail: it is the newest run', () => {
    // A request refused at once can end in the same render it started in. It never streams on
    // screen, yet it is the run the creator just sent (its stream counted a new start), newer than
    // the folded one before it.
    const { result, rerender } = renderHook(({ list }) => useActiveRun(list), {
      initialProps: { list: [candidate({ skill: 'hooks', isStreaming: true, runs: 1 }), candidate({ skill: 'chat' })] },
    });
    rerender({ list: [candidate({ skill: 'hooks', runs: 1 }), candidate({ skill: 'chat' })] });
    rerender({ list: [candidate({ skill: 'hooks', runs: 1 }), candidate({ skill: 'chat', error: 'refused', runs: 1 })] });
    expect(result.current.activeRun?.skill).toBe('chat');
    expect(result.current.activeRun?.error).toBe('refused');
  });

  it('…also when that stream already held an older failure: its new start is what counts, not what it holds', () => {
    // Hooks fails, then script fails, then hooks is retried and refused at once. The hooks stream held
    // an error before and after; only its count of starts says it ran again.
    const hooks = (over: Partial<RunCandidate>) => candidate({ skill: 'hooks', ...over });
    const script = (over: Partial<RunCandidate>) => candidate({ skill: 'script', ...over });
    const { result, rerender } = renderHook(({ list }) => useActiveRun(list), {
      initialProps: { list: [hooks({ isStreaming: true, runs: 1 }), script({})] },
    });
    rerender({ list: [hooks({ error: 'first', runs: 1 }), script({})] });
    rerender({ list: [hooks({ error: 'first', runs: 1 }), script({ isStreaming: true, runs: 1 })] });
    rerender({ list: [hooks({ error: 'first', runs: 1 }), script({ error: 'second', runs: 1 })] });
    expect(result.current.activeRun?.skill).toBe('script');
    rerender({ list: [hooks({ error: 'refused', runs: 2 }), script({ error: 'second', runs: 1 })] });
    expect(result.current.activeRun?.skill).toBe('hooks');
    expect(result.current.activeRun?.error).toBe('refused');
  });

  it('carries retry through, so Retry replays the stream that owns the tail', () => {
    let replayed = 0;
    const { result } = renderHook(() =>
      useActiveRun([candidate({ skill: 'ideas', error: 'boom', runs: 1, retry: () => { replayed += 1; } })]),
    );
    result.current.activeRun?.retry?.();
    expect(replayed).toBe(1);
  });

  it('an idle thread has no tail', () => {
    const { result } = renderHook(() => useActiveRun([candidate(), candidate({ skill: 'script' })]));
    expect(result.current.activeRun).toBeNull();
    expect(result.current.isAnyStreaming).toBe(false);
  });
});
