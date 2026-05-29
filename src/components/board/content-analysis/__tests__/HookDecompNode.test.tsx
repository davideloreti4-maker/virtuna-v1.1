/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HookDecompNode } from '../HookDecompNode';
import { fixtures } from '../../verdict/__tests__/fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { event: vi.fn() } }));

import { logger } from '@/lib/logger';

describe('HookDecompNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders headline "Hook decomposition"', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={fixtures.complete.counterfactuals?.suggestions}
      />,
    );
    expect(screen.getByTestId('hook-decomp-title')).toHaveTextContent('Hook decomposition');
  });

  it('renders 4 bars in HOOK_BAR_ORDER', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={[]}
      />,
    );
    expect(screen.getByTestId('hook-decomp-bar-visual_stop_power')).toBeInTheDocument();
    expect(screen.getByTestId('hook-decomp-bar-audio_hook_quality')).toBeInTheDocument();
    expect(screen.getByTestId('hook-decomp-bar-text_overlay_score')).toBeInTheDocument();
    expect(screen.getByTestId('hook-decomp-bar-first_words_speech_score')).toBeInTheDocument();
  });

  it('renders one-decimal scores from hook_decomposition', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={[]}
      />,
    );
    // fixtures.complete.hook_decomposition.visual_stop_power = 8.2
    expect(screen.getByTestId('hook-decomp-score-visual_stop_power')).toHaveTextContent('8.2');
  });

  it('weakest_modality bar has data-weakest=true', () => {
    // fixtures.complete.hook_decomposition.weakest_modality === 'text_overlay_score'
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={[]}
      />,
    );
    const weakest = screen.getByTestId('hook-decomp-bar-text_overlay_score');
    expect(weakest.getAttribute('data-weakest')).toBe('true');
    const notWeakest = screen.getByTestId('hook-decomp-bar-visual_stop_power');
    expect(notWeakest.getAttribute('data-weakest')).toBe('false');
  });

  it('weakest_modality bar has bg-accent/8 class', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={[]}
      />,
    );
    const weakest = screen.getByTestId('hook-decomp-bar-text_overlay_score');
    expect(weakest.className).toContain('bg-accent/8');
  });

  it('shows "Coherence: 7.4/10" chip (one decimal)', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={[]}
      />,
    );
    // fixtures.complete.hook_decomposition.visual_audio_coherence = 7.4
    expect(screen.getByTestId('hook-decomp-coherence-chip')).toHaveTextContent('Coherence: 7.4/10');
  });

  it.each([
    [2, 'Low'],
    [4, 'Med'],
    [8, 'High'],
  ] as const)('shows "Cognitive load: %s" for raw value %d (inverted polarity)', (raw, label) => {
    const decomp = { ...fixtures.complete.hook_decomposition!, cognitive_load: raw };
    render(<HookDecompNode decomp={decomp} segments={null} counterfactuals={[]} />);
    expect(screen.getByTestId('hook-decomp-cognitive-chip')).toHaveTextContent(`Cognitive load: ${label}`);
  });

  it('SECURITY: NEVER displays raw cognitive_load number in chip', () => {
    const decomp = { ...fixtures.complete.hook_decomposition!, cognitive_load: 7 };
    render(<HookDecompNode decomp={decomp} segments={null} counterfactuals={[]} />);
    const chip = screen.getByTestId('hook-decomp-cognitive-chip');
    expect(chip.textContent).not.toMatch(/Cognitive load: 7/);
    expect(chip.textContent).toContain('High'); // bucket only
  });

  it('renders empty state when hook_decomposition is null', () => {
    render(<HookDecompNode decomp={null} segments={null} counterfactuals={[]} />);
    expect(screen.getByTestId('hook-decomp-empty')).toBeInTheDocument();
    expect(screen.getByTestId('hook-decomp-empty-caption')).toHaveTextContent(
      "Hook decomposition isn't available for this analysis",
    );
    // No chip row in empty state
    expect(screen.queryByTestId('hook-decomp-chips')).toBeNull();
  });

  it('reduced-motion: GlassProgress fill bar uses motion-safe: transition class', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={[]}
      />,
    );
    // Each bar contains a GlassProgress; check the inner fill div class
    const bars = screen.getAllByTestId(/hook-decomp-bar-/);
    // GlassProgress renders: outer div + inner fill div with motion-safe:transition-all
    bars.forEach((bar) => {
      const fillEl = bar.querySelector('.motion-safe\\:transition-all');
      expect(fillEl).not.toBeNull();
    });
  });

  it('shows an always-on weakest-modality insight line with the top fix', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={fixtures.complete.counterfactuals?.suggestions}
      />,
    );
    const insight = screen.getByTestId('hook-decomp-insight');
    // fixtures weakest_modality = 'text_overlay_score' → label "Text overlay";
    // first hook-anchored fix headline = "Tighten text overlay".
    expect(insight).toHaveTextContent('Weakest:');
    expect(insight).toHaveTextContent('Text overlay');
    expect(insight).toHaveTextContent('Tighten text overlay');
  });

  it('clicking a bar expands the inline detail + fires hook_decomp_expanded telemetry', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={[]}
      />,
    );
    // Detail is collapsed by default (no Sheet/popup).
    expect(screen.queryByTestId('hook-decomp-detail')).toBeNull();
    fireEvent.click(screen.getByTestId('hook-decomp-bar-visual_stop_power'));
    expect(screen.getByTestId('hook-decomp-detail')).toBeInTheDocument();
    expect((logger as unknown as { event: ReturnType<typeof vi.fn> }).event).toHaveBeenCalledWith(
      'hook_decomp_expanded',
      expect.objectContaining({ weakest_modality: 'text_overlay_score' }),
    );
  });

  it('clicking the bar again collapses the inline detail', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={[]}
      />,
    );
    const bar = screen.getByTestId('hook-decomp-bar-visual_stop_power');
    fireEvent.click(bar);
    expect(screen.getByTestId('hook-decomp-detail')).toBeInTheDocument();
    fireEvent.click(bar);
    expect(screen.queryByTestId('hook-decomp-detail')).toBeNull();
  });

  it('inline detail lists hook-anchored fixes under "How to fix"', () => {
    render(
      <HookDecompNode
        decomp={fixtures.complete.hook_decomposition!}
        segments={null}
        counterfactuals={fixtures.complete.counterfactuals?.suggestions}
      />,
    );
    fireEvent.click(screen.getByTestId('hook-decomp-coherence-chip'));
    const detail = screen.getByTestId('hook-decomp-detail');
    expect(detail).toHaveTextContent('How to fix');
  });
});
