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
import {
  useThreadAutoscroll,
  PIN_THRESHOLD_PX,
  ANCHOR_TOP_PX,
  SETTLE_MAX_PX,
  HIDDEN_MIN_PX,
} from '../use-thread-autoscroll';

/**
 * The new look's parts of the hook (`hiddenBelow`, the region's `--thread-room`) run only with the
 * flag on. Off by default here, so the eight original cases run against exactly what the flag-off
 * build runs; the new-look cases switch it on.
 */
const flag = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/flags/new-look', () => ({
  get NEW_LOOK_ENABLED() {
    return flag.on;
  },
}));

/** Fire the observed element's growth callback, the way a streaming token would. */
let fireResize: (() => void) | null = null;
/** New look: fire the callback of the observer on the region's own box (a window resize). */
let fireRegionResize: (() => void) | null = null;

class StubResizeObserver {
  private role: 'content' | 'region' | null = null;
  constructor(private cb: () => void) {}
  observe(target: Element) {
    // The hook watches the content wrapper for growth and, in the new look, the region itself for
    // its size. `makeRegion` marks the region so the two can be told apart.
    if (target.hasAttribute('data-test-region')) {
      this.role = 'region';
      fireRegionResize = () => this.cb();
    } else {
      this.role = 'content';
      fireResize = () => this.cb();
    }
  }
  disconnect() {
    if (this.role === 'region') fireRegionResize = null;
    if (this.role === 'content') fireResize = null;
  }
}

beforeEach(() => {
  fireResize = null;
  fireRegionResize = null;
  flag.on = false;
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
  el.setAttribute('data-test-region', '');
  const content = document.createElement('div');
  el.appendChild(content);
  document.body.appendChild(el);

  // Mutable, and the clamp reads them LIVE. Capturing the initial height here instead silently
  // clamps every later assertion to the thread's original size — the growth cases then "fail"
  // against a harness bug rather than the hook.
  let sh = scrollHeight;
  let ch = clientHeight;
  let top = 0;
  Object.defineProperty(el, 'scrollHeight', { get: () => sh, configurable: true });
  Object.defineProperty(el, 'clientHeight', { get: () => ch, configurable: true });
  // The range is read through the element, so a test that lays the content out itself (its own
  // `scrollHeight`) is clamped by it too.
  const maxTop = () => el.scrollHeight - el.clientHeight;
  Object.defineProperty(el, 'scrollTop', {
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(v, maxTop()));
      el.dispatchEvent(new Event('scroll'));
    },
    configurable: true,
  });
  /** The thread grew by `px` — what a streamed token does. */
  const grow = (px: number) => {
    sh += px;
  };
  /**
   * The region's own box is now `next` tall (a window resize, a rotation). As a browser lays it
   * out: the position is clamped to the new range at once, and the scroll event that clamp causes
   * comes on a later frame, after the resize observers (returned, for the test to fire).
   */
  const resize = (next: number) => {
    ch = next;
    top = Math.max(0, Math.min(top, maxTop()));
    return () => el.dispatchEvent(new Event('scroll'));
  };
  return Object.assign(el, { grow, resize }) as HTMLDivElement & {
    grow: (px: number) => void;
    resize: (next: number) => () => void;
  };
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

// ── New look (thread feel, step 1): a newly sent turn sits at the top ────────────────────────────

/** A box as `getBoundingClientRect` reports it: a top and a height, in the viewport. */
function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/**
 * Add a turn to the region's content, laid out by hand (happy-dom does no layout): `top` is where
 * the turn starts in the content and `end` where its content ends (the bottom of its last child).
 * Both are read against the LIVE scrollTop, as a browser's rects are; the region itself sits at the
 * viewport's top (happy-dom's default rect). The returned `set` moves them, the way content above
 * or inside the turn growing would. `send`: the send the turn belongs to (`data-send`, as the
 * stream marks the live turn and the tail); a persisted turn has none.
 */
function addTurn(el: HTMLElement, at: { top: number; end: number; send?: number; room?: boolean }) {
  const geo = { top: at.top, end: at.end };
  const turn = document.createElement('div');
  turn.setAttribute('data-turn', 'later');
  if (at.send !== undefined) turn.setAttribute('data-send', String(at.send));
  // The stream's `data-room`: the last turn, once a turn was sent in this visit.
  if (at.room) turn.setAttribute('data-room', '');
  const bubble = document.createElement('div');
  const answer = document.createElement('div');
  turn.append(bubble, answer);
  el.firstElementChild!.appendChild(turn);
  turn.getBoundingClientRect = () => rect(geo.top - el.scrollTop, geo.end - geo.top);
  bubble.getBoundingClientRect = () => rect(geo.top - el.scrollTop, 40);
  answer.getBoundingClientRect = () => rect(geo.top + 54 - el.scrollTop, geo.end - geo.top - 54);
  return Object.assign(turn, { set: (next: Partial<typeof geo>) => Object.assign(geo, next) });
}

/** Animation frames by hand: `flushFrames` runs them 16 ms apart until none is left. */
function fakeFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let clock = 0;
  const request = vi.fn((cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('requestAnimationFrame', request);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
  const flushFrames = () => {
    for (let guard = 0; queue.size > 0 && guard < 200; guard++) {
      clock += 16;
      const due = [...queue.entries()];
      queue.clear();
      for (const [, cb] of due) act(() => cb(clock));
    }
  };
  /** Run `n` frames only (a move still on its way). */
  const runFrames = (n: number) => {
    for (let i = 0; i < n && queue.size > 0; i++) {
      clock += 16;
      const due = [...queue.entries()];
      queue.clear();
      for (const [, cb] of due) act(() => cb(clock));
    }
  };
  return { request, flushFrames, runFrames, pending: () => queue.size };
}

/** The creator's motion setting. Only the exact reduce query matches. */
function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('useThreadAutoscroll — new look: the sent turn at the top', () => {
  beforeEach(() => {
    flag.on = true;
    prefersReducedMotion(false);
  });

  /** A thread of one answered turn, registered and resting at its end (pinned). */
  function threadAtEnd() {
    const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
    const first = addTurn(el, { top: 22, end: 2400 });
    const hook = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => hook.result.current.registerScrollRegion(el));
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(2100); // at the end, as today
    return { el, first, hook };
  }

  it('armed, the sent turn appears (marked with the arm\'s send): its top lands 8 under the region top, and growth then leaves the view alone', () => {
    const { flushFrames } = fakeFrames();
    const { el, hook } = threadAtEnd();

    let given = 0;
    act(() => {
      given = hook.result.current.anchorNextTurn(); // the number the composer stamps the turn's slot with
    });
    expect(given).toBe(1);
    // The number lives in the hook's ref and the call's return value only: no state of its own
    // (the composer keeps one number per slot).
    expect(hook.result.current).not.toHaveProperty('sendSeq');
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(900); // the turn and the room it takes
    act(() => fireResize?.());
    flushFrames();

    expect(el.scrollTop).toBe(2430 - ANCHOR_TOP_PX);

    // The answer streams under it: the view stays (the pin was released).
    el.grow(1500);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(2422);

    // The arm was used up: another element of that same send (the stream re-mounting it) is not
    // taken to the top again.
    addTurn(el, { top: 4000, end: 4100, send: 1 });
    el.grow(400);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(2422);
  });

  it('on a phone the top band is padding: the turn lands 8 under the band, not under the header', () => {
    // The region's top padding is the phone's header band (`pt-[var(--nav-pt)]`, 0 from md), which
    // the shell's opaque header covers. 8 under the region's own top edge would hide the bubble.
    const { flushFrames } = fakeFrames();
    const { el, hook } = threadAtEnd();
    el.style.paddingTop = '46px';

    act(() => hook.result.current.anchorNextTurn());
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(900);
    act(() => fireResize?.());
    flushFrames();

    expect(el.scrollTop).toBe(2430 - 46 - ANCHOR_TOP_PX);
  });

  it('armed, growth without the sent turn: no scroll, even at the end; after 10,000 ms the arm is gone and the end is followed again', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { flushFrames } = fakeFrames();
    const { el, first, hook } = threadAtEnd();

    act(() => hook.result.current.anchorNextTurn());
    // The last turn grows (the room moves to it a beat before the sent turn mounts): held.
    first.set({ end: 2700 });
    el.grow(300);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(2100);

    act(() => vi.advanceTimersByTime(10_000));

    // Nothing came: the arm is dropped. Even that send's turn, appearing now, is followed to the
    // end by today's pin rule, and not taken to the top.
    addTurn(el, { top: 3330, end: 3500, send: 1 });
    el.grow(600);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(BOTTOM(el));
    expect(el.scrollTop).not.toBe(3330 - ANCHOR_TOP_PX);
  });

  it('a turn that appears late (9 s: a run whose turn lands only with its result) is still taken to the top', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { flushFrames } = fakeFrames();
    const { el, hook } = threadAtEnd();

    act(() => hook.result.current.anchorNextTurn());
    act(() => vi.advanceTimersByTime(9_000));
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(900);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(2422);
  });

  describe('anchored: the room exists from the send on, and a send that never came leaves no trace', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      prefersReducedMotion(true);
    });

    const anchorOne = (el: HTMLDivElement & { grow: (px: number) => void }, hook: { result: { current: ReturnType<typeof useThreadAutoscroll> } }, top: number) => {
      let seq = 0;
      act(() => {
        seq = hook.result.current.anchorNextTurn();
      });
      addTurn(el, { top, end: top + 170, send: seq });
      el.grow(900);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(top - ANCHOR_TOP_PX);
    };

    it('false on a chat only opened; true from the anchorNextTurn() call on, before any turn appears', () => {
      const { hook } = threadAtEnd();
      expect(hook.result.current.anchored).toBe(false);
      act(() => hook.result.current.anchorNextTurn());
      expect(hook.result.current.anchored).toBe(true);
    });

    it('stays true after an anchor, well past the window', () => {
      const { el, hook } = threadAtEnd();
      anchorOne(el, hook, 2430);
      act(() => vi.advanceTimersByTime(60_000));
      expect(hook.result.current.anchored).toBe(true);
    });

    it('reverts after an expired arm when nothing had anchored before (a send that bailed)', () => {
      const { hook } = threadAtEnd();
      act(() => hook.result.current.anchorNextTurn());
      act(() => vi.advanceTimersByTime(9_999));
      expect(hook.result.current.anchored).toBe(true);
      act(() => vi.advanceTimersByTime(1));
      expect(hook.result.current.anchored).toBe(false);
    });

    it('stays true after an expired arm when an earlier send had anchored', () => {
      const { el, hook } = threadAtEnd();
      anchorOne(el, hook, 2430);
      act(() => hook.result.current.anchorNextTurn()); // a second send that bails
      act(() => vi.advanceTimersByTime(10_000));
      expect(hook.result.current.anchored).toBe(true);
    });

    it('two sends that both bail: back to false, not to the first arm\'s true', () => {
      const { hook } = threadAtEnd();
      act(() => hook.result.current.anchorNextTurn());
      act(() => vi.advanceTimersByTime(4_000));
      act(() => hook.result.current.anchorNextTurn());
      act(() => vi.advanceTimersByTime(10_000));
      expect(hook.result.current.anchored).toBe(false);
    });

    it('false after a thread switch, and a send armed before the switch does not anchor in the next chat', () => {
      const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
      addTurn(el, { top: 22, end: 2400 });
      const hook = renderHook(({ id }) => useThreadAutoscroll(id), {
        initialProps: { id: 'thread-1' as string | null },
      });
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => fireResize?.());
      anchorOne(el, hook, 2430);
      act(() => hook.result.current.anchorNextTurn()); // armed when the switch comes

      hook.rerender({ id: null });
      expect(hook.result.current.anchored).toBe(false);
      el.firstElementChild!.replaceChildren();
      addTurn(el, { top: 22, end: 2400 });
      hook.rerender({ id: 'thread-2' });
      expect(hook.result.current.anchored).toBe(false);

      // The other chat's turns are not the send's: the dropped arm takes nothing to the top.
      addTurn(el, { top: 2430, end: 2600, send: 2 });
      el.grow(900);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(BOTTOM(el));
      expect(hook.result.current.anchored).toBe(false);
    });

    it('a new chat\'s first send: the id it gets (announced, before or after its turn) keeps the arm and the room', () => {
      // Before: the id lands while the arm waits; the turn then still anchors.
      const el = makeRegion({ scrollHeight: 900, clientHeight: 900 });
      const hook = renderHook(({ id }) => useThreadAutoscroll(id), {
        initialProps: { id: null as string | null },
      });
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => fireResize?.());
      act(() => hook.result.current.anchorNextTurn());
      act(() => hook.result.current.expectNewThread()); // ensureThreadForSend, right before the id
      hook.rerender({ id: 't-new' });
      expect(hook.result.current.anchored).toBe(true);
      addTurn(el, { top: 300, end: 420, send: 1 });
      el.grow(1200);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(292);
      act(() => vi.advanceTimersByTime(10_000));
      expect(hook.result.current.anchored).toBe(true);

      // After: the turn anchored first, then the id lands (the order of 'a send in a chat with no
      // id yet' above): still anchored.
      const el2 = makeRegion({ scrollHeight: 900, clientHeight: 900 });
      const hook2 = renderHook(({ id }) => useThreadAutoscroll(id), {
        initialProps: { id: null as string | null },
      });
      act(() => hook2.result.current.registerScrollRegion(el2));
      act(() => fireResize?.());
      act(() => hook2.result.current.anchorNextTurn());
      addTurn(el2, { top: 300, end: 420, send: 1 });
      el2.grow(1200);
      act(() => fireResize?.());
      act(() => hook2.result.current.expectNewThread());
      hook2.rerender({ id: 't-new' });
      expect(hook2.result.current.anchored).toBe(true);
      expect(el2.scrollTop).toBe(292);
    });

    it('a send that bails on Home, then a past chat opened inside the window: it opens at its end, with no room and no arm', () => {
      // No id was announced (the send never made a chat), so the id that lands is a chat being
      // opened, not the send's own: a switch.
      const el = makeRegion({ scrollHeight: 900, clientHeight: 900 });
      const hook = renderHook(({ id }) => useThreadAutoscroll(id), {
        initialProps: { id: null as string | null },
      });
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => fireResize?.());
      act(() => hook.result.current.anchorNextTurn()); // the send that bails
      expect(hook.result.current.anchored).toBe(true);
      act(() => vi.advanceTimersByTime(3_000));

      hook.rerender({ id: 'thread-past' });
      expect(hook.result.current.anchored).toBe(false);
      // Its turns land: the last one mounting is not taken for the send's turn, even marked with
      // that send's number; the chat opens at its end.
      addTurn(el, { top: 22, end: 1300 });
      addTurn(el, { top: 1330, end: 2400, send: 1 });
      el.grow(1600);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(BOTTOM(el));
      act(() => vi.advanceTimersByTime(10_000));
      expect(hook.result.current.anchored).toBe(false);
    });

    it('releaseSend(): a send whose turn went away (anchored, then removed) puts anchored back, and the pin rule decides the view', () => {
      const { el, hook } = threadAtEnd();
      const sent = addTurn(el, { top: 2430, end: 2600, send: 1 });
      act(() => hook.result.current.anchorNextTurn());
      el.grow(900);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(2422);
      expect(hook.result.current.anchored).toBe(true);

      act(() => hook.result.current.releaseSend()); // the refused upload: its turn goes
      expect(hook.result.current.anchored).toBe(false);
      sent.remove();
      el.grow(-900);
      act(() => fireResize?.());
      // At the (shrunk) end, so within the pin's reach: pinned, and the end is followed again.
      expect(el.scrollTop).toBe(BOTTOM(el));
      el.grow(400);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(BOTTOM(el));
    });

    it('releaseSend() after an earlier send that anchored: anchored stays true (what it was before this send)', () => {
      const { el, hook } = threadAtEnd();
      anchorOne(el, hook, 2430);
      act(() => hook.result.current.anchorNextTurn());
      addTurn(el, { top: 2630, end: 2800, send: 2 });
      el.grow(200);
      act(() => fireResize?.());
      act(() => hook.result.current.releaseSend());
      expect(hook.result.current.anchored).toBe(true);
    });

    it('releaseSend() of a send still waiting: the arm goes (its turn, if it came later, is not taken to the top) and anchored is back', () => {
      const { el, hook } = threadAtEnd();
      act(() => hook.result.current.anchorNextTurn());
      act(() => hook.result.current.releaseSend());
      expect(hook.result.current.anchored).toBe(false);
      addTurn(el, { top: 2430, end: 2600, send: 1 });
      el.grow(900);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(BOTTOM(el));
    });

    it('releaseSend() with no send of this visit does nothing', () => {
      const { el, hook } = threadAtEnd();
      act(() => hook.result.current.releaseSend());
      expect(hook.result.current.anchored).toBe(false);
      el.grow(300);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(BOTTOM(el));
    });

    it('an announcement does not outlive its arm: a chat opened after the window ran out is a switch', () => {
      const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
      addTurn(el, { top: 22, end: 2400 });
      const hook = renderHook(({ id }) => useThreadAutoscroll(id), {
        initialProps: { id: null as string | null },
      });
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => hook.result.current.anchorNextTurn());
      act(() => hook.result.current.expectNewThread());
      act(() => vi.advanceTimersByTime(10_000)); // the send bailed after all; no id came
      expect(hook.result.current.anchored).toBe(false);

      // A chat opened later is a switch, not that send's chat.
      act(() => hook.result.current.anchorNextTurn());
      hook.rerender({ id: 'thread-past' });
      expect(hook.result.current.anchored).toBe(false);
    });
  });

  describe('the sent turn is known by its send, not by which element is last', () => {
    beforeEach(() => prefersReducedMotion(true));

    it('a previous run folding into history between the arm and the sent turn is not taken for it; the sent turn then anchors', () => {
      const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
      addTurn(el, { top: 22, end: 1300 });
      const before = addTurn(el, { top: 1330, end: 2400, send: 0 }); // the last run, still live
      const hook = renderHook(() => useThreadAutoscroll('thread-1'));
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => fireResize?.());
      act(() => {
        el.scrollTop = 1200; // the creator reads the last answer, a little up
      });

      act(() => hook.result.current.anchorNextTurn());
      // The last run folds: its live element goes, its persisted copy (a new element, no send) comes.
      before.remove();
      addTurn(el, { top: 1330, end: 2400 });
      el.grow(10);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(1200);

      addTurn(el, { top: 2430, end: 2600, send: 1 });
      el.grow(900);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(2422);
    });

    it('the same place sent again (a new element of the next send, where the last live turn was) anchors again', () => {
      const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
      addTurn(el, { top: 22, end: 1300 });
      let renders = 0;
      const hook = renderHook(() => {
        renders += 1;
        return useThreadAutoscroll('thread-1');
      });
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => fireResize?.());
      act(() => hook.result.current.anchorNextTurn());
      const first = addTurn(el, { top: 1330, end: 1500, send: 1 });
      el.grow(800);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(1322);

      act(() => {
        el.scrollTop = 400; // back up to the first answer
      });
      let seq = 0;
      const before = renders;
      act(() => {
        seq = hook.result.current.anchorNextTurn();
      });
      expect(seq).toBe(2);
      expect(renders).toBe(before); // already anchored: the send's number costs no render
      first.remove();
      addTurn(el, { top: 1330, end: 1500, send: 2 });
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(1322);
    });

    it('a sent turn with no question (a skill run on its own) anchors', () => {
      const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
      addTurn(el, { top: 22, end: 1300 });
      const hook = renderHook(() => useThreadAutoscroll('thread-1'));
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => fireResize?.());
      act(() => hook.result.current.anchorNextTurn());
      const turn = document.createElement('div');
      turn.setAttribute('data-turn', 'answer');
      turn.setAttribute('data-send', '1');
      const answer = document.createElement('div');
      turn.appendChild(answer);
      el.firstElementChild!.appendChild(turn);
      turn.getBoundingClientRect = () => rect(1330 - el.scrollTop, 200);
      el.grow(800);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(1322);
    });
  });

  it('not armed: a new turn is followed to the end exactly as today', () => {
    const { flushFrames } = fakeFrames();
    const { el } = threadAtEnd();

    addTurn(el, { top: 2430, end: 2600 });
    el.grow(900);
    act(() => fireResize?.());
    flushFrames();

    expect(el.scrollTop).toBe(BOTTOM(el));
  });

  it('a send in a chat with no id yet: the id that lands after the anchor does not take the view to the end', () => {
    // Home's first send gets its chat's id from that same send (`ensureThreadForSend`), so the
    // thread key changes in the commit that mounts the turn, and the key's effect runs after the
    // anchor. Re-pinning there would undo it.
    const { flushFrames } = fakeFrames();
    const el = makeRegion({ scrollHeight: 900, clientHeight: 900 });
    const hook = renderHook(({ id }) => useThreadAutoscroll(id), {
      initialProps: { id: null as string | null },
    });
    act(() => hook.result.current.registerScrollRegion(el));
    act(() => fireResize?.());

    act(() => hook.result.current.anchorNextTurn());
    addTurn(el, { top: 300, end: 420, send: 1 });
    el.grow(1200);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(292);

    act(() => hook.result.current.expectNewThread()); // ensureThreadForSend, right before the id
    hook.rerender({ id: 't-new' });
    expect(el.scrollTop).toBe(292);
    el.grow(800);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(292);
  });

  it('a real switch after a send still opens the other chat at its end', () => {
    const { flushFrames } = fakeFrames();
    const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
    addTurn(el, { top: 22, end: 2400 });
    const hook = renderHook(({ id }) => useThreadAutoscroll(id), {
      initialProps: { id: 'thread-1' as string | null },
    });
    act(() => hook.result.current.registerScrollRegion(el));
    act(() => fireResize?.());
    act(() => hook.result.current.anchorNextTurn());
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(900);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(2422);

    // The switch closes the chat (no id) and empties the thread, the anchored turn with it; the
    // other chat's turns land with the view at their top. Its id must take the view to the end.
    hook.rerender({ id: null });
    el.firstElementChild!.replaceChildren();
    addTurn(el, { top: 22, end: 2400 });
    act(() => {
      el.scrollTop = 0;
    });
    hook.rerender({ id: 'thread-2' });
    expect(el.scrollTop).toBe(BOTTOM(el));
  });

  it("the hook's own animation frames are not read as the creator's; the creator's own scroll stops the move", () => {
    const { flushFrames, runFrames, pending } = fakeFrames();
    const { el, hook } = threadAtEnd();

    act(() => hook.result.current.anchorNextTurn());
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(900);
    act(() => fireResize?.());
    runFrames(5); // mid-way: every frame's write fired a scroll event (the region stub does)
    expect(pending()).toBe(1); // still moving: none of those events stopped it

    // The creator takes the wheel: the move stops where they put the view.
    act(() => {
      el.scrollTop = 1500;
    });
    flushFrames();
    expect(el.scrollTop).toBe(1500);
  });

  /** A region with its sent turn taken to the top by the hook (the view at 1000), as `settle` finds it. */
  function sentTurnAt1000(paddingBottom?: string) {
    const el = makeRegion({ scrollHeight: 4000, clientHeight: 900 });
    // The reserve under the field: the visible end is the region's bottom less its padding.
    if (paddingBottom) el.style.paddingBottom = paddingBottom;
    const hook = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => hook.result.current.registerScrollRegion(el));
    act(() => hook.result.current.anchorNextTurn());
    const turn = addTurn(el, { top: 1008, end: 1100, send: 1 });
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(1000);
    return { el, hook, turn };
  }

  it('settle(): an end 90 under the visible end moves down 98; 300 under, or in view, nothing', () => {
    prefersReducedMotion(true);
    const { el, hook, turn } = sentTurnAt1000('126px');
    const visibleEnd = 900 - 126;

    turn.set({ end: 1000 + visibleEnd + 90 });
    act(() => hook.result.current.settle());
    expect(el.scrollTop).toBe(1098);

    // From the place the hook put it (1098): 300 under, nothing; in view, nothing.
    turn.set({ end: 1098 + visibleEnd + 300 });
    act(() => hook.result.current.settle());
    expect(el.scrollTop).toBe(1098);

    turn.set({ end: 1098 + visibleEnd - 20 });
    act(() => hook.result.current.settle());
    expect(el.scrollTop).toBe(1098);
  });

  it('settle() reads the end of the turn\'s content, not its box (the room makes the box taller)', () => {
    prefersReducedMotion(true);
    const { el, hook, turn } = sentTurnAt1000();
    turn.set({ end: 1000 + 900 + 90 });
    // The turn's own box reaches far below its content: the room it took.
    turn.getBoundingClientRect = () => rect(1008 - el.scrollTop, 3000);
    act(() => hook.result.current.settle());
    expect(el.scrollTop).toBe(1098);
  });

  it('settle() leaves a view the creator moved last: one who scrolled back a little is not pulled down', () => {
    prefersReducedMotion(true);
    const { el, hook, turn } = sentTurnAt1000();
    act(() => {
      el.scrollTop = 960; // the creator scrolls back up 40 to reread the question
    });
    turn.set({ end: 960 + 900 + 90 }); // the answer is in, its end 90 under the visible end
    act(() => hook.result.current.settle());
    expect(el.scrollTop).toBe(960);
  });

  it('hiddenBelow: false at the end, true past 150 under the visible end, false again after scrollToLatest()', () => {
    const { flushFrames } = fakeFrames();
    let renders = 0;
    const el = makeRegion({ scrollHeight: 2642, clientHeight: 900 });
    el.style.paddingBottom = '126px';
    addTurn(el, { top: 1000, end: 2500 });
    const hook = renderHook(() => {
      renders += 1;
      return useThreadAutoscroll('thread-1');
    });
    act(() => hook.result.current.registerScrollRegion(el));
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(1742);
    expect(hook.result.current.hiddenBelow).toBe(false);

    // The creator scrolls up: 384 of the answer's end is under the field.
    act(() => {
      el.scrollTop = 1342;
    });
    expect(hook.result.current.hiddenBelow).toBe(true);
    const settled = renders;
    act(() => {
      el.scrollTop = 1300; // still hidden: no new render for the same answer
    });
    expect(renders).toBe(settled);

    // Within 150: not hidden.
    act(() => {
      el.scrollTop = 1742 - (HIDDEN_MIN_PX - 60);
    });
    expect(hook.result.current.hiddenBelow).toBe(false);

    act(() => {
      el.scrollTop = 1200;
    });
    expect(hook.result.current.hiddenBelow).toBe(true);
    act(() => hook.result.current.scrollToLatest());
    flushFrames();
    expect(el.scrollTop).toBe(1742);
    expect(hook.result.current.hiddenBelow).toBe(false);

    // …and the end is followed again (scrollToLatest pins).
    el.grow(500);
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(2242);
  });

  it('scrollToLatest() follows an end that moves while it travels', () => {
    const { flushFrames, runFrames } = fakeFrames();
    const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
    addTurn(el, { top: 22, end: 2900 });
    const hook = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => hook.result.current.registerScrollRegion(el));
    act(() => {
      el.scrollTop = 400;
    });
    act(() => hook.result.current.scrollToLatest());
    runFrames(4);
    el.grow(700); // the answer streams while the view travels
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(BOTTOM(el));
  });

  it('--thread-room is the region\'s height, on register and after a resize', () => {
    const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
    const hook = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => hook.result.current.registerScrollRegion(el));
    expect(el.style.getPropertyValue('--thread-room')).toBe('900px');

    Object.defineProperty(el, 'clientHeight', { get: () => 640, configurable: true }); // the phone's keyboard
    act(() => fireRegionResize?.());
    expect(el.style.getPropertyValue('--thread-room')).toBe('640px');
  });

  describe('the window grows under an anchored view (a taller window, a rotation, a keyboard closing in a wrapper)', () => {
    beforeEach(() => prefersReducedMotion(true));

    /**
     * A thread whose content is laid out as a browser does it: 2430 above the sent turn, then the
     * turn's least height, the room (`--thread-room`, the window's height). Its sent turn is taken
     * to the top: anchored at 2422, 8 from the scroll's end.
     */
    function anchoredInRoom() {
      const el = makeRegion({ scrollHeight: 0, clientHeight: 900 });
      const room = () => parseFloat(el.style.getPropertyValue('--thread-room')) || 0;
      Object.defineProperty(el, 'scrollHeight', { get: () => 2430 + room(), configurable: true });
      addTurn(el, { top: 22, end: 2400 });
      const hook = renderHook(() => useThreadAutoscroll('thread-1'));
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => fireResize?.());
      act(() => hook.result.current.anchorNextTurn());
      addTurn(el, { top: 2430, end: 2600, send: 1, room: true });
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(2422);
      return { el, hook };
    }

    it('the browser clamps the view to the old room; once the room has the new height the turn is back 8 under the top, and the clamp\'s late event is not the creator\'s', () => {
      const { el, hook } = anchoredInRoom();
      const clampEvent = el.resize(1100);
      expect(el.scrollTop).toBe(2430 + 900 - 1100); // clamped: the old room is too short for 2422

      act(() => fireRegionResize?.());
      expect(el.style.getPropertyValue('--thread-room')).toBe('1100px');
      expect(el.scrollTop).toBe(2422);

      act(() => clampEvent());
      expect(el.scrollTop).toBe(2422);
      expect(hook.result.current.isPinned()).toBe(false);
    });

    it('a view the creator moved last is left where the browser put it', () => {
      const { el } = anchoredInRoom();
      act(() => {
        el.scrollTop = 2300; // the creator's own scroll
      });
      el.resize(1300);
      expect(el.scrollTop).toBe(2430 + 900 - 1300);
      act(() => fireRegionResize?.());
      expect(el.style.getPropertyValue('--thread-room')).toBe('1300px');
      expect(el.scrollTop).toBe(2030);
    });

    it('a smaller window needs nothing: the view stays where it was', () => {
      const { el } = anchoredInRoom();
      el.resize(640);
      act(() => fireRegionResize?.());
      expect(el.style.getPropertyValue('--thread-room')).toBe('640px');
      expect(el.scrollTop).toBe(2422);
    });
  });

  it('with the flag off the region carries no --thread-room and no observer of its own (the old build, as it was)', () => {
    flag.on = false;
    const el = makeRegion({ scrollHeight: 3000, clientHeight: 900 });
    addTurn(el, { top: 22, end: 2900 });
    const hook = renderHook(() => useThreadAutoscroll('thread-1'));
    act(() => hook.result.current.registerScrollRegion(el));
    expect(el.getAttribute('style')).toBeNull();
    expect(fireRegionResize).toBeNull();
    act(() => {
      el.scrollTop = 100;
    });
    expect(hook.result.current.hiddenBelow).toBe(false);
  });

  it('with reduced motion the anchor lands in the same task, with no animation frame', () => {
    prefersReducedMotion(true);
    const { request } = fakeFrames();
    const { el, hook } = threadAtEnd();

    act(() => hook.result.current.anchorNextTurn());
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(900);
    act(() => fireResize?.());

    expect(el.scrollTop).toBe(2422);
    expect(request).not.toHaveBeenCalled();
  });

  it('with no matchMedia at all the anchor also lands at once', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { request } = fakeFrames();
    const { el, hook } = threadAtEnd();

    act(() => hook.result.current.anchorNextTurn());
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(900);
    act(() => fireResize?.());

    expect(el.scrollTop).toBe(2422);
    expect(request).not.toHaveBeenCalled();
  });

  it('isPinned() reads the pin: at the end yes, scrolled up no, back near the end yes, after an anchor no, after scrollToLatest yes', () => {
    prefersReducedMotion(true);
    const { el, hook } = threadAtEnd();
    expect(hook.result.current.isPinned()).toBe(true);

    act(() => {
      el.scrollTop = 900; // the creator goes back up
    });
    expect(hook.result.current.isPinned()).toBe(false);
    act(() => {
      el.scrollTop = BOTTOM(el) - (PIN_THRESHOLD_PX - 10);
    });
    expect(hook.result.current.isPinned()).toBe(true);

    act(() => hook.result.current.anchorNextTurn());
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(322); // a short answer: the anchored place (2422) is the scroll's end (3322 - 900)
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(2422);
    expect(BOTTOM(el) - el.scrollTop).toBe(0); // at the end, and still not pinned
    expect(hook.result.current.isPinned()).toBe(false);

    act(() => hook.result.current.scrollToLatest());
    expect(hook.result.current.isPinned()).toBe(true);
  });

  it('an eased anchor that ends at the scroll end is still not pinned: the answer then grows without moving the view', () => {
    // Each frame's write fires a scroll event in this stub inside the write itself, as the strictest
    // browser could. None of them may read as the creator's, or the last one (at the end) re-pins.
    const { flushFrames } = fakeFrames();
    const { el, hook } = threadAtEnd();
    act(() => hook.result.current.anchorNextTurn());
    addTurn(el, { top: 2430, end: 2600, send: 1 });
    el.grow(322);
    act(() => fireResize?.());
    flushFrames();
    expect(el.scrollTop).toBe(2422);
    expect(hook.result.current.isPinned()).toBe(false);

    el.grow(900);
    act(() => fireResize?.());
    expect(el.scrollTop).toBe(2422);
  });

  describe('a scroll of the creator re-pins a view that a sent turn holds only at the end of a long answer', () => {
    // The room makes an anchored view sit within PIN_THRESHOLD_PX of the end whenever the answer is
    // shorter than the window. By distance alone any stray scroll event (a touch that moves the
    // thread a pixel, a late event) pinned it again, and the next growth threw the view to the end:
    // seen once in three runs on a phone, 4 s after a new chat's first send.
    beforeEach(() => prefersReducedMotion(true));

    /** A thread at its end, then a sent turn (with the room) taken to the top: anchored at 2422. */
    function anchoredShort() {
      const { el, hook } = threadAtEnd();
      act(() => hook.result.current.anchorNextTurn());
      const turn = addTurn(el, { top: 2430, end: 2600, send: 1, room: true });
      el.grow(338); // the room: the anchored place is 16 from the end (3338 - 900 - 2422)
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(2422);
      expect(BOTTOM(el) - el.scrollTop).toBe(16);
      return { el, hook, turn };
    }

    it('(a) stray scroll events of a short anchored answer (the position unchanged, or moved by 1 px) do not re-pin it: the answer then grows past the window under a still view', () => {
      const { el, hook } = anchoredShort();
      // A touch moves the thread 2 px and back (read as the creator's: the hook's record is gone),
      // then a late event at the unchanged position.
      act(() => {
        el.scrollTop = 2424;
      });
      act(() => {
        el.scrollTop = 2422;
      });
      act(() => el.dispatchEvent(new Event('scroll')));
      expect(hook.result.current.isPinned()).toBe(false);
      el.grow(1500);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(2422);

      // One more stray event, moved by 1 px: still not pinned, the view stays where it is.
      act(() => {
        el.scrollTop = 2423;
      });
      expect(hook.result.current.isPinned()).toBe(false);
      el.grow(800);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(2423);
    });

    it('(b) an answer taller than the window, scrolled by the creator to its end: pinned, and its growth is followed', () => {
      const { el, hook } = anchoredShort();
      el.grow(2400); // the answer streams far past the window
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(2422);

      act(() => {
        el.scrollTop = BOTTOM(el); // the creator reads down to its end
      });
      expect(hook.result.current.isPinned()).toBe(true);
      el.grow(500);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(BOTTOM(el));
    });

    it('(b2) within 24 px below the anchor is still the anchored place, even near the end: not pinned', () => {
      const { el, hook } = anchoredShort();
      act(() => {
        el.scrollTop = 2422 + 16; // the very end of a short answer: 16 below the anchor
      });
      expect(hook.result.current.isPinned()).toBe(false);
    });

    it('(c) the same once the live turn folded into its persisted copy (a new element with the room): read from that element', () => {
      const { el, hook, turn } = anchoredShort();
      turn.remove();
      const copy = addTurn(el, { top: 2430, end: 2600, room: true }); // persisted: no send number
      void copy;
      // Short still: a stray event at the end does not re-pin.
      act(() => {
        el.scrollTop = 2420;
      });
      act(() => {
        el.scrollTop = 2422;
      });
      expect(hook.result.current.isPinned()).toBe(false);

      // Taller than the window, read to its end: pinned.
      el.grow(2400);
      act(() => fireResize?.());
      act(() => {
        el.scrollTop = BOTTOM(el);
      });
      expect(hook.result.current.isPinned()).toBe(true);
      el.grow(500);
      act(() => fireResize?.());
      expect(el.scrollTop).toBe(BOTTOM(el));
    });

    it('(d) no turn holds the room (a chat only opened): today\'s rule, within 120 of the end re-pins', () => {
      const el = makeRegion({ scrollHeight: 4000, clientHeight: 900 });
      addTurn(el, { top: 22, end: 3900 });
      const hook = renderHook(() => useThreadAutoscroll('thread-1'));
      act(() => hook.result.current.registerScrollRegion(el));
      act(() => {
        el.scrollTop = 500;
      });
      expect(hook.result.current.isPinned()).toBe(false);
      act(() => {
        el.scrollTop = BOTTOM(el) - (PIN_THRESHOLD_PX - 10);
      });
      expect(hook.result.current.isPinned()).toBe(true);
    });
  });

  it('exports the contract\'s numbers', () => {
    expect([ANCHOR_TOP_PX, SETTLE_MAX_PX, HIDDEN_MIN_PX]).toEqual([8, 150, 150]);
  });
});
