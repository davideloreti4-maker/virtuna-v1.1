/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeightOverrideDrawer, type WeightOverrideDrawerProps } from '../WeightOverrideDrawer';
import { WEIGHT_PRESETS } from '../audience-constants';
import { DEFAULT_PERSONA_WEIGHT_CONFIG } from '@/lib/engine/persona-weights';
import type { PersonaWeights } from '@/lib/engine/persona-weights';

// Mock useIsMobile - default to desktop
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

const DEFAULT_WEIGHTS: PersonaWeights = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
const CUSTOM_WEIGHTS: PersonaWeights = { fyp: 0.50, niche: 0.30, loyalist: 0.10, cross_niche: 0.10 };

function renderDrawer(overrides: Partial<WeightOverrideDrawerProps> = {}) {
  const onOpenChange = vi.fn();
  const onWeightsChange = vi.fn();
  const onApply = vi.fn().mockResolvedValue(undefined);

  const props: WeightOverrideDrawerProps = {
    open: true,
    onOpenChange,
    analysisId: 'test-analysis-id',
    currentWeights: DEFAULT_WEIGHTS,
    onWeightsChange,
    onApply,
    ...overrides,
  };

  const utils = render(<WeightOverrideDrawer {...props} />);
  return { ...utils, onOpenChange, onWeightsChange, onApply };
}

describe('WeightOverrideDrawer', () => {
  it('renders 4 preset chips + Custom', () => {
    renderDrawer();
    expect(screen.getByText('Default mix')).toBeInTheDocument();
    expect(screen.getByText('Established creator')).toBeInTheDocument();
    expect(screen.getByText('Niche-heavy')).toBeInTheDocument();
    expect(screen.getByText('New creator')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('clicking Default preset chip calls onWeightsChange with default mix', () => {
    const { onWeightsChange } = renderDrawer({ currentWeights: CUSTOM_WEIGHTS });
    fireEvent.click(screen.getByText('Default mix'));
    expect(onWeightsChange).toHaveBeenCalledWith(WEIGHT_PRESETS.default);
  });

  it('clicking Niche-heavy sets 30/55/10/5', () => {
    const { onWeightsChange } = renderDrawer({ currentWeights: CUSTOM_WEIGHTS });
    fireEvent.click(screen.getByText('Niche-heavy'));
    expect(onWeightsChange).toHaveBeenCalledWith(WEIGHT_PRESETS.niche_heavy);
  });

  it('slider drag triggers rebalance and sum stays 1.0', () => {
    const { onWeightsChange } = renderDrawer();
    // Get all range inputs
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(4);

    // Simulate FYP slider drag to 50%
    fireEvent.change(sliders[0]!, { target: { value: '50' } });
    expect(onWeightsChange).toHaveBeenCalled();
    const newWeights = onWeightsChange.mock.calls[0]![0] as PersonaWeights;
    const sum = newWeights.fyp + newWeights.niche + newWeights.loyalist + newWeights.cross_niche;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.005);
  });

  it('Active preset highlight: Default chip has aria-pressed=true when weights match default', () => {
    renderDrawer({ currentWeights: WEIGHT_PRESETS.default });
    const defaultChip = screen.getByText('Default mix').closest('button');
    expect(defaultChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('Custom chip is active when weights do not match any preset', () => {
    renderDrawer({ currentWeights: CUSTOM_WEIGHTS });
    const customChip = screen.getByText('Custom').closest('button');
    expect(customChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('Apply button is disabled when weights equal initial (isDirty=false)', () => {
    renderDrawer({ currentWeights: DEFAULT_WEIGHTS });
    const applyBtn = screen.getByRole('button', { name: /apply audience mix/i });
    expect(applyBtn).toBeDisabled();
  });

  it('Apply button calls onApply with weights and saveAsDefault=true when checkbox checked', async () => {
    const { onApply } = renderDrawer({ currentWeights: CUSTOM_WEIGHTS });

    // Check "Save as my default" checkbox
    const checkbox = screen.getByRole('checkbox', { name: /save as my default/i });
    fireEvent.click(checkbox);

    // Click Apply
    const applyBtn = screen.getByRole('button', { name: /apply audience mix/i });
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(CUSTOM_WEIGHTS, true);
  });

  it('Reset link restores DEFAULT_PERSONA_WEIGHT_CONFIG', () => {
    const { onWeightsChange } = renderDrawer({ currentWeights: CUSTOM_WEIGHTS });
    const resetBtn = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetBtn);
    expect(onWeightsChange).toHaveBeenCalledWith(DEFAULT_PERSONA_WEIGHT_CONFIG.default);
  });

  it('useIsMobile=true: Sheet side=bottom class applied', async () => {
    const { useIsMobile } = await import('@/hooks/useIsMobile');
    vi.mocked(useIsMobile).mockReturnValue(true);

    renderDrawer();
    // Radix renders into portal — query from document
    const sheetContent = document.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).not.toBeNull();
    expect(sheetContent?.className ?? '').toContain('bottom');

    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it('useIsMobile=false: Sheet side=right class applied', () => {
    renderDrawer();
    // Radix renders into portal — query from document
    const sheetContent = document.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).not.toBeNull();
    expect(sheetContent?.className ?? '').toContain('right');
  });

  it('sum display has aria-live=polite and shows 100', () => {
    renderDrawer();
    screen.getByText(/100/);
    // The sum element itself or a parent should have aria-live=polite
    const allLiveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(allLiveRegions.length).toBeGreaterThan(0);
  });
});
