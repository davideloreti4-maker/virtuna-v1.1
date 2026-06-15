/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

// Control the mobile/desktop side switch deterministically.
let mobile = false;
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => mobile,
}));

import { DrillSheet } from '../drill-sheet';

describe('DrillSheet — generic disclosure container (READ-07)', () => {
  beforeEach(() => {
    mobile = false; // desktop (right) by default
  });

  it('renders arbitrary children + title when open (the Phase-3/5 mount contract)', () => {
    render(
      <DrillSheet open title="Hook detail" onOpenChange={() => {}}>
        <p>panel body</p>
      </DrillSheet>,
    );
    expect(screen.getByText('panel body')).toBeInTheDocument();
    // title renders as the SheetTitle (a11y dialog name)
    expect(screen.getByText('Hook detail')).toBeInTheDocument();
  });

  it('does NOT render children when closed', () => {
    render(
      <DrillSheet open={false} title="Hook detail" onOpenChange={() => {}}>
        <p>panel body</p>
      </DrillSheet>,
    );
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
  });

  it('the dialog is named by the provided title (no missing-title a11y warning)', () => {
    render(
      <DrillSheet open title="Retention detail" onOpenChange={() => {}}>
        <p>body</p>
      </DrillSheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Retention detail' })).toBeInTheDocument();
  });

  it('fires onOpenChange(false) when dismissed via Escape', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DrillSheet open title="Hook detail" onOpenChange={onOpenChange}>
        <p>panel body</p>
      </DrillSheet>,
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fires onOpenChange(false) when the close button is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DrillSheet open title="Hook detail" onOpenChange={onOpenChange}>
        <p>panel body</p>
      </DrillSheet>,
    );
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens to the right on desktop and the bottom on mobile', () => {
    const { rerender } = render(
      <DrillSheet open title="t" onOpenChange={() => {}}>
        <p>b</p>
      </DrillSheet>,
    );
    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveAttribute('data-side', 'right');

    mobile = true;
    rerender(
      <DrillSheet open title="t" onOpenChange={() => {}}>
        <p>b</p>
      </DrillSheet>,
    );
    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveAttribute('data-side', 'bottom');
  });

  it('passes axe', async () => {
    render(
      <DrillSheet open title="Hook detail" onOpenChange={() => {}}>
        <p>panel body</p>
      </DrillSheet>,
    );
    // Scope axe to the dialog content (the component's a11y surface). Axing the whole
    // document trips a known Radix-under-happy-dom false positive: the portal-level
    // `data-radix-focus-guard` sentinel spans are reported as aria-hidden-focusable,
    // which real browsers handle correctly. The dialog itself is the surface we own.
    const dialog = screen.getByRole('dialog', { name: 'Hook detail' });
    const results = await axe(dialog);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
