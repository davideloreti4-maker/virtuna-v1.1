/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { makeReadingResult } from './fixtures/reading-fixture';
import { RewriteItem } from '../rewrite-item';

// The verbatim hook rewrite shape lives in the shared fixture (apollo_reasoning.rewrites).
function rewrite() {
  return makeReadingResult().apollo_reasoning!.rewrites[0]!;
}

// happy-dom makes navigator.clipboard read-only → defineProperty to install a mock
// (mirrors board/actions/script/__tests__/CopyButton.test.tsx).
function mockClipboard(impl: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(impl) },
    writable: true,
    configurable: true,
  });
}

describe('RewriteItem — copyable hook rewrite (READ-08, D-15)', () => {
  beforeEach(() => {
    mockClipboard(() => Promise.resolve());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the original struck-through and the variant text', () => {
    const rw = rewrite();
    const { container } = render(<RewriteItem rewrite={rw} />);

    // original lives inside a <del> (struck-through)
    const del = container.querySelector('del');
    expect(del?.textContent).toBe(rw.original);

    // variant is shown verbatim
    expect(screen.getByText(rw.variant)).toBeInTheDocument();
  });

  it('clicking Copy writes the variant (NOT the original) to the clipboard', () => {
    const rw = rewrite();
    render(<RewriteItem rewrite={rw} />);

    fireEvent.click(screen.getByRole('button', { name: /copy rewrite/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rw.variant);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(rw.original);
  });

  it('toggles the button label Copy → Copied → Copy after 1.5s', async () => {
    vi.useFakeTimers();
    const rw = rewrite();
    render(<RewriteItem rewrite={rw} />);

    const btn = screen.getByRole('button', { name: /copy rewrite/i });
    expect(btn.textContent).toBe('Copy');

    // click → resolve the clipboard promise (microtask) → label flips to "Copied"
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });
    expect(btn.textContent).toBe('Copied');

    // advance past the 1500ms revert window → back to "Copy"
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(btn.textContent).toBe('Copy');
  });

  it('graceful clipboard failure: a rejected writeText does not throw and leaves the label "Copy"', async () => {
    mockClipboard(() => Promise.reject(new Error('denied')));
    const rw = rewrite();
    render(<RewriteItem rewrite={rw} />);

    const btn = screen.getByRole('button', { name: /copy rewrite/i });
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });
    // no throw (test would fail on an unhandled rejection); label stays "Copy"
    expect(btn.textContent).toBe('Copy');
  });

  it('the Copy button has an accessible name and the markup passes axe', async () => {
    const { container } = render(<RewriteItem rewrite={rewrite()} />);
    expect(screen.getByRole('button', { name: 'Copy rewrite' })).toBeInTheDocument();

    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
