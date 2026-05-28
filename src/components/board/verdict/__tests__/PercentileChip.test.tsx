/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PercentileChip } from '../PercentileChip';

describe('PercentileChip', () => {
  it('renders the percentile number from overall_score', () => {
    render(<PercentileChip score={78} confidenceLabel="HIGH" isCalibrated={true} />);
    expect(screen.getByTestId('percentile-number')).toHaveTextContent('78');
  });

  it('applies text-accent class when score >= 70', () => {
    render(<PercentileChip score={75} confidenceLabel="HIGH" isCalibrated={true} />);
    expect(screen.getByTestId('percentile-number').className).toContain('text-accent');
  });

  it('applies text-white/95 class when score < 70', () => {
    render(<PercentileChip score={50} confidenceLabel="MEDIUM" isCalibrated={true} />);
    expect(screen.getByTestId('percentile-number').className).toContain('text-white/95');
  });

  it.each([
    [85, 'Strong'],
    [55, 'Mid'],
    [25, 'Low'],
  ])('shows band label %s for score %d', (score, label) => {
    render(<PercentileChip score={score} confidenceLabel="HIGH" isCalibrated={true} />);
    expect(screen.getByTestId('band-label')).toHaveTextContent(label);
  });

  it.each(['HIGH', 'MEDIUM', 'LOW'] as const)('renders Confidence: %s pill', (label) => {
    render(<PercentileChip score={70} confidenceLabel={label} isCalibrated={true} />);
    expect(screen.getByTestId('confidence-pill-trigger')).toHaveTextContent(
      `Confidence: ${label}`,
    );
  });

  it('renders (score uncalibrated) sub-text when is_calibrated is false', () => {
    render(<PercentileChip score={70} confidenceLabel="HIGH" isCalibrated={false} />);
    expect(screen.getByTestId('uncalibrated-note')).toHaveTextContent('(score uncalibrated)');
  });

  it('does NOT render uncalibrated note when is_calibrated is true', () => {
    render(<PercentileChip score={70} confidenceLabel="HIGH" isCalibrated={true} />);
    expect(screen.queryByTestId('uncalibrated-note')).toBeNull();
  });

  it('renders skeleton -- + Calculating… when score is null', () => {
    render(<PercentileChip score={null} confidenceLabel={null} isCalibrated={true} />);
    expect(screen.getByTestId('percentile-number')).toHaveTextContent('--');
    expect(screen.getByTestId('confidence-pill-trigger')).toHaveTextContent('Calculating…');
  });

  it.each([
    ['HIGH', 'bg-success'],
    ['MEDIUM', 'bg-warning'],
    ['LOW', 'bg-accent'],
  ] as const)('confidence dot has correct color class for %s', (label, colorClass) => {
    render(<PercentileChip score={70} confidenceLabel={label} isCalibrated={true} />);
    const dot = screen.getByTestId('confidence-dot');
    expect(dot.className).toContain(colorClass);
    expect(dot.getAttribute('data-confidence')).toBe(label);
  });

  it('does not render confidence dot in skeleton/streaming state', () => {
    render(<PercentileChip score={null} confidenceLabel={null} isCalibrated={true} />);
    expect(screen.queryByTestId('confidence-dot')).toBeNull();
  });

  it('confidence pill click opens popover with explanation', () => {
    render(<PercentileChip score={70} confidenceLabel="HIGH" isCalibrated={true} />);
    fireEvent.click(screen.getByTestId('confidence-pill-trigger'));
    const popover = screen.getByTestId('confidence-popover');
    expect(popover).toHaveTextContent('engine is about this prediction');
  });
});
