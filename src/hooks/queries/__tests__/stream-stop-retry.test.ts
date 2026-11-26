// @vitest-environment happy-dom
/**
 * Stop and Retry on every skill stream the composer's live turn is built from.
 *
 * Stop: a run the creator stopped is still a run. Pressing Stop while the request is out (before a
 * single word, stage or card has arrived) used to leave the hook with nothing in it, so the live
 * turn, and with it the creator's own message, went from the screen. `isStopped` is the hook saying
 * "a run was here and was stopped": set only when Stop aborted a request in flight, cleared by the
 * next start, a refine and `reset()` (a thread switch resets every stream).
 *
 * Retry: the failed turn's Retry used to call `start("", platform)`, a different run (Auto mode,
 * no intent, no anchor; a remix with no link at all). `retry()` replays the last call exactly as it
 * was made, a refine as a refine, a "Find new outliers" with its scrape.
 *
 * The real hooks; the network is the only stand-in (`fetch`, answering with an SSE body that stays
 * open until aborted, ends at once, or a refusal).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatStream } from '@/hooks/queries/use-chat-stream';
import { useIdeasStream } from '@/hooks/queries/use-ideas-stream';
import { useHooksStream } from '@/hooks/queries/use-hooks-stream';
import { useScriptStream } from '@/hooks/queries/use-script-stream';
import { useRemixStream } from '@/hooks/queries/use-remix-stream';
import { useExploreStream } from '@/hooks/queries/use-explore-stream';
import { useAccountReadStream } from '@/hooks/queries/use-account-read-stream';
import { RUN_FAILURE_SENTINEL } from '@/lib/net/run-failure';

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
/** How the next requests answer: held open until aborted, ended at once, or refused. */
let reply: 'hold' | 'end' | 'fail' = 'hold';

function sse(signal: AbortSignal | null | undefined, hold: boolean): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!hold) {
        controller.close();
        return;
      }
      signal?.addEventListener('abort', () =>
        controller.error(new DOMException('The operation was aborted.', 'AbortError')),
      );
    },
  });
  return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
}

beforeEach(() => {
  calls = [];
  reply = 'hold';
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (reply === 'fail') return { ok: false, status: 500, json: async () => ({ error: 'boom' }) } as unknown as Response;
    return sse(init?.signal, reply === 'hold');
  }) as typeof fetch;
});

const bodies = () => calls.map((c) => ({ url: c.url, body: JSON.parse(String(c.init?.body ?? '{}')) }));

/** The surface every stream shares for these two behaviours. */
interface StopRetry {
  isStreaming: boolean;
  isStopped: boolean;
  stop: () => void;
  reset: () => void;
  retry: () => Promise<void>;
}

/** Each stream, with one real call of its own (the args the composer passes). */
const STREAMS: Array<{ name: string; use: () => StopRetry; call: (h: never) => Promise<void> }> = [
  {
    name: 'chat',
    use: useChatStream as unknown as () => StopRetry,
    call: ((h: ReturnType<typeof useChatStream>) => h.start('what should I post?', 'tiktok')) as never,
  },
  {
    name: 'ideas',
    use: useIdeasStream as unknown as () => StopRetry,
    call: ((h: ReturnType<typeof useIdeasStream>) => h.start('gym myths', 'tiktok', 'sell')) as never,
  },
  {
    name: 'hooks',
    use: useHooksStream as unknown as () => StopRetry,
    call: ((h: ReturnType<typeof useHooksStream>) => h.start('meal prep', 'instagram', 'grow')) as never,
  },
  {
    name: 'script',
    use: useScriptStream as unknown as () => StopRetry,
    call: ((h: ReturnType<typeof useScriptStream>) =>
      h.start('desk stretches', 'tiktok', 'I sit 10 hours a day.', 'grow')) as never,
  },
  {
    name: 'remix',
    use: useRemixStream as unknown as () => StopRetry,
    call: ((h: ReturnType<typeof useRemixStream>) =>
      h.start('https://www.tiktok.com/@a/video/1', 'tiktok', 'sell', 'make it about desks')) as never,
  },
  {
    name: 'explore',
    use: useExploreStream as unknown as () => StopRetry,
    call: ((h: ReturnType<typeof useExploreStream>) =>
      h.start({ niche: 'fitness', timeWindow: 'This week', serendipity: 0.3 })) as never,
  },
];

/** The account read has no Retry of its own (the composer replays it with `start`), so it is in Stop only. */
const STOP_STREAMS: Array<{ name: string; use: () => Omit<StopRetry, 'retry'>; call: (h: never) => Promise<void> }> = [
  ...STREAMS,
  {
    name: 'account',
    use: useAccountReadStream as unknown as () => Omit<StopRetry, 'retry'>,
    call: ((h: ReturnType<typeof useAccountReadStream>) => h.start()) as never,
  },
];

describe.each(STOP_STREAMS)('$name stream: Stop', ({ use, call }) => {
  it('Stop while the request is out: not streaming, and stopped', async () => {
    const { result } = renderHook(() => use());
    act(() => {
      void call(result.current as never);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.isStopped).toBe(false);

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.isStopped).toBe(true);
    expect(calls[0]!.init?.signal?.aborted).toBe(true);
  });

  it('reset() clears it (a thread switch never carries a stopped run over)', async () => {
    const { result } = renderHook(() => use());
    act(() => {
      void call(result.current as never);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.isStopped).toBe(true));
    act(() => result.current.reset());
    expect(result.current.isStopped).toBe(false);
  });

  it('the next start clears it', async () => {
    const { result } = renderHook(() => use());
    act(() => {
      void call(result.current as never);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.isStopped).toBe(true));
    act(() => {
      void call(result.current as never);
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(result.current.isStopped).toBe(false);
    expect(result.current.isStreaming).toBe(true);
    act(() => result.current.stop());
  });

  it('Stop with nothing in flight is not a stopped run: before any call, and after one ended', async () => {
    const { result } = renderHook(() => use());
    act(() => result.current.stop());
    expect(result.current.isStopped).toBe(false);

    reply = 'end';
    await act(async () => {
      await call(result.current as never);
    });
    expect(result.current.isStreaming).toBe(false);
    act(() => result.current.stop());
    expect(result.current.isStopped).toBe(false);
  });
});

describe.each(STREAMS)('$name stream: Retry', ({ use, call }) => {
  it('is a no-op before any call', async () => {
    const { result } = renderHook(() => use());
    await act(async () => {
      await result.current.retry();
    });
    expect(calls).toHaveLength(0);
  });

  it('replays the failed call with the same body', async () => {
    reply = 'fail';
    const { result } = renderHook(() => use());
    await act(async () => {
      await call(result.current as never);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      await result.current.retry();
    });
    expect(calls).toHaveLength(2);
    expect(bodies()[1]).toEqual(bodies()[0]);
  });
});

describe('Retry replays a refine as a refine, and "Find new outliers" with its scrape', () => {
  it('ideas: a refine is replayed to /api/tools/refine with the same body', async () => {
    reply = 'fail';
    const { result } = renderHook(() => useIdeasStream());
    await act(async () => {
      await result.current.start('gym myths', 'tiktok', 'sell');
    });
    const refine = { skill: 'idea' as const, instruction: 'tighten idea 2', anchor: 'Idea 2: …', cardRef: 2, platform: 'tiktok' };
    await act(async () => {
      await result.current.startRefine(refine);
    });
    await act(async () => {
      await result.current.retry();
    });
    expect(bodies()[2]).toEqual({ url: '/api/tools/refine', body: refine });
  });

  it('hooks: a refine is replayed to /api/tools/refine with the same body', async () => {
    reply = 'fail';
    const { result } = renderHook(() => useHooksStream());
    const refine = { skill: 'hooks' as const, instruction: 'make hook 1 punchier', anchor: 'Hook 1: …', cardRef: 1, platform: 'tiktok' };
    await act(async () => {
      await result.current.startRefine(refine);
    });
    await act(async () => {
      await result.current.retry();
    });
    expect(bodies()).toEqual([
      { url: '/api/tools/refine', body: refine },
      { url: '/api/tools/refine', body: refine },
    ]);
  });

  it('a refine clears a stopped run, as a start does', async () => {
    const { result } = renderHook(() => useHooksStream());
    act(() => {
      void result.current.start('meal prep', 'tiktok');
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.isStopped).toBe(true));
    act(() => {
      void result.current.startRefine({ skill: 'hooks', instruction: 'x', anchor: 'y' });
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(result.current.isStopped).toBe(false);
    act(() => result.current.stop());
  });

  it.each([
    ['ideas', useIdeasStream as unknown as () => ReturnType<typeof useHooksStream>],
    ['hooks', useHooksStream],
    ['script', useScriptStream as unknown as () => ReturnType<typeof useHooksStream>],
  ] as const)('%s: a failed "Find new outliers" is replayed with allowScrape', async (_name, use) => {
    reply = 'fail';
    const { result } = renderHook(() => use());
    await act(async () => {
      await result.current.start('gym myths', 'tiktok');
    });
    await act(async () => {
      await result.current.findOutliers();
    });
    await act(async () => {
      await result.current.retry();
    });
    expect(bodies()[1]!.body.allowScrape).toBe(true);
    expect(bodies()[2]).toEqual(bodies()[1]);
  });
});

describe('account stream: reset() ends the read in flight', () => {
  it('aborts the request, and is not a stopped run (a thread switch leaves nothing behind)', async () => {
    const { result } = renderHook(() => useAccountReadStream());
    act(() => {
      void result.current.start({ persist: true });
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => result.current.reset());
    expect(calls[0]!.init?.signal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.isStopped).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe('account stream: the route names a scrape failure', () => {
  const answering = (frames: string) => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(frames));
          c.close();
        },
      });
      return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
    }) as typeof fetch;
  };

  it('an error frame with cause scrape_failed sets the scrape sentinel', async () => {
    answering(`event: error\ndata: ${JSON.stringify({ message: "Couldn't read your account just now.", cause: 'scrape_failed', retry: true })}\n\n`);
    const { result } = renderHook(() => useAccountReadStream());
    await act(async () => {
      await result.current.start({ persist: true });
    });
    expect(result.current.error).toBe(RUN_FAILURE_SENTINEL.accountScrape);
  });

  it('an error frame with no cause keeps its own message', async () => {
    answering(`event: error\ndata: ${JSON.stringify({ message: 'Something else broke.' })}\n\n`);
    const { result } = renderHook(() => useAccountReadStream());
    await act(async () => {
      await result.current.start({ persist: true });
    });
    expect(result.current.error).toBe('Something else broke.');
  });
});
