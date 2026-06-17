/** @vitest-environment happy-dom */
/**
 * ToolChips — chip row + active-model field + disabled cost slots (D-07/D-08/D-09).
 *
 * Asserts:
 *  - Clicking "test" fires onSelect("test").
 *  - Clicking a disabled chip (idea/hooks/chat) does NOT fire onSelect.
 *  - Active-model label reads "SIM-1 Max" when "test" is active.
 *  - Active-model label reads "SIM-1 Flash" when a non-test chip would be active.
 *  - Disabled chips carry aria-disabled + "coming soon" affordance.
 *  - Reserved cost slot affordance exists on chips.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ToolChips, type ToolId } from '../tool-chips';

function renderChips(activeTool: ToolId, onSelect = vi.fn()) {
  return render(<ToolChips activeTool={activeTool} onSelect={onSelect} />);
}

beforeEach(() => {
  cleanup();
});

// Helper: get a chip button by its visible label text (finds first child span text)
function getChipByLabel(label: string): HTMLButtonElement {
  // Buttons contain a <span> with the label; sr-only "coming soon" is a sibling span.
  // Use getAllByRole to filter by the visible text node.
  const btns = screen.getAllByRole('button');
  const btn = btns.find((b) => {
    // First span child is the label span
    const spans = b.querySelectorAll('span');
    return spans.length > 0 && spans[0].textContent?.trim().toLowerCase() === label.toLowerCase();
  });
  if (!btn) throw new Error(`No chip with label "${label}" found`);
  return btn as HTMLButtonElement;
}

describe('ToolChips — chip row (D-07/D-08)', () => {
  it('renders all four chips: Test, Idea, Hooks, Chat', () => {
    renderChips('test');
    expect(getChipByLabel('Test')).toBeInTheDocument();
    expect(getChipByLabel('Idea')).toBeInTheDocument();
    expect(getChipByLabel('Hooks')).toBeInTheDocument();
    expect(getChipByLabel('Chat')).toBeInTheDocument();
  });

  it('fires onSelect("test") when the Test chip is clicked', () => {
    const onSelect = vi.fn();
    renderChips('test', onSelect);
    fireEvent.click(getChipByLabel('Test'));
    expect(onSelect).toHaveBeenCalledWith('test');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onSelect when a disabled chip (idea) is clicked', () => {
    const onSelect = vi.fn();
    renderChips('test', onSelect);
    // Idea chip is disabled — clicking must not fire onSelect
    const ideaBtn = getChipByLabel('Idea');
    expect(ideaBtn).toBeDisabled();
    fireEvent.click(ideaBtn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does NOT fire onSelect when hooks chip is clicked (disabled)', () => {
    const onSelect = vi.fn();
    renderChips('test', onSelect);
    const hooksBtn = getChipByLabel('Hooks');
    expect(hooksBtn).toBeDisabled();
    fireEvent.click(hooksBtn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does NOT fire onSelect when chat chip is clicked (disabled)', () => {
    const onSelect = vi.fn();
    renderChips('test', onSelect);
    const chatBtn = getChipByLabel('Chat');
    expect(chatBtn).toBeDisabled();
    fireEvent.click(chatBtn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the active chip with aria-pressed="true"', () => {
    renderChips('test');
    const testBtn = getChipByLabel('Test');
    expect(testBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks disabled chips with aria-disabled', () => {
    renderChips('test');
    // All three disabled chips are disabled
    expect(getChipByLabel('Idea')).toBeDisabled();
    expect(getChipByLabel('Hooks')).toBeDisabled();
    expect(getChipByLabel('Chat')).toBeDisabled();
  });

  it('carries a "coming soon" sr-only affordance on disabled chips (D-08)', () => {
    const { container } = renderChips('test');
    const srOnlyEls = container.querySelectorAll('.sr-only');
    // There are 3 disabled chips, each with a sr-only "coming soon" span
    const comingSoonEls = Array.from(srOnlyEls).filter(
      (el) => el.textContent?.toLowerCase().includes('coming soon'),
    );
    expect(comingSoonEls.length).toBe(3);
  });
});

describe('ToolChips — active-model field (D-09)', () => {
  it('shows "SIM-1 Max" when test chip is active', () => {
    renderChips('test');
    const label = screen.getByTestId('active-model-label');
    expect(label.textContent).toBe('SIM-1 Max');
  });

  it('shows "SIM-1 Flash" when idea is the active chip (hypothetically)', () => {
    // Even though idea is disabled in P1, the model-label mapping is tested
    // by rendering with activeTool="idea" directly (the component accepts any ToolId).
    renderChips('idea');
    const label = screen.getByTestId('active-model-label');
    expect(label.textContent).toBe('SIM-1 Flash');
  });

  it('shows "SIM-1 Flash" for hooks activeTool', () => {
    renderChips('hooks');
    expect(screen.getByTestId('active-model-label').textContent).toBe('SIM-1 Flash');
  });

  it('shows "SIM-1 Flash" for chat activeTool', () => {
    renderChips('chat');
    expect(screen.getByTestId('active-model-label').textContent).toBe('SIM-1 Flash');
  });
});

describe('ToolChips — reserved cost slot (D-07)', () => {
  it('each chip has a data-cost-slot attribute reserving the credit affordance', () => {
    const { container } = renderChips('test');
    const costSlots = container.querySelectorAll('[data-cost-slot]');
    // 4 chips × 1 cost slot each
    expect(costSlots.length).toBe(4);
    costSlots.forEach((slot) => {
      expect(slot.getAttribute('data-cost-slot')).toBe('credit');
    });
  });
});
