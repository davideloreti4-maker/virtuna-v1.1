/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EmotionArcNode } from '../EmotionArcNode';
import { fixtures } from '../../verdict/__tests__/fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { event: vi.fn() } }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }));

// Tier mock — `currentTier` lets each test mutate the value before render.
const tierState = { current: 'high' as 'high' | 'medium' | 'low' };
vi.mock('@/lib/perf-tier', () => ({
  usePerfStore: (selector: (s: { tier: 'high' | 'medium' | 'low' }) => unknown) =>
    selector({ tier: tierState.current }),
}));

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="emotion-arc-inspector-open">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { logger } from '@/lib/logger';

describe('EmotionArcNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tierState.current = 'high';
  });

  it('renders Emotion arc title', () => {
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    expect(screen.getByTestId('emotion-arc-title')).toHaveTextContent('Emotion arc');
  });

  it('renders Peak at {mm:ss} pill matching max-intensity timestamp', () => {
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    // fixtures.complete.emotion_arc max intensity is at timestamp_ms 8000 (0.85)
    expect(screen.getByTestId('emotion-arc-peak-pill')).toHaveTextContent('Peak at 0:08');
  });

  it('renders the chart container', () => {
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    expect(screen.getByTestId('emotion-arc-chart-container')).toBeInTheDocument();
  });

  it('aria-live region announces peak timestamp after 500ms', async () => {
    vi.useFakeTimers();
    try {
      render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByTestId('emotion-arc-aria-live')).toHaveTextContent(
        'Emotion arc peak at 0:08',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders empty caption when emotion_arc is null', () => {
    render(<EmotionArcNode points={null} />);
    expect(screen.getByTestId('emotion-arc-empty-caption')).toHaveTextContent(
      "Emotion arc isn't available for this analysis",
    );
  });

  it('renders empty caption when emotion_arc is empty array', () => {
    render(<EmotionArcNode points={[]} />);
    expect(screen.getByTestId('emotion-arc-empty-caption')).toBeInTheDocument();
  });

  it('does NOT render Peak at pill when empty', () => {
    render(<EmotionArcNode points={null} />);
    expect(screen.queryByTestId('emotion-arc-peak-pill')).toBeNull();
  });

  it('W4: renders one peak button per label=high point', () => {
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    // fixtures.complete.emotion_arc has 2 'high' label points (at 2000ms and 8000ms)
    const peakButtons = screen.getAllByTestId('emotion-arc-peak');
    expect(peakButtons).toHaveLength(2);
  });

  it('W4: renders one valley button per label=low point', () => {
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    // fixtures.complete.emotion_arc has 2 'low' label points (at 0ms and 12000ms)
    const valleyButtons = screen.getAllByTestId('emotion-arc-valley');
    expect(valleyButtons).toHaveLength(2);
  });

  it('W4: does NOT render a button for label=mid or unlabeled points', () => {
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    // total buttons = peaks + valleys only. Mid (5000ms) is excluded.
    const all = [
      ...screen.getAllByTestId('emotion-arc-peak'),
      ...screen.getAllByTestId('emotion-arc-valley'),
    ];
    expect(all).toHaveLength(4); // 2 high + 2 low
  });

  it('W4: tap on a peak button fires emotion_arc_peak_tapped telemetry with timestamp_ms', () => {
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    const peakButtons = screen.getAllByTestId('emotion-arc-peak');
    // First peak in fixtures.complete.emotion_arc is at timestamp_ms 2000
    fireEvent.click(peakButtons[0]!);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((logger as any).event).toHaveBeenCalledWith(
      'emotion_arc_peak_tapped',
      expect.objectContaining({ timestamp_ms: 2000 }),
    );
  });

  it('W4: tap on a peak button opens EmotionArcInspector', () => {
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    const peakButtons = screen.getAllByTestId('emotion-arc-peak');
    fireEvent.click(peakButtons[0]!);
    expect(screen.getByTestId('emotion-arc-inspector-open')).toBeInTheDocument();
  });

  it('W4: Low perf tier — peak buttons are disabled and click does NOT fire telemetry', () => {
    tierState.current = 'low';
    render(<EmotionArcNode points={fixtures.complete.emotion_arc!} />);
    const peakButtons = screen.getAllByTestId('emotion-arc-peak');
    expect((peakButtons[0]! as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(peakButtons[0]!);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((logger as any).event).not.toHaveBeenCalled();
  });
});
