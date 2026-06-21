/** @vitest-environment happy-dom */
/**
 * useAmbientFocus — the focus-resolution hook that drives AmbientPresence's `focus` prop
 * (Plan 13-04, Surfaces 1/2/4 — AMBIENT-01, D-02/D-03/D-04).
 *
 * These tests lock the FOCUS-DECISION core directly (a pure function, no DOM — happy-dom
 * IntersectionObserver is flaky to assert), plus the hook's public surface:
 *  - DEFAULT-LATEST: with no deliberate action, the resolved focus is the LAST descriptor
 *    (the latest generation, D-02).
 *  - TAP PRIORITY (Pitfall 4): an explicit tap wins over scroll-spy momentarily — after
 *    focusByTap(A), a focusByScroll(B) does NOT move focus (still A) while the tap is sticky;
 *    a subsequent focusByTap(B) DOES move it.
 *  - SCROLL DEFAULT: with no active tap, focusByScroll(B) sets focus to B (the ambient default).
 *  - TYPE-TO-ROOM (D-04): focusByThought sets the subject to an ad-hoc typed thought.
 *  - IDLE: an empty descriptor set resolves to null (drives the presence idle state).
 *  - DETERMINISM: the decision core reads no Math.random / Date.now (engine-gate safe).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  useAmbientFocus,
  resolveAmbientFocus,
  type AmbientCardDescriptor,
} from '../use-ambient-focus';

afterEach(() => {
  cleanup();
});

const SRC_PATH = join(process.cwd(), 'src/components/app/home/use-ambient-focus.ts');

// Strip block + line comments so honesty-framing prose that NAMES a forbidden token
// (to explain the determinism rule) never trips the source guard.
function readCode(): string {
  const raw = readFileSync(SRC_PATH, 'utf8');
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const A: AmbientCardDescriptor = { id: 'a', conceptText: 'Hook A', fraction: '6/10 stop', scrollQuote: 'qa' };
const B: AmbientCardDescriptor = { id: 'b', conceptText: 'Hook B', fraction: '3/10 stop', scrollQuote: 'qb' };
const C: AmbientCardDescriptor = { id: 'c', conceptText: 'Hook C', fraction: '8/10 stop', scrollQuote: 'qc' };

describe('resolveAmbientFocus (pure decision core)', () => {
  it('DEFAULT-LATEST: descriptors [A,B,C] with no action → focus is C (the latest)', () => {
    const focus = resolveAmbientFocus({
      descriptors: [A, B, C],
      tapId: null,
      scrollId: null,
      thought: null,
    });
    expect(focus).not.toBeNull();
    expect(focus?.conceptText).toBe('Hook C');
    expect(focus?.fraction).toBe('8/10 stop');
    expect(focus?.scrollQuote).toBe('qc');
  });

  it('EMPTY: descriptors [] → focus is null (idle)', () => {
    const focus = resolveAmbientFocus({ descriptors: [], tapId: null, scrollId: null, thought: null });
    expect(focus).toBeNull();
  });

  it('TAP PRIORITY: a sticky tap on A wins over a scroll to B (focus stays A)', () => {
    const focus = resolveAmbientFocus({
      descriptors: [A, B, C],
      tapId: 'a',
      scrollId: 'b',
      thought: null,
    });
    expect(focus?.conceptText).toBe('Hook A');
  });

  it('SCROLL DEFAULT: with no active tap, a scroll to B sets focus to B', () => {
    const focus = resolveAmbientFocus({
      descriptors: [A, B, C],
      tapId: null,
      scrollId: 'b',
      thought: null,
    });
    expect(focus?.conceptText).toBe('Hook B');
  });

  it('TYPE-TO-ROOM: a typed thought sets the subject to that ad-hoc thought', () => {
    const focus = resolveAmbientFocus({
      descriptors: [A, B, C],
      tapId: null,
      scrollId: null,
      thought: { conceptText: 'ad-hoc', fraction: '5/10 stop', scrollQuote: 'q-thought' },
    });
    expect(focus?.conceptText).toBe('ad-hoc');
  });

  it('a stale tap/scroll id no longer in the descriptor set is ignored (re-defaults to latest)', () => {
    const focus = resolveAmbientFocus({
      descriptors: [B, C],
      tapId: 'a', // A was removed
      scrollId: null,
      thought: null,
    });
    expect(focus?.conceptText).toBe('Hook C');
  });
});

describe('useAmbientFocus (hook surface)', () => {
  it('defaults focus to the latest descriptor on a stable set', () => {
    const { result } = renderHook(() => useAmbientFocus([A, B, C]));
    expect(result.current.focus?.conceptText).toBe('Hook C');
  });

  it('idles (focus null) on an empty descriptor set', () => {
    const { result } = renderHook(() => useAmbientFocus([]));
    expect(result.current.focus).toBeNull();
  });

  it('focusByTap(A) then focusByScroll(B) → focus stays A (tap sticky, Pitfall 4)', () => {
    const { result } = renderHook(() => useAmbientFocus([A, B, C]));
    act(() => result.current.focusByTap('a'));
    expect(result.current.focus?.conceptText).toBe('Hook A');
    act(() => result.current.focusByScroll('b'));
    expect(result.current.focus?.conceptText).toBe('Hook A');
  });

  it('focusByTap(A) then focusByTap(B) → focus moves to B', () => {
    const { result } = renderHook(() => useAmbientFocus([A, B, C]));
    act(() => result.current.focusByTap('a'));
    act(() => result.current.focusByTap('b'));
    expect(result.current.focus?.conceptText).toBe('Hook B');
  });

  it('focusByScroll(B) with no active tap → focus is B', () => {
    const { result } = renderHook(() => useAmbientFocus([A, B, C]));
    act(() => result.current.focusByScroll('b'));
    expect(result.current.focus?.conceptText).toBe('Hook B');
  });

  it('focusByThought sets the subject to the typed thought', () => {
    const { result } = renderHook(() => useAmbientFocus([A, B, C]));
    act(() =>
      result.current.focusByThought({ conceptText: 'ad-hoc', fraction: '5/10 stop', scrollQuote: 'qt' }),
    );
    expect(result.current.focus?.conceptText).toBe('ad-hoc');
  });

  it('exposes a stable register callback for scroll-spy wiring', () => {
    const { result } = renderHook(() => useAmbientFocus([A, B, C]));
    expect(typeof result.current.registerThreadRegion).toBe('function');
    expect(typeof result.current.focusByTap).toBe('function');
    expect(typeof result.current.focusByScroll).toBe('function');
    expect(typeof result.current.focusByThought).toBe('function');
  });
});

describe('determinism guard (source)', () => {
  it('the decision core reads no Math.random / Date.now', () => {
    const code = readCode();
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/Date\.now/);
  });
});
