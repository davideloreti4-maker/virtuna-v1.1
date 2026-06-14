/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

// usePrefersReducedMotion is mocked per-test to assert both motion branches.
// vitest 4 `vi.fn` takes a single function-type argument (not <Args, Return>).
const reducedMotionMock = vi.fn<() => boolean>();
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => reducedMotionMock(),
}));

import { ScoreGauge } from '../score-gauge';

/** The fill circle is the SECOND <circle> (track first, fill second). */
function fillCircle(container: HTMLElement): SVGCircleElement {
  const circles = container.querySelectorAll('circle');
  expect(circles.length).toBeGreaterThanOrEqual(2);
  return circles[1] as unknown as SVGCircleElement;
}

describe('ScoreGauge — zone fill from bandTone (READ-02)', () => {
  beforeEach(() => {
    reducedMotionMock.mockReturnValue(true); // default: motion off (stable assertions)
  });

  it('score=85 → green fill + aria-label "Score 85 of 100, Strong"', () => {
    const { container } = render(<ScoreGauge score={85} />);
    expect(fillCircle(container).getAttribute('stroke')).toBe('var(--color-success)');
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Score 85 of 100, Strong');
  });

  it('score=55 → amber fill (40-69 band, NOT red) + band word "Mid"', () => {
    const { container } = render(<ScoreGauge score={55} />);
    // CORRECTION #2: amber owns the WHOLE 40–69 band — must NOT be red.
    expect(fillCircle(container).getAttribute('stroke')).toBe('var(--color-warning)');
    expect(fillCircle(container).getAttribute('stroke')).not.toBe('var(--color-error)');
    expect(screen.getByText('Mid')).toBeInTheDocument();
  });

  it('score=30 → red fill + band word "Weak" (WR-02: aligned with Deeper read vocabulary)', () => {
    const { container } = render(<ScoreGauge score={30} />);
    expect(fillCircle(container).getAttribute('stroke')).toBe('var(--color-error)');
    // WR-02: the gauge's <40 word is "Weak" (matches Deeper read), NOT "Low".
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.queryByText('Low')).not.toBeInTheDocument();
  });

  it('renders the score number with tabular-nums', () => {
    for (const s of [85, 55, 30]) {
      const { unmount } = render(<ScoreGauge score={s} />);
      const num = screen.getByText(String(s));
      expect(num).toBeInTheDocument();
      expect(num.className).toMatch(/tabular-nums/);
      unmount();
    }
  });

  it('reduced-motion ON → fill circle has NO transition style', () => {
    reducedMotionMock.mockReturnValue(true);
    const { container } = render(<ScoreGauge score={71} />);
    const style = fillCircle(container).getAttribute('style') ?? '';
    expect(style).not.toMatch(/transition/);
  });

  it('reduced-motion OFF → fill circle has a stroke-dasharray transition', () => {
    reducedMotionMock.mockReturnValue(false);
    const { container } = render(<ScoreGauge score={71} />);
    const style = fillCircle(container).getAttribute('style') ?? '';
    expect(style).toMatch(/transition/);
    expect(style).toMatch(/stroke-dasharray/);
  });

  it('passes axe (role=img + aria-label)', async () => {
    const { container } = render(<ScoreGauge score={71} />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
