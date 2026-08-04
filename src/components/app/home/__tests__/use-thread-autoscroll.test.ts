/** @vitest-environment happy-dom */
/**
 * useThreadAutoscroll — keeps the newest turn in view in the home thread.
 *
 * THE DEFECT THIS GUARDS, measured signed-in in a real browser at `470ef6ae`: the home thread
 * region had no scroll management whatsoever. A creator sent a question into a restored thread and
 * `scrollTop` stayed at 0 while the answer rendered at y=1596 and the chips at y=1765, in a 900px
 * viewport. The screen was pixel-identical before and after the send — their own message never
 * appeared either. ~5,200 tests were green through it because nothing rendered wrong; the view
 * simply never moved.
 *
 * These tests lock the three contract behaviours. The third matters as much as the first two: an
 * autoscroll that cannot be escaped is worse than none, because it makes a streaming thread
 * impossible to read backwards.
 *
 * happy-dom does no layout, so `scrollHeight`/`clientHeight` are stubbed per element and
 * ResizeObserver is a hand-driven stub — the test fires the growth callback itself. That is the
 * honest shape here: the hook's job is to decide WHETHER to follow a growth, and that decision is
 * what is asserted. Whether the browser then paints it is verified live, not in jsdom.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useThreadAutoscroll, PIN_THRESHOLD_PX } from '../use-thread-autoscroll';

/** Fire the observed element's growth callback, the way a streaming token would. */
let fireResize: (() => void) | null = null;

class StubResizeObserver {
  constructor(private cb: () => void) {
    fireResize = () => this.cb();
  }
  observe() {}
  disconnect() {
    fireResize = null;
  }
}

beforeEach(() => {
  fireResize = null;
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * A scroll region with a content child, sized by hand. `scrollTop` is a real property in happy-dom
 * but is NOT clamped to the scrollable range, so the setter clamps the way a browser would —
 * otherwise `scrollTop = scrollHeight` would leave an impossible value and every assertion would
 * pass for the wrong reason.
 */
function makeRegion({ scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) {
  const el = document.createElement('div');
  const content = document.createElement('div');
  el.appendChild(content);
  document.body.appendChild(el);

  // Mutable, and the clamp reads them LIVE. Capturing the initial height here instead silently
  // clamps every later assertion to the thread's original size — the growth cases then "fail"
  // against a harness bug rather than the hook.
  let sh = scrollHeight;
  let top = 0;
  Object.defineProperty(el, 'scrollHeight', { get: () => sh, configurable: true });
  Object.defineProperty(el, 'clientHeight', { get: () => clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', {
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(v, sh - clientHeight));
      el.dispatchEvent(new Event('scroll'));
    },
    configurable: true,
  });
  /** The thread grew by `px` — what a streamed token does. */
  const grow = (px: number) => {
    sh += px;
  };
  return Object.assign(el, { grow }) as HTMLDivElement & { grow: (px: number) => void };
}

const BOTTOM = (el: HTMLElement) => el.scrollHeight - el.clientHeight;

describe('useThreadAutoscroll', () => {
  it('lands on the newest turn when a thread is registered (the reload defect)', () => {
    const el = makeRegion({ scrollHeight: 1683, clientHeight: 900 });
    const { result } = renderHook(() => useThreadAutoscroll('thread-1'));

    expect(el.scrollTop).toBe(0); // the measured defect: parked at the top, 783px unread below

    act(() => result.current.registerScrollRegion(el));
    act(() => fireResize?.());

    expect(el.scrollTop).toBe(BOTTOM(el));
  });

  it('follows a growing stream while the creator is at the bottom', () => {
    const el = makeRegion({ scrollHeight: 2000, clientHeight: 900 });
    const { result } = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => result.current.registerScrollRegion(el));
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(1100);

    // The turn streams: content grows, and the view must come with it.
    el.grow(2400);
    act(() => fireResize?.());

    expect(el.scrollTop).toBe(3500);
  });

  it('does NOT yank the view when the creator has scrolled up to read', () => {
    const el = makeRegion({ scrollHeight: 4000, clientHeight: 900 });
    const { result } = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => result.current.registerScrollRegion(el));
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(3100);

    // The creator scrolls back to an earlier card. That releases the pin.
    act(() => {
      el.scrollTop = 1200;
    });

    // The stream keeps producing. The view must stay exactly where they left it.
    el.grow(2000);
    act(() => fireResize?.());

    expect(el.scrollTop).toBe(1200);
  });

  it('re-pins once the creator scrolls back within the threshold', () => {
    const el = makeRegion({ scrollHeight: 4000, clientHeight: 900 });
    const { result } = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => result.current.registerScrollRegion(el));

    act(() => {
      el.scrollTop = 500;
    });
    el.grow(1000);
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(500); // still released

    // Back to within PIN_THRESHOLD_PX of the bottom — following resumes.
    act(() => {
      el.scrollTop = BOTTOM(el) - (PIN_THRESHOLD_PX - 10);
    });
    el.grow(2000);
    act(() => fireResize?.());

    expect(el.scrollTop).toBe(6100);
  });

  it('treats a released pin as thread-local — switching threads opens on the newest turn', () => {
    const el = makeRegion({ scrollHeight: 4000, clientHeight: 900 });
    const { result, rerender } = renderHook(({ id }) => useThreadAutoscroll(id), {
      initialProps: { id: 'thread-1' },
    });
    act(() => result.current.registerScrollRegion(el));
    act(() => {
      el.scrollTop = 300; // pin released in THIS thread
    });

    rerender({ id: 'thread-2' });

    // A different thread is a fresh read: it must not inherit the previous thread's released pin.
    expect(el.scrollTop).toBe(BOTTOM(el));
    el.grow(1200);
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(4300);
  });

  it('does not release its own pin when the deferred scroll event arrives after the thread grew', () => {
    // THE RACE, measured live: tapping a chip re-pinned and jumped to the bottom, then stopped
    // following two frames later. A `scroll` event is delivered on a LATER frame than the write
    // that caused it, and React flushes the optimistic user bubble in between — so the handler
    // read the position we had just written against a now-taller thread, computed 122px > the
    // 120px threshold, and concluded the creator had scrolled away.
    const el = makeRegion({ scrollHeight: 12894, clientHeight: 900 });
    const { result } = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => result.current.registerScrollRegion(el));

    act(() => {
      el.scrollTop = 600; // the creator had scrolled up to re-read an early card
    });
    act(() => result.current.scrollThreadToBottom()); // they tap a chip
    expect(el.scrollTop).toBe(11994);

    // The optimistic user bubble lands, THEN the deferred scroll event for our own write arrives.
    el.grow(122);
    act(() => el.dispatchEvent(new Event('scroll')));

    // The pin must have survived that, so the streaming answer is still followed.
    el.grow(2000);
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(BOTTOM(el));
  });

  it('survives an environment with no ResizeObserver instead of throwing', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
    const { result } = renderHook(() => useThreadAutoscroll('thread-1'));

    expect(() => act(() => result.current.registerScrollRegion(el))).not.toThrow();
    act(() => result.current.scrollThreadToBottom());
    expect(el.scrollTop).toBe(BOTTOM(el));
  });

  it('detaches its listener when the region unmounts', () => {
    const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
    const remove = vi.spyOn(el, 'removeEventListener');
    const { result } = renderHook(() => useThreadAutoscroll('thread-1'));

    act(() => result.current.registerScrollRegion(el));
    act(() => result.current.registerScrollRegion(null));

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
