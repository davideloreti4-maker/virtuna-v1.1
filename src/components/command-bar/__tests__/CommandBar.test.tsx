/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock useBoardStore — focus pulse + minimal store surface used by CommandBar.
let _focusPulse = 0;
vi.mock('@/stores/board-store', () => ({
  useBoardStore: (selector: (s: { inputBarFocusPulse: number }) => unknown) =>
    selector({ inputBarFocusPulse: _focusPulse }),
}));

// Mock ContentForm to keep the test focused on CommandBar behaviour.
vi.mock('@/components/app/content-form', () => ({
  ContentForm: ({ onSubmit }: { onSubmit?: (data: unknown) => void }) => (
    <form
      data-testid="content-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.({ input_mode: 'text', caption: 'hi' });
      }}
    >
      <textarea aria-label="caption" />
      <button type="submit">submit</button>
    </form>
  ),
}));

import { CommandBar } from '../CommandBar';

describe('CommandBar', () => {
  beforeEach(() => {
    _focusPulse = 0;
  });

  it('always renders the ContentForm — no minimal/chip mode', () => {
    render(<CommandBar />);
    expect(screen.getByTestId('content-form')).toBeInTheDocument();
  });

  it('proxies form submit to onContentSubmit', () => {
    const onContentSubmit = vi.fn();
    render(<CommandBar onContentSubmit={onContentSubmit} />);
    screen.getByRole('button', { name: 'submit' }).click();
    expect(onContentSubmit).toHaveBeenCalledWith({ input_mode: 'text', caption: 'hi' });
  });

  it('focuses the form textarea when inputBarFocusPulse increments', async () => {
    _focusPulse = 1;
    render(<CommandBar />);
    // requestAnimationFrame is the focus trigger — flush a microtask + RAF tick.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement?.tagName.toLowerCase()).toBe('textarea');
  });
});
