'use client';
import { useEffect, useState } from 'react';
import type React from 'react';

/**
 * Arrow-key focus across a 1D ordered list of focusable elements.
 * UI-SPEC §Accessibility: "Arrow keys move between group frames when a frame is focused".
 * Tab order is left untouched — this only handles ArrowLeft/ArrowRight/ArrowUp/ArrowDown
 * when one of the registered elements has focus.
 */
export function useArrowKeyFocusGrid(refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const idx = refs.findIndex((r) => r.current === active);
      if (idx < 0) return;
      let next = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = idx + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = idx - 1;
      else return;
      next = Math.max(0, Math.min(refs.length - 1, next));
      if (next !== idx) {
        e.preventDefault();
        refs[next]?.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [refs]);
}

/**
 * Roving tabindex: exactly ONE element in the group has tabIndex=0 at any time;
 * the others are tabIndex=-1. Returns helpers for the wiring caller.
 *
 * Why: positive tabIndex values (1, 2, 3, …) are an a11y anti-pattern — they
 * override DOM order globally and produce surprising focus jumps when other
 * elements on the page are focusable. Roving tabindex keeps DOM order intact:
 * the entire frame group is one "tab stop" via the active element; once focus
 * is inside, arrow keys move within the group and update which element is the
 * tab stop.
 *
 * Returns: `{ activeIndex, setActive, getTabIndex(i) }`. Caller wires
 * `getTabIndex(i)` into each registered element's tabIndex prop.
 */
export function useRovingTabIndex<T extends HTMLElement>(refs: React.RefObject<T | null>[]) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const idx = refs.findIndex((r) => r.current === active);
      if (idx < 0) return;
      let next = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = idx + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = idx - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = refs.length - 1;
      else return;
      next = Math.max(0, Math.min(refs.length - 1, next));
      if (next !== idx) {
        e.preventDefault();
        refs[next]?.current?.focus();
        setActiveIndex(next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [refs]);

  return {
    activeIndex,
    setActive: setActiveIndex,
    /** Returns 0 for the active element, -1 for the rest. */
    getTabIndex: (i: number) => (i === activeIndex ? 0 : -1),
  };
}

/**
 * Imperative aria-live announcement helper. Creates / reuses a hidden live region
 * appended to <body>. Text must change between calls to trigger announcement.
 */
let liveNode: HTMLElement | null = null;
export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') return;
  if (!liveNode) {
    liveNode = document.createElement('div');
    liveNode.setAttribute('aria-live', politeness);
    liveNode.setAttribute('aria-atomic', 'true');
    liveNode.className = 'sr-only';
    document.body.appendChild(liveNode);
  }
  liveNode.setAttribute('aria-live', politeness);
  // Clear then set so identical strings still announce.
  liveNode.textContent = '';
  window.setTimeout(() => { if (liveNode) liveNode.textContent = message; }, 16);
}
