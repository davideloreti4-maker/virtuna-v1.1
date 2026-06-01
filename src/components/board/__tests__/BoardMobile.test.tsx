/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// Stub the content nodes — BoardMobile's own job is composition (order, labels,
// accent, overflow), not the data layer those nodes own and already test.
vi.mock('../EngineGroup', () => ({ EngineGroup: () => <div data-testid="body-engine" /> }));
vi.mock('../audience/AudienceNode', () => ({ AudienceNode: () => <div data-testid="body-audience" /> }));
vi.mock('../verdict/VerdictNode', () => ({ VerdictNode: () => <div data-testid="body-verdict" /> }));
vi.mock('../actions/ActionsNode', () => ({ ActionsNode: () => <div data-testid="body-actions" /> }));
vi.mock('../content-analysis/ContentAnalysisFrame', () => ({
  ContentAnalysisFrame: () => <div data-testid="body-content-analysis" />,
}));
vi.mock('../InputResultCard', () => ({ InputResultCard: () => <div data-testid="body-input" /> }));

import { BoardMobile } from '../BoardMobile';

const INPUT = { behavioral: null, confidence: null, confidenceLabel: null, gated: false, isStreaming: false };

describe('BoardMobile', () => {
  it('renders all six frames as cards in the mobile reading order', () => {
    render(<BoardMobile boardMachineState="complete" input={INPUT} hasAnalysis />);

    const labels = screen
      .getAllByRole('region')
      .map((el) => el.getAttribute('aria-label'))
      .filter((l) => l !== 'Analysis (card view)'); // drop the scroll container itself

    expect(labels).toEqual([
      'Input',
      'Score',
      'Audience',
      'Actions',
      'Content craft',
      'Engine',
    ]);
  });

  it('reuses the canvas content nodes inside each card', () => {
    render(<BoardMobile boardMachineState="complete" input={INPUT} hasAnalysis />);
    for (const id of ['input', 'verdict', 'audience', 'actions', 'content-analysis', 'engine']) {
      expect(screen.getByTestId(`body-${id}`)).toBeTruthy();
    }
  });

  it('shows the desktop-only hint instead of empty cards when there is no analysis', () => {
    render(<BoardMobile boardMachineState="idle" input={INPUT} hasAnalysis={false} />);
    expect(screen.getByText(/desktop-only/i)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Score' })).toBeNull();
  });

  it('applies the anti-virality accent to the affected frames only (verdict/audience/actions)', () => {
    render(<BoardMobile boardMachineState="anti-virality" input={INPUT} hasAnalysis />);
    const accented = (label: string) =>
      screen.getByRole('region', { name: label }).className.includes('border-accent/30');

    // AFFECTED_FRAMES['anti-virality'] = verdict + audience + actions (cross-group-state.ts)
    // (verdict frame's label is "Score")
    expect(accented('Score')).toBe(true);
    expect(accented('Audience')).toBe(true);
    expect(accented('Actions')).toBe(true);
    expect(accented('Input')).toBe(false);
    expect(accented('Engine')).toBe(false);
  });

  it('renders the Content craft card as a responsive frame (no forced horizontal scroll)', () => {
    render(<BoardMobile boardMachineState="complete" input={INPUT} hasAnalysis />);
    const card = screen.getByRole('region', { name: 'Content craft' });
    const body = within(card).getByTestId('body-content-analysis').parentElement!;
    // The redesigned filmstrip instrument fits the card width — the old wide
    // 2-column overflow-x-auto workaround is gone.
    expect(body.className).not.toContain('overflow-x-auto');
  });
});
