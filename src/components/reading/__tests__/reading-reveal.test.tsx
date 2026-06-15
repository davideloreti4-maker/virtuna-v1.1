/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, renderHook, waitFor } from '@testing-library/react';

// ── Mock EventSource so the reveal hook can be driven deterministically ──────
type Listener = (e: { data: string }) => void;
class MockEventSource {
  static instances: MockEventSource[] = [];
  static CLOSED = 2;
  readyState = 0;
  url: string;
  listeners: Record<string, Listener[]> = {};
  closed = false;
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  close() {
    this.closed = true;
    this.readyState = MockEventSource.CLOSED;
  }
  emit(type: string, data: unknown) {
    for (const fn of this.listeners[type] ?? []) fn({ data: JSON.stringify(data) });
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as unknown as { EventSource: unknown }).EventSource = MockEventSource;
});
afterEach(() => {
  vi.restoreAllMocks();
});

import { useReadingReveal } from '../use-reading-reveal';
import { ReadingSkeleton } from '../reading-skeleton';

describe('useReadingReveal — real-signal liveness (REVEAL-01)', () => {
  it('does not open a connection when disabled', () => {
    renderHook(() => useReadingReveal('sim-1', false));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('does not open a connection without an id', () => {
    renderHook(() => useReadingReveal(null, true));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('counts personas streaming in (max-monotonic) and keyframes (deduped by idx)', async () => {
    const { result } = renderHook(() => useReadingReveal('sim-1', true));
    const es = MockEventSource.instances[0]!;
    expect(es.url).toBe('/api/analyze/sim-1/stream');

    act(() => es.emit('partial', { personas: [{ id: 'a' }, { id: 'b' }] }));
    await waitFor(() => expect(result.current.personaCount).toBe(2));
    expect(result.current.phase).toBe('live');

    // A later, smaller partial must not regress the count (max-monotonic).
    act(() => es.emit('partial', { personas: [{ id: 'a' }] }));
    expect(result.current.personaCount).toBe(2);

    // Filmstrip dedupes by segment idx.
    act(() => es.emit('filmstrip_segment_ready', { segment_idx: 0 }));
    act(() => es.emit('filmstrip_segment_ready', { segment_idx: 0 }));
    act(() => es.emit('filmstrip_segment_ready', { segment_idx: 3 }));
    await waitFor(() => expect(result.current.keyframeCount).toBe(2));
  });

  it('closes the connection on complete', async () => {
    const { result } = renderHook(() => useReadingReveal('sim-1', true));
    const es = MockEventSource.instances[0]!;
    act(() => es.emit('complete', {}));
    await waitFor(() => expect(result.current.phase).toBe('complete'));
    expect(es.closed).toBe(true);
  });

  it('closes the connection on unmount', () => {
    const { unmount } = renderHook(() => useReadingReveal('sim-1', true));
    const es = MockEventSource.instances[0]!;
    unmount();
    expect(es.closed).toBe(true);
  });
});

describe('ReadingSkeleton — branded in-flight IA (REVEAL-02)', () => {
  it('renders the calm default caption + IA placeholders before any signal', () => {
    render(<ReadingSkeleton id="sim-1" />);
    expect(screen.getByTestId('reading-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('reading-skeleton-caption')).toHaveTextContent(
      /Reading your simulation/i,
    );
    // No fabricated frame count before footage lands.
    expect(screen.queryByTestId('reading-skeleton-frames')).not.toBeInTheDocument();
  });

  it('reflects real persona progress in the caption as personas stream in', async () => {
    render(<ReadingSkeleton id="sim-1" />);
    const es = MockEventSource.instances[0]!;
    act(() => es.emit('partial', { personas: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }));
    await waitFor(() =>
      expect(screen.getByTestId('reading-skeleton-caption')).toHaveTextContent(
        /3 viewers so far/i,
      ),
    );
  });

  it('shows the frame count only once footage starts landing (real signal)', async () => {
    render(<ReadingSkeleton id="sim-1" />);
    const es = MockEventSource.instances[0]!;
    act(() => es.emit('filmstrip_segment_ready', { segment_idx: 0 }));
    act(() => es.emit('filmstrip_segment_ready', { segment_idx: 1 }));
    await waitFor(() =>
      expect(screen.getByTestId('reading-skeleton-frames')).toHaveTextContent(/2 frames read/i),
    );
  });
});
