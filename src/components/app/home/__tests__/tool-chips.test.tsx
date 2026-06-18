/** @vitest-environment happy-dom */
/**
 * ToolChips — chip row + active-model field + disabled cost slots (D-07/D-08/D-09).
 *
 * Asserts:
 *  - Clicking "test" fires onSelect("test").
 *  - Clicking "idea" fires onSelect("idea") (live since P3).
 *  - Clicking "hooks" fires onSelect("hooks") (live since P4 — D-09).
 *  - Clicking "chat" fires onSelect("chat") (live since P5 — D-05).
 *  - Active-model label reads "SIM-1 Max" when "test" is active.
 *  - Active-model label reads "SIM-1 Flash" when a non-test chip would be active.
 *  - All four chips live; no "coming soon" affordance remains (P5 flipped Chat live).
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

  it('fires onSelect("idea") when the Idea chip is clicked (live since P3)', () => {
    const onSelect = vi.fn();
    renderChips('test', onSelect);
    // Idea chip went live in Phase 3 (03-04) — clicking must fire onSelect
    const ideaBtn = getChipByLabel('Idea');
    expect(ideaBtn).not.toBeDisabled();
    fireEvent.click(ideaBtn);
    expect(onSelect).toHaveBeenCalledWith('idea');
  });

  it('fires onSelect("hooks") when the Hooks chip is clicked (live since P4)', () => {
    const onSelect = vi.fn();
    renderChips('test', onSelect);
    const hooksBtn = getChipByLabel('Hooks');
    expect(hooksBtn).not.toBeDisabled();
    fireEvent.click(hooksBtn);
    expect(onSelect).toHaveBeenCalledWith('hooks');
  });

  it('fires onSelect("chat") when the Chat chip is clicked (live since P5 — D-05)', () => {
    const onSelect = vi.fn();
    renderChips('test', onSelect);
    const chatBtn = getChipByLabel('Chat');
    expect(chatBtn).not.toBeDisabled();
    fireEvent.click(chatBtn);
    expect(onSelect).toHaveBeenCalledWith('chat');
  });

  it('marks the active chip with aria-pressed="true"', () => {
    renderChips('test');
    const testBtn = getChipByLabel('Test');
    expect(testBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks all four chips live — none disabled (Chat flipped live in P5)', () => {
    renderChips('test');
    // Test + Idea live (P1/P3); Hooks live (P4); Chat live (P5 — D-05)
    expect(getChipByLabel('Test')).not.toBeDisabled();
    expect(getChipByLabel('Idea')).not.toBeDisabled();
    expect(getChipByLabel('Hooks')).not.toBeDisabled();
    expect(getChipByLabel('Chat')).not.toBeDisabled();
  });

  it('no longer carries a "coming soon" sr-only affordance (all chips live — P5)', () => {
    const { container } = renderChips('test');
    const srOnlyEls = container.querySelectorAll('.sr-only');
    // Chat went live in P5 — no chip remains "coming soon"
    const comingSoonEls = Array.from(srOnlyEls).filter(
      (el) => el.textContent?.toLowerCase().includes('coming soon'),
    );
    expect(comingSoonEls.length).toBe(0);
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
    // 6 chips × 1 cost slot each (Test/Idea/Hooks/Chat/Script/Remix — Script + Remix added in 06-05)
    expect(costSlots.length).toBe(6);
    costSlots.forEach((slot) => {
      expect(slot.getAttribute('data-cost-slot')).toBe('credit');
    });
  });
});
