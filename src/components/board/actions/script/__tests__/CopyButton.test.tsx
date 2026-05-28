/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from '../CopyButton';

// Polyfill clipboard — happy-dom makes navigator.clipboard read-only, so we
// must use defineProperty instead of Object.assign.
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe('CopyButton', () => {
  it('renders default state with Copy icon and aria-label', () => {
    render(<CopyButton text="hello" ariaLabel="Copy hello text" />);
    const btn = screen.getByRole('button', { name: 'Copy hello text' });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('title')).toBe('Copy hello text');
  });

  it('calls onCopy callback after clipboard write succeeds', async () => {
    const onCopy = vi.fn();
    render(<CopyButton text="payload" ariaLabel="Copy" onCopy={onCopy} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('payload');
  });

  it('renders optional label alongside icon', () => {
    render(<CopyButton text="x" ariaLabel="Copy all" label="Copy all" />);
    expect(screen.getByText('Copy all')).toBeTruthy();
  });
});
