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

  // WR-03: a malformed prop (out-of-range / NaN) must clamp consistently across the
  // centered number, the band derivation, AND the aria-label — never "Score 105 of
  // 100" / a negative number / "NaN" while the arc silently clamps.
  it('clamps an over-range score (105) to 100 in BOTH the number and the aria-label', () => {
    render(<ScoreGauge score={105} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.queryByText('105')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Score 100 of 100, Strong');
  });

  it('clamps a negative score (-3) to 0 in BOTH the number and the aria-label', () => {
    render(<ScoreGauge score={-3} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('-3')).not.toBeInTheDocument();
    // 0 < 40 → "Weak" (WR-02 vocabulary).
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Score 0 of 100, Weak');
  });

  it('coerces a non-finite score (NaN) to 0 — never renders "NaN"', () => {
    const { container } = render(<ScoreGauge score={NaN} />);
    expect(container.textContent ?? '').not.toMatch(/NaN/);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Score 0 of 100, Weak');
  });

  it('passes axe (role=img + aria-label)', async () => {
    const { container } = render(<ScoreGauge score={71} />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
