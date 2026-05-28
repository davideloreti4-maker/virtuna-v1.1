/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PredictionResult } from '@/lib/engine/types';
import { AntiViralityHeader } from '../AntiViralityHeader';
import { fixtures } from './fixtures/prediction-result';

// happy-dom localStorage.clear is not available in all versions — stub with Map-backed impl.
const localStorageStore = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return localStorageStore.size; },
  key: (i) => Array.from(localStorageStore.keys())[i] ?? null,
  getItem: (k) => localStorageStore.get(k) ?? null,
  setItem: (k, v) => { localStorageStore.set(k, v); },
  removeItem: (k) => { localStorageStore.delete(k); },
  clear: () => { localStorageStore.clear(); },
};
vi.stubGlobal('localStorage', localStorageMock);
// Also stub window.localStorage for component code that accesses it via window
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

describe('AntiViralityHeader — conditional render', () => {
  beforeEach(() => {
    localStorageStore.clear();
  });

  it('returns null when result.anti_virality_gated is false', () => {
    const { container } = render(
      <AntiViralityHeader result={fixtures.complete} analysisId="test-a" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when result is null (streaming)', () => {
    const { container } = render(<AntiViralityHeader result={null} analysisId="test-b" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 40px band when anti_virality_gated is true (with fix suggestions)', () => {
    const withFix: PredictionResult = {
      ...fixtures.antiVirality,
      counterfactuals: {
        ...fixtures.antiVirality.counterfactuals!,
        suggestions: [
          { type: 'fix', headline: 'a', detail: 'b', timestamp_ms: 0, signal_anchor: 'hook' },
        ],
      },
    };
    render(<AntiViralityHeader result={withFix} analysisId="test-c" />);
    const header = screen.getByTestId('av-header');
    expect(header).toBeInTheDocument();
    // Single-line layout: h-10 class present
    expect(header.className).toContain('h-10');
  });

  it('two-line layout: uses min-h + flex-col when fixCount=0', () => {
    const zeroFix: PredictionResult = {
      ...fixtures.antiVirality,
      counterfactuals: undefined as unknown as PredictionResult['counterfactuals'],
    };
    render(<AntiViralityHeader result={zeroFix} analysisId="test-c-2line" />);
    const header = screen.getByTestId('av-header');
    expect(header).toBeInTheDocument();
    // Two-line layout: flex-col + min-h classes
    expect(header.className).toContain('flex-col');
    expect(header.className).toContain('min-h-');
  });

  it('shows "fixable in 1 step" (singular) when 1 fix suggestion exists', () => {
    const oneFix: PredictionResult = {
      ...fixtures.antiVirality,
      counterfactuals: {
        ...fixtures.antiVirality.counterfactuals!,
        suggestions: [
          { type: 'fix', headline: 'a', detail: 'b', timestamp_ms: 0, signal_anchor: 'hook' },
        ],
      },
    };
    render(<AntiViralityHeader result={oneFix} analysisId="test-d" />);
    expect(screen.getByTestId('av-header-text')).toHaveTextContent('fixable in 1 step');
  });

  it('shows generic low-confidence copy when there are zero fix suggestions', () => {
    const zeroFix: PredictionResult = {
      ...fixtures.antiVirality,
      counterfactuals: undefined as unknown as PredictionResult['counterfactuals'],
    };
    render(<AntiViralityHeader result={zeroFix} analysisId="test-d-0" />);
    expect(screen.getByTestId('av-header-text')).toHaveTextContent(
      'Low confidence — review before posting',
    );
  });

  it('caps fix count at 3 when 5+ fix suggestions exist', () => {
    const manyFixes = {
      ...fixtures.antiVirality,
      counterfactuals: {
        ...fixtures.antiVirality.counterfactuals!,
        suggestions: Array.from({ length: 5 }, (_, i) => ({
          type: 'fix' as const,
          headline: `fix-${i}`,
          detail: 'd',
          timestamp_ms: i * 1000,
          signal_anchor: 'hook',
        })),
      },
    };
    render(<AntiViralityHeader result={manyFixes} analysisId="test-e" />);
    expect(screen.getByTestId('av-header-text')).toHaveTextContent('fixable in 3 steps');
  });

  it('has role="status" + aria-live="polite"', () => {
    render(<AntiViralityHeader result={fixtures.antiVirality} analysisId="test-f" />);
    const header = screen.getByTestId('av-header');
    expect(header.getAttribute('role')).toBe('status');
    expect(header.getAttribute('aria-live')).toBe('polite');
  });

  it('uses linear-gradient(90deg, var(--color-accent), var(--color-warning)) background', () => {
    render(<AntiViralityHeader result={fixtures.antiVirality} analysisId="test-g" />);
    const header = screen.getByTestId('av-header');
    const bg = (header as HTMLElement).style.background || (header as HTMLElement).style.cssText;
    expect(bg).toContain('--color-accent');
    expect(bg).toContain('--color-warning');
  });
});
