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

  it('draws every slot the run will fill as soon as the total is known', async () => {
    render(<ReadingSkeleton id="sim-1" />);
    const es = MockEventSource.instances[0]!;
    act(() => es.emit('filmstrip_plan', { total: 4 }));

    await waitFor(() =>
      expect(screen.getByTestId('reading-skeleton-frames-strip')).toBeInTheDocument(),
    );
    // 4 slots, 0 filled — the wait shows how much footage is coming before any of it arrives.
    expect(screen.queryAllByTestId('reading-skeleton-frame')).toHaveLength(0);
    expect(screen.getByTestId('reading-skeleton-caption')).toHaveTextContent(
      /Reading the footage — 0 of 4 frames/i,
    );
  });

  it('SHOWS each keyframe as it lands — the picture, not a tally', async () => {
    render(<ReadingSkeleton id="sim-1" />);
    const es = MockEventSource.instances[0]!;
    act(() => es.emit('filmstrip_plan', { total: 3 }));
    act(() =>
      es.emit('filmstrip_segment_ready', {
        segment_idx: 0,
        keyframe_uri: 'https://signed.example/0.jpg',
      }),
    );
    act(() =>
      es.emit('filmstrip_segment_ready', {
        segment_idx: 1,
        keyframe_uri: 'https://signed.example/1.jpg',
      }),
    );

    // The REAL frames of the user's video are on screen. This is the whole point: the
    // keyframe_uri has always been on the wire, and the skeleton used to drop it and render
    // the string "2 frames read" instead.
    await waitFor(() =>
      expect(screen.queryAllByTestId('reading-skeleton-frame')).toHaveLength(2),
    );
    const imgs = screen.getAllByRole('presentation', { hidden: true }) as HTMLImageElement[];
    const srcs = imgs.filter((el) => el.tagName === 'IMG').map((el) => el.src);
    expect(srcs).toContain('https://signed.example/0.jpg');
    expect(srcs).toContain('https://signed.example/1.jpg');
    expect(screen.getByTestId('reading-skeleton-caption')).toHaveTextContent(
      /Reading the footage — 2 of 3 frames/i,
    );
  });

  it('never renders a picture for a segment that carries no keyframe (no broken slot)', async () => {
    render(<ReadingSkeleton id="sim-1" />);
    const es = MockEventSource.instances[0]!;
    act(() => es.emit('filmstrip_plan', { total: 2 }));
    // A segment the extractor could not read: it counts as read, but there is nothing to show
    // for it. It must leave an EMPTY slot, never an <img> with an undefined src.
    act(() => es.emit('filmstrip_segment_ready', { segment_idx: 0, keyframe_uri: null }));
    act(() => es.emit('filmstrip_segment_ready', { segment_idx: 1 }));

    await waitFor(() =>
      expect(screen.getByTestId('reading-skeleton-frames-strip')).toBeInTheDocument(),
    );
    expect(screen.queryAllByTestId('reading-skeleton-frame')).toHaveLength(0);
    expect(screen.getByTestId('reading-skeleton-caption')).toHaveTextContent(
      /Reading the footage — 0 of 2 frames/i,
    );
  });

  it('shows no strip at all before any footage signal (nothing fabricated)', () => {
    render(<ReadingSkeleton id="sim-1" />);
    expect(screen.queryByTestId('reading-skeleton-frames-strip')).not.toBeInTheDocument();
  });

  it('shows the scraped post as soon as it lands — cover, author, views', async () => {
    render(<ReadingSkeleton id="sim-1" />);
    const es = MockEventSource.instances[0]!;
    act(() =>
      es.emit('source', {
        cover_url: 'https://cdn.example/cover.jpg',
        handle: 'zachking',
        views: 12_400_000,
        video_url: 'https://www.tiktok.com/@zachking/video/1',
      }),
    );

    const card = await screen.findByTestId('reading-skeleton-source');
    expect(card).toHaveTextContent('@zachking');
    expect(card).toHaveTextContent('12.4M views');
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/cover.jpg');
  });

  it('renders NO source receipt when nothing was scraped (video_upload)', () => {
    render(<ReadingSkeleton id="sim-1" />);
    // No `source` event ever arrives in upload mode — the absence must stay an absence.
    expect(screen.queryByTestId('reading-skeleton-source')).not.toBeInTheDocument();
  });

  it('ignores an empty source receipt rather than rendering a blank card', async () => {
    render(<ReadingSkeleton id="sim-1" />);
    const es = MockEventSource.instances[0]!;
    act(() =>
      es.emit('source', { cover_url: null, handle: null, views: null, video_url: null }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('reading-skeleton-caption')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('reading-skeleton-source')).not.toBeInTheDocument();
  });
});
