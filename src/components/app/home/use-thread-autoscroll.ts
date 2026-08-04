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
 */

import { useCallback, useEffect, useRef } from 'react';

/**
 * How close to the bottom still counts as "reading the newest turn".
 * Generous enough that a trackpad's momentum overscroll or a card's late image load does not read
 * as "the creator deliberately scrolled up", tight enough that going back one card releases the pin.
 */
export const PIN_THRESHOLD_PX = 120;

export interface ThreadAutoscroll {
  /** Callback ref for the scrollable thread region. Compose with any other ref on that element. */
  registerScrollRegion: (el: HTMLElement | null) => void;
  /** Force the newest turn into view and re-pin, regardless of where the creator had scrolled. */
  scrollThreadToBottom: () => void;
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

  /** Pin, then move. Records the clamped landing position so the deferred scroll event is ours. */
  const applyBottom = useCallback((el: HTMLElement) => {
    el.scrollTop = el.scrollHeight;
    lastWrittenTopRef.current = el.scrollTop; // read back: the browser clamps to the scrollable range
  }, []);

  const scrollThreadToBottom = useCallback(() => {
    const el = regionRef.current;
    if (!el) return;
    pinnedRef.current = true;
    applyBottom(el);
  }, [applyBottom]);

  const registerScrollRegion = useCallback((el: HTMLElement | null) => {
    // Tear down any prior wiring — this ref is re-registered when the region remounts.
    observerRef.current?.disconnect();
    observerRef.current = null;
    const prev = regionRef.current;
    if (prev && scrollHandlerRef.current) {
      prev.removeEventListener('scroll', scrollHandlerRef.current);
    }
    scrollHandlerRef.current = null;
    regionRef.current = el;
    if (!el) return;

    // ONLY the creator's own scrolling owns the pin. An event that lands exactly where we last
    // wrote is our own and is ignored — see lastWrittenTopRef.
    const onScroll = () => {
      const written = lastWrittenTopRef.current;
      if (written !== null && Math.abs(el.scrollTop - written) <= 1) return;
      lastWrittenTopRef.current = null;
      pinnedRef.current = el.scrollHeight - el.clientHeight - el.scrollTop <= PIN_THRESHOLD_PX;
    };
    scrollHandlerRef.current = onScroll;
    el.addEventListener('scroll', onScroll, { passive: true });

    // jsdom has no ResizeObserver; the listener above still wires up so the pin logic stays testable.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) applyBottom(el);
    });
    // Observe the CONTENT wrapper, not the region: the region is `flex-1` and its own box never
    // changes height, so observing it would report nothing while the thread grows inside it.
    const content = el.firstElementChild;
    if (content) ro.observe(content);
    observerRef.current = ro;
  }, [applyBottom]);

  useEffect(() => {
    scrollThreadToBottom();
  }, [threadKey, scrollThreadToBottom]);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      const prev = regionRef.current;
      if (prev && scrollHandlerRef.current) {
        prev.removeEventListener('scroll', scrollHandlerRef.current);
      }
    },
    [],
  );

  return { registerScrollRegion, scrollThreadToBottom };
}
