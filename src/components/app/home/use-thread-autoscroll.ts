'use client';

/**
 * useThreadAutoscroll — keeps the newest turn in view in the home thread.
 *
 * WHY THIS EXISTS: the home thread region had NO scroll management at all. Measured signed-in in a
 * real browser at `470ef6ae`: a creator typed a question into a restored thread, the agent answered
 * in ~4s, and `scrollTop` never moved off 0 — the answer rendered at y=1596 in a 900px viewport and
 * the follow-up chips at y=1765. The screen was pixel-identical before and after the send. Their own
 * message never appeared either. Everything the thread streams — the answer, the cards, the chips
 * that ARE the "what next" mechanism — landed below the fold with nothing to say it was there.
 *
 * Every other chat surface in the app already pins to the bottom (`reading-chat.tsx` via
 * `scrollIntoView`, `ExpertChatThread.tsx` and `PersonaChatDrawer.tsx` via `scrollTop`). The
 * product's PRIMARY surface was the one that did not.
 *
 * THE CONTRACT — three behaviours, one rule:
 *  1. open/switch a thread  → land on the newest turn, not the top of a 1700px scroll
 *  2. send                  → the new turn is visible as it streams
 *  3. creator scrolls up    → LEAVE THEM THERE; a stream must never yank the view off the card
 *                             they went back to read. Coming back within PIN_THRESHOLD_PX re-pins.
 *
 * Growth is followed with a ResizeObserver on the content wrapper rather than a React dep list:
 * the thread's height changes token by token from a dozen independent streams (chat, hooks, ideas,
 * script, remix, explore) plus async card hydration, and there is no single piece of state that
 * changes on every one of those. The element's own height is the honest signal.
 *
 * Scrolling is INSTANT, never smooth: `behavior: 'smooth'` restarts its animation on every token
 * and the thread visibly judders for the length of a stream. Instant is also what the repo's other
 * two scroll-region chats already do, so the surfaces agree.
 *
 * NEW LOOK (thread feel, spec 2026-11-25 §4.1), called only by new-look code, so the flag-off
 * build runs exactly the two functions above. A send no longer follows the growing end: the turn it
 * sends goes to the top of the window (`anchorNextTurn`) and stays there while its answer grows
 * under it. When the answer is in and its end is just under the field, `settle` brings it up;
 * when more is hidden, `hiddenBelow` shows "Go to the latest" (`scrollToLatest`). These are single
 * moves to one place, not a chase of every token, so they ease (380 ms, by animation frames) without
 * the judder above; following the end stays instant. With reduced motion every move is at once.
 * Turns are the stream's `[data-turn]` elements (persisted-thread-stream.tsx).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { NEW_LOOK_ENABLED } from '@/lib/flags/new-look';

/**
 * How close to the bottom still counts as "reading the newest turn".
 * Generous enough that a trackpad's momentum overscroll or a card's late image load does not read
 * as "the creator deliberately scrolled up", tight enough that going back one card releases the pin.
 */
export const PIN_THRESHOLD_PX = 120;

/** New look: where a sent turn's top comes to rest, under the top of the region's visible part. */
export const ANCHOR_TOP_PX = 8;
/** New look: an answer whose end lands this far under the field, or less, is brought up (`settle`). */
export const SETTLE_MAX_PX = 150;
/** New look: more than this of the last answer under the field shows "Go to the latest". */
export const HIDDEN_MIN_PX = 150;
/**
 * New look: how long a send waits for its turn to appear before the anchor is dropped. Long enough
 * for a run whose turn lands only with its result (a remix developed into hooks: a model call, then
 * the thread's reload).
 */
const ANCHOR_WAIT_MS = 10_000;
/** New look: the length of one eased move (the anchor, the settle, "Go to the latest"). */
const MOVE_MS = 380;
/** New look: the room a settled answer's end keeps above the field. */
const SETTLE_GAP_PX = 8;

export interface ThreadAutoscroll {
  /** Callback ref for the scrollable thread region. Compose with any other ref on that element. */
  registerScrollRegion: (el: HTMLElement | null) => void;
  /** Force the newest turn into view and re-pin, regardless of where the creator had scrolled. */
  scrollThreadToBottom: () => void;
  /**
   * New look: a send. Its number goes up by one (kept in a ref: it costs no render), and the turn
   * the stream marks with it (`[data-turn][data-send="<n>"]`, the live turn or the tail) goes to the
   * top of the window when it appears; the pin is released, so its answer grows under it without
   * moving the view. It has not appeared within 10,000 ms: dropped. Returns the send's number: the
   * caller stamps the slot its turn goes to (and only that one) with it, in the same render as the
   * run's start (the composer keeps one number per slot), so every send is a new turn whatever its
   * words, and nothing else (a previous run folding into history) can be taken for it.
   */
  anchorNextTurn: () => number;
  /**
   * New look: the send now waiting is about to give a new chat its id (composer
   * `ensureThreadForSend`, right before it sets it). Only a key change announced this way keeps
   * the arm and `anchored`; any other is a thread switch.
   */
  expectNewThread: () => void;
  /**
   * New look: the last send's turn went away without an answer (a video whose upload was refused
   * after its turn appeared). `anchored` goes back to what it was before that send, so no room is
   * left under the turn before it; a send still waiting is dropped. If the send had taken the view
   * to the top (and so let go of the pin), the next change of the content decides the pin again by
   * the rule a scroll of the creator follows (`pinsAt`).
   */
  releaseSend: () => void;
  /**
   * New look: a turn sent in this visit of this chat takes the room under it (the stream's
   * `anchored`). True from the `anchorNextTurn()` call on, so the room is there in the commit that
   * brings the turn. An arm dropped with nothing anchored (the window ran out: a send that bailed)
   * puts it back to what it was before that call; once a turn has anchored it stays true until the
   * open thread changes. Always false with the flag off (nothing there calls `anchorNextTurn`).
   */
  anchored: boolean;
  /**
   * New look: the answer is in. If its end is under the field by 150 or less, bring it up. Not a
   * view the creator moved last: theirs stays where they put it.
   */
  settle: () => void;
  /** New look: "Go to the latest". To the end, and follow it again. */
  scrollToLatest: () => void;
  /** New look: more than 150 of the last answer is under the field. Always false with the flag off. */
  hiddenBelow: boolean;
  /**
   * New look: does the view follow the end? The pin itself, nothing else. Not the same as "within
   * 120 of the end": a sent turn with a short answer is taken to the top and its room fills the
   * window, so that view is at the end and not pinned.
   */
  isPinned: () => boolean;
}

/**
 * The thread's last turn that draws something, whose end `hiddenBelow` and `settle` measure. A
 * turn that renders nothing is an empty element (hidden by its own class), with no end to measure.
 */
function lastTurnOf(region: HTMLElement): HTMLElement | null {
  const turns = region.querySelectorAll<HTMLElement>('[data-turn]');
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]!;
    if (turn.firstElementChild) return turn;
  }
  return null;
}

const pxOf = (value: string) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Where a node starts in the region's scroll range: the `scrollTop` that would put its top on the
 * region's top edge. From the boxes, not `offsetTop`: the region is not positioned, so a turn's
 * offsetParent is the shell above it, and its offsetTop would not be counted from the region.
 */
function topInRegion(region: HTMLElement, node: Element): number {
  return node.getBoundingClientRect().top - region.getBoundingClientRect().top - region.clientTop + region.scrollTop;
}

/**
 * How far the end of the last turn's CONTENT sits under the visible end (positive: hidden under the
 * field). The content's end is its last child's bottom: the turn's own box can be taller (the room
 * a sent turn takes). The visible end is the region's bottom less its padding, which is the field's
 * reserve. Null when there is no turn.
 */
function hiddenUnderField(region: HTMLElement): number | null {
  const end = lastTurnOf(region)?.lastElementChild;
  if (!end) return null;
  const box = region.getBoundingClientRect();
  const visibleEnd =
    box.top + region.clientTop + region.clientHeight - pxOf(getComputedStyle(region).paddingBottom);
  return end.getBoundingClientRect().bottom - visibleEnd;
}

/**
 * New look: how far below a room turn's anchored place the creator must have scrolled, as well as
 * reaching the end, for the view to follow the end again.
 */
const ROOM_REPIN_PX = 24;

/**
 * Does the creator's view, where it now is, follow the end? Today's rule: within PIN_THRESHOLD_PX
 * of the end. New look, while a turn holds the room (`[data-turn][data-room]`, the sent turn or its
 * persisted copy once it has folded): that view sits within PIN_THRESHOLD_PX of the end whenever
 * its answer is shorter than the window, by construction, so any stray scroll event (a touch that
 * moves the thread a pixel, a late event) re-pinned it, and the next growth threw the reader to
 * the end (seen on a phone, 4 s after a new chat's first send). There it follows the end only once
 * the creator has really read down past that place: more than 24 below it, and at the end.
 */
function pinsAt(region: HTMLElement): boolean {
  const nearEnd = region.scrollHeight - region.clientHeight - region.scrollTop <= PIN_THRESHOLD_PX;
  if (!NEW_LOOK_ENABLED) return nearEnd;
  const room = region.querySelector<HTMLElement>('[data-turn][data-room]');
  if (!room) return nearEnd;
  const anchoredAt = topInRegion(region, room) - pxOf(getComputedStyle(region).paddingTop) - ANCHOR_TOP_PX;
  return nearEnd && region.scrollTop > anchoredAt + ROOM_REPIN_PX;
}

/** Reduced motion (or no way to ask, or no frames): every move lands at once. */
function movesAtOnce(): boolean {
  if (typeof window.matchMedia !== 'function' || typeof window.requestAnimationFrame !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * @param threadKey identity of the open thread. Changing it re-pins and jumps to the newest turn —
 *   a different thread is a fresh read, so a pin released in the previous one must not carry over
 *   and open the new thread halfway up.
 */
export function useThreadAutoscroll(threadKey: string | null): ThreadAutoscroll {
  const regionRef = useRef<HTMLElement | null>(null);
  /** Does the creator want to follow the stream? Starts true; a scroll away from the bottom clears it. */
  const pinnedRef = useRef(true);
  const observerRef = useRef<ResizeObserver | null>(null);
  const scrollHandlerRef = useRef<(() => void) | null>(null);
  /**
   * The last scroll position WE wrote, so the handler can tell our own scroll from the creator's.
   *
   * ⚠️ Without this the hook releases its own pin. A `scroll` event is delivered on a later frame,
   * and React flushes the optimistic user bubble in between — so the handler reads the position we
   * just wrote against a thread that has since grown taller and concludes the creator is 122px off
   * the bottom, i.e. that they scrolled away. Measured: tapping a chip re-pinned, jumped to the
   * bottom, and then silently stopped following two frames later.
   */
  const lastWrittenTopRef = useRef<number | null>(null);

  // ── New look only (see the header): none of these is ever set by the flag-off build. ──────────
  /**
   * A send's arm: the send's number (the turn it sends carries it as `data-send`), and `anchored`
   * as it was before the arm, for when nothing comes.
   */
  const armRef = useRef<{ seq: number; anchoredBefore: boolean } | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchored, setAnchored] = useState(false);
  const anchoredRef = useRef(false);
  /** The last send's number (0: none yet); `anchorNextTurn` returns the next. */
  const sendSeqRef = useRef(0);
  /** The waiting send announced the id of the chat it makes (`expectNewThread`). */
  const newThreadRef = useRef(false);
  /** The last send, kept past its anchor for `releaseSend`: what `anchored` was before it, and whether it took the view. */
  const lastSendRef = useRef<{ seq: number; anchoredBefore: boolean; anchored: boolean } | null>(null);
  /** After a release that undid an anchor: the next content change decides the pin (`pinsAt`). */
  const repinRef = useRef(false);
  /** The frame of the eased move on its way, if any. */
  const frameRef = useRef<number | null>(null);
  /** The turn the last anchor took to the top (the thread key's effect reads it, below). */
  const anchoredTurnRef = useRef<Element | null>(null);
  /** The observer on the region's own box, which keeps `--thread-room` true. */
  const roomObserverRef = useRef<ResizeObserver | null>(null);
  const [hiddenBelow, setHiddenBelow] = useState(false);
  const hiddenRef = useRef(false);
  /**
   * True only while an eased move writes `scrollTop`. A scroll event handled in that moment is the
   * write's own: the position is not recorded as ours until the write returns (it is read back,
   * clamped), so without this such an event would read as the creator's and could re-pin a view
   * the move left at the end (a sent turn whose room fills the window).
   */
  const writingRef = useRef(false);

  /** Pin, then move. Records the clamped landing position so the deferred scroll event is ours. */
  const applyBottom = useCallback((el: HTMLElement) => {
    el.scrollTop = el.scrollHeight;
    lastWrittenTopRef.current = el.scrollTop; // read back: the browser clamps to the scrollable range
  }, []);

  /** New look: "Go to the latest" is wanted when more than 150 of the last answer is under the field. */
  const updateHidden = useCallback((el: HTMLElement) => {
    if (!NEW_LOOK_ENABLED) return;
    const below = hiddenUnderField(el);
    const next = below !== null && below > HIDDEN_MIN_PX;
    if (next === hiddenRef.current) return;
    hiddenRef.current = next;
    setHiddenBelow(next);
  }, []);

  const stopMove = useCallback(() => {
    if (frameRef.current === null) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  /** New look: write `scrollTop` as the hook's own (see writingRef), and record where it landed. */
  const writeOwn = useCallback((el: HTMLElement, top: number) => {
    writingRef.current = true;
    try {
      el.scrollTop = top;
    } finally {
      writingRef.current = false;
    }
    lastWrittenTopRef.current = el.scrollTop;
  }, []);

  /**
   * New look: move to `target()`, 380 ms with a cubic ease-out, or at once with reduced motion.
   * The target is read on every frame, so a place that moves while the view travels (the end of a
   * streaming answer) is still where it lands. Every write is recorded as ours (lastWrittenTopRef),
   * so the scroll events the move itself causes never read as the creator's.
   */
  const moveTo = useCallback(
    (el: HTMLElement, target: () => number) => {
      stopMove();
      if (movesAtOnce()) {
        writeOwn(el, target());
        updateHidden(el);
        return;
      }
      const from = el.scrollTop;
      let start: number | null = null;
      const step = (now: number) => {
        start ??= now;
        const t = Math.min(1, (now - start) / MOVE_MS);
        writeOwn(el, from + (target() - from) * (1 - (1 - t) ** 3));
        frameRef.current = t < 1 ? requestAnimationFrame(step) : null;
        if (t === 1) updateHidden(el);
      };
      frameRef.current = requestAnimationFrame(step);
    },
    [stopMove, updateHidden, writeOwn],
  );

  const scrollThreadToBottom = useCallback(() => {
    const el = regionRef.current;
    if (!el) return;
    stopMove(); // an eased move on its way (new look only) must not carry the view off again
    pinnedRef.current = true;
    applyBottom(el);
  }, [applyBottom, stopMove]);

  /** New look: `anchored`, set only when it changes (one ref for the reads inside callbacks). */
  const setAnchoredTo = useCallback((next: boolean) => {
    if (anchoredRef.current === next) return;
    anchoredRef.current = next;
    setAnchored(next);
  }, []);

  /**
   * New look: the arm goes. `revert`: nothing anchored from it, so `anchored` goes back to what it
   * was before it (a send that bailed leaves no room behind).
   */
  const dropArm = useCallback(
    (revert: boolean) => {
      if (armTimerRef.current !== null) clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
      const arm = armRef.current;
      armRef.current = null;
      if (arm && revert) setAnchoredTo(arm.anchoredBefore);
    },
    [setAnchoredTo],
  );

  const anchorNextTurn = useCallback(() => {
    // A second send before the first one's turn came: what to go back to is still what was there
    // before the first.
    const anchoredBefore = armRef.current ? armRef.current.anchoredBefore : anchoredRef.current;
    if (armTimerRef.current !== null) clearTimeout(armTimerRef.current);
    const seq = sendSeqRef.current + 1;
    sendSeqRef.current = seq;
    armRef.current = { seq, anchoredBefore };
    lastSendRef.current = { seq, anchoredBefore, anchored: false };
    setAnchoredTo(true);
    armTimerRef.current = setTimeout(() => {
      // The send bailed: its turn never came, and neither will the id it may have announced.
      newThreadRef.current = false;
      dropArm(true);
    }, ANCHOR_WAIT_MS);
    return seq;
  }, [dropArm, setAnchoredTo]);

  const expectNewThread = useCallback(() => {
    newThreadRef.current = true;
  }, []);

  const releaseSend = useCallback(() => {
    const sent = lastSendRef.current;
    if (!sent) return;
    lastSendRef.current = null;
    if (sent.anchored) {
      // It took the view to the top and let go of the pin: once its turn is gone, where the view
      // lands decides the pin again (`repinRef`, read on the next content change).
      stopMove();
      anchoredTurnRef.current = null;
      repinRef.current = true;
    } else if (armRef.current?.seq === sent.seq) {
      dropArm(false); // still waiting: the pin was never let go
    }
    setAnchoredTo(sent.anchoredBefore);
  }, [dropArm, setAnchoredTo, stopMove]);

  const settle = useCallback(() => {
    const el = regionRef.current;
    if (!el) return;
    // The view is where the hook put it (the anchor), or the creator has moved it since: then it is
    // theirs, and a creator who scrolled is left there (the contract's third rule).
    if (lastWrittenTopRef.current === null) return;
    const below = hiddenUnderField(el);
    if (below === null || below <= 0 || below > SETTLE_MAX_PX) return;
    const to = el.scrollTop + below + SETTLE_GAP_PX;
    moveTo(el, () => to);
  }, [moveTo]);

  const scrollToLatest = useCallback(() => {
    const el = regionRef.current;
    if (!el) return;
    pinnedRef.current = true;
    moveTo(el, () => el.scrollHeight - el.clientHeight);
  }, [moveTo]);

  const registerScrollRegion = useCallback((el: HTMLElement | null) => {
    // Tear down any prior wiring — this ref is re-registered when the region remounts.
    observerRef.current?.disconnect();
    observerRef.current = null;
    roomObserverRef.current?.disconnect();
    roomObserverRef.current = null;
    stopMove();
    const prev = regionRef.current;
    if (prev && scrollHandlerRef.current) {
      prev.removeEventListener('scroll', scrollHandlerRef.current);
    }
    scrollHandlerRef.current = null;
    regionRef.current = el;
    if (!el) return;

    // ONLY the creator's own scrolling owns the pin. An event that lands exactly where we last
    // wrote is our own and is ignored — see lastWrittenTopRef. The creator's own scroll also stops
    // an eased move on its way (new look): the view is theirs. An event inside the move's own
    // write is the move's (writingRef; never set by the flag-off build).
    const onScroll = () => {
      if (writingRef.current) return;
      const written = lastWrittenTopRef.current;
      if (written === null || Math.abs(el.scrollTop - written) > 1) {
        lastWrittenTopRef.current = null;
        stopMove();
        pinnedRef.current = pinsAt(el); // today's rule, but see `pinsAt` for a room turn (new look)
      }
      updateHidden(el);
    };
    scrollHandlerRef.current = onScroll;
    el.addEventListener('scroll', onScroll, { passive: true });

    // New look: the window's height, for the room a sent turn takes (persisted-thread-stream.tsx).
    const writeRoom = () => el.style.setProperty('--thread-room', `${el.clientHeight}px`);
    if (NEW_LOOK_ENABLED) writeRoom();

    // jsdom has no ResizeObserver; the listener above still wires up so the pin logic stays testable.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (repinRef.current) {
        // New look: a released send's turn has gone; where the view now is decides the pin, by the
        // same rule as a scroll of the creator (an earlier sent turn may still hold the room).
        repinRef.current = false;
        pinnedRef.current = pinsAt(el);
      }
      const arm = armRef.current;
      if (arm) {
        // New look: a send is waiting for its turn, the element the stream marks with the send's
        // number (never a persisted turn, so a previous run folding into history meanwhile is not
        // it). When it is there and draws something, it goes to the top and the pin is released.
        // Until then the view holds: the end is not followed for that moment, because what grows
        // then is not the answer (the room moves to the old last turn a beat before the sent one
        // mounts) and following it would throw the view down and back.
        const turn = el.querySelector<HTMLElement>(`[data-turn][data-send="${arm.seq}"]`);
        if (turn?.firstElementChild) {
          dropArm(false); // used, not dropped: `anchored` stays true
          pinnedRef.current = false;
          anchoredTurnRef.current = turn;
          if (lastSendRef.current?.seq === arm.seq) lastSendRef.current.anchored = true;
          moveTo(el, () =>
            el.contains(turn)
              ? topInRegion(el, turn) - pxOf(getComputedStyle(el).paddingTop) - ANCHOR_TOP_PX
              : el.scrollTop,
          );
        }
      } else if (pinnedRef.current && frameRef.current === null) {
        // (A move on its way while pinned is "Go to the latest", which follows the end itself.)
        applyBottom(el);
      }
      updateHidden(el);
    });
    // Observe the CONTENT wrapper, not the region: the region is `flex-1` and its own box never
    // changes height, so observing it would report nothing while the thread grows inside it.
    const content = el.firstElementChild;
    if (content) ro.observe(content);
    observerRef.current = ro;

    // New look: the region's own box does change (a window resize, the phone's keyboard). The room
    // follows it. The top padding read above is the phone's header band, which covers the region's
    // top (composer.tsx): a turn taken to the top sits under the band, not under the header.
    // A taller window under a view the hook placed (an anchor, a settle) and left unpinned: the old
    // room makes the content too short for that place, so the browser has clamped the view up by
    // the difference before this runs (its scroll event comes a frame later). Once the room has the
    // new height the place fits again: it is written back, as the hook's own, so the late event is
    // not read as the creator's either. A smaller window needs nothing; a view the creator moved
    // last, or one that follows the end, is not touched; a move on its way writes its own frames.
    if (!NEW_LOOK_ENABLED) return;
    const room = new ResizeObserver(() => {
      writeRoom();
      const placed = lastWrittenTopRef.current;
      if (!pinnedRef.current && placed !== null && frameRef.current === null && Math.abs(el.scrollTop - placed) > 1) {
        writeOwn(el, placed);
      }
      updateHidden(el);
    });
    room.observe(el);
    roomObserverRef.current = room;
  }, [applyBottom, dropArm, moveTo, stopMove, updateHidden, writeOwn]);

  // A different thread is a fresh read: open it at its newest turn.
  // New look: and nothing of the last chat's sends carries over (its arm, its room).
  // Except the id a new chat gets from its own first send, which the composer announces
  // (`expectNewThread`, in `ensureThreadForSend`): that id lands while the send still waits for its
  // turn, or with or just after the turn it took to the top. That is the same chat: its arm and its
  // room stay, and once the turn is up the view is not taken to the end (that would undo the move).
  // Any change not announced (a chat opened from Home while a send that bailed still waits) is a
  // switch. The flag-off build never arms, anchors or announces, so for it this is the line it
  // always was.
  const prevThreadKeyRef = useRef(threadKey);
  useEffect(() => {
    const prev = prevThreadKeyRef.current;
    prevThreadKeyRef.current = threadKey;
    if (prev !== threadKey) {
      const announced = newThreadRef.current;
      newThreadRef.current = false;
      if (announced && threadKey !== null) {
        const turn = anchoredTurnRef.current;
        if (turn && regionRef.current?.contains(turn)) return;
      } else {
        dropArm(false);
        anchoredTurnRef.current = null;
        lastSendRef.current = null; // the last chat's send is nothing to release here
        repinRef.current = false;
        setAnchoredTo(false);
      }
    }
    scrollThreadToBottom();
  }, [threadKey, scrollThreadToBottom, dropArm, setAnchoredTo]);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      roomObserverRef.current?.disconnect();
      if (armTimerRef.current !== null) clearTimeout(armTimerRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      const prev = regionRef.current;
      if (prev && scrollHandlerRef.current) {
        prev.removeEventListener('scroll', scrollHandlerRef.current);
      }
    },
    [],
  );

  const isPinned = useCallback(() => pinnedRef.current, []);

  return {
    registerScrollRegion,
    scrollThreadToBottom,
    anchorNextTurn,
    settle,
    scrollToLatest,
    hiddenBelow,
    isPinned,
    anchored,
    expectNewThread,
    releaseSend,
  };
}
