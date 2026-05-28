/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { WhyVerdictCollapsible } from '../WhyVerdictCollapsible';
import { fixtures } from './fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('@/stores/board-store', () => ({
  useBoardStore: (selector: (s: { setActivePreset: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ setActivePreset: vi.fn() }),
}));

import { logger } from '@/lib/logger';

describe('WhyVerdictCollapsible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the summary text "Why this verdict?"', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    expect(screen.getByText('Why this verdict?')).toBeInTheDocument();
  });

  it('defaults to closed (open attribute absent) for non-AV result', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    const details = screen.getByTestId('why-verdict-collapsible') as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it('defaults to open when result.anti_virality_gated is true', () => {
    render(<WhyVerdictCollapsible result={fixtures.antiVirality} />);
    const details = screen.getByTestId('why-verdict-collapsible') as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });

  it('renders intro markdown via react-markdown', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    // happy-dom: <details> body renders in DOM regardless of open state
    const intro = screen.getByTestId('why-verdict-intro');
    expect(intro).toBeInTheDocument();
    // fixtures.complete.reasoning includes "Strong hook" — verify rendered
    expect(intro.textContent).toContain('Strong hook');
  });

  it('SECURITY: rehype-sanitize strips <script> from reasoning', () => {
    const malicious = {
      ...fixtures.complete,
      reasoning: 'Normal text<script>window.__pwned=true</script>more text',
    };
    render(<WhyVerdictCollapsible result={malicious} />);
    // Script tag MUST be stripped — window.__pwned must NOT be set
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
    const intro = screen.getByTestId('why-verdict-intro');
    // Sanitizer drops script; text remains
    expect(intro.innerHTML).not.toMatch(/<script/i);
  });

  it('renders "Why this works" sub-section when factors with score >= 7 exist', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    expect(screen.getByTestId('sub-works')).toBeInTheDocument();
    expect(screen.getByText(/Why this works/i)).toBeInTheDocument();
  });

  it('renders "Why this might not" sub-section when factors with score < 4 exist', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    expect(screen.getByTestId('sub-might-not')).toBeInTheDocument();
  });

  it('hides "What the engine flagged" sub-section when warnings is empty', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    // fixtures.complete.warnings = []
    expect(screen.queryByTestId('sub-flagged')).toBeNull();
  });

  it('shows "What the engine flagged" sub-section when warnings exist', () => {
    render(<WhyVerdictCollapsible result={fixtures.antiVirality} />);
    expect(screen.getByTestId('sub-flagged')).toBeInTheDocument();
  });

  it('renders TopFixesList ONLY when anti_virality_gated is true', () => {
    const { rerender } = render(<WhyVerdictCollapsible result={fixtures.complete} />);
    expect(screen.queryByTestId('top-fixes-list')).toBeNull();

    rerender(<WhyVerdictCollapsible result={fixtures.antiVirality} />);
    expect(screen.getByTestId('top-fixes-list')).toBeInTheDocument();
  });

  it('W3: AV state — plain counterfactual list excludes items already in TopFixesList', () => {
    // Build a fixture with: 3 fixes (top-3) + 1 stretch suggestion = 4 counterfactuals total.
    const avFixture = {
      ...fixtures.antiVirality,
      anti_virality_gated: true,
      counterfactuals: {
        band: 'low' as const,
        suggestions: [
          { type: 'fix' as const, headline: 'Fix A', detail: 'a', timestamp_ms: 1000, signal_anchor: 'hook' },
          { type: 'fix' as const, headline: 'Fix B', detail: 'b', timestamp_ms: 2000, signal_anchor: 'hook' },
          { type: 'fix' as const, headline: 'Fix C', detail: 'c', timestamp_ms: 3000, signal_anchor: 'hook' },
          { type: 'stretch' as const, headline: 'Stretch X', detail: 'x', timestamp_ms: 4000, signal_anchor: 'cta' },
        ],
      },
    };
    render(<WhyVerdictCollapsible result={avFixture} />);
    // TopFixesList renders Fix A, B, C (3 items)
    const topFixesList = screen.getByTestId('top-fixes-list');
    expect(within(topFixesList).getAllByTestId('top-fix-item')).toHaveLength(3);
    // Plain list must NOT include Fix A/B/C; must include Stretch X
    const plainList = screen.queryByTestId('counterfactual-plain-list');
    expect(plainList).toBeInTheDocument();
    expect(plainList!.textContent).toContain('Stretch X');
    expect(plainList!.textContent).not.toContain('Fix A');
    expect(plainList!.textContent).not.toContain('Fix B');
    expect(plainList!.textContent).not.toContain('Fix C');
  });

  it('W3: AV state — plain list omitted entirely when ALL counterfactuals are in TopFixesList', () => {
    // 3 fixes only, no stretch → after filtering, plain list is empty.
    const avAllFixes = {
      ...fixtures.antiVirality,
      anti_virality_gated: true,
      counterfactuals: {
        band: 'low' as const,
        suggestions: [
          { type: 'fix' as const, headline: 'Fix A', detail: 'a', timestamp_ms: 1000, signal_anchor: 'hook' },
          { type: 'fix' as const, headline: 'Fix B', detail: 'b', timestamp_ms: 2000, signal_anchor: 'hook' },
          { type: 'fix' as const, headline: 'Fix C', detail: 'c', timestamp_ms: 3000, signal_anchor: 'hook' },
        ],
      },
    };
    render(<WhyVerdictCollapsible result={avAllFixes} />);
    expect(screen.getByTestId('top-fixes-list')).toBeInTheDocument();
    expect(screen.queryByTestId('counterfactual-plain-list')).toBeNull();
  });

  it('NON-AV state: plain list shows all counterfactuals unchanged (no filtering)', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    // fixtures.complete is non-AV: 1 fix + 1 stretch in assembleReasoningBuckets output
    // (reinforcement is filtered out at the bucket level)
    const plainList = screen.queryByTestId('counterfactual-plain-list');
    expect(plainList).toBeInTheDocument();
    expect(plainList!.textContent).toContain('Tighten text overlay'); // the 'fix'
    expect(plainList!.textContent).toContain('Add CTA card'); // the 'stretch'
  });

  it('typography: sub-section lists use space-y-1.5 spacing class', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    const subWorks = screen.getByTestId('sub-works');
    const ul = subWorks.querySelector('ul');
    expect(ul?.className).toContain('space-y-1.5');
  });

  it('typography: intro uses leading-[1.45] line height', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    const intro = screen.getByTestId('why-verdict-intro');
    expect(intro.className).toContain('leading-[1.45]');
  });

  it('fires verdict_reasoning_expanded telemetry (logger.info) on toggle open', () => {
    render(<WhyVerdictCollapsible result={fixtures.complete} />);
    const details = screen.getByTestId('why-verdict-collapsible') as HTMLDetailsElement;
    // Manually open and dispatch toggle (happy-dom may need explicit dispatch)
    details.open = true;
    fireEvent(details, new Event('toggle', { bubbles: false }));
    expect(logger.info).toHaveBeenCalledWith(
      'verdict_reasoning_expanded',
      expect.objectContaining({ score: fixtures.complete.overall_score }),
    );
  });
});
