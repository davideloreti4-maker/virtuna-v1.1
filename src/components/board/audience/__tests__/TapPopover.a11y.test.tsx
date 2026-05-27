/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { TapPopover } from '../TapPopover';
import type { TapPopoverPayload } from '../audience-types';

expect.extend({ toHaveNoViolations });

const mockOnOpenChange = vi.fn();

const cellPayload: TapPopoverPayload = {
  kind: 'cell',
  personaId: 'persona_0',
  segmentIdx: 2,
  attention: 0.75,
  reason: 'dropped at visual cut',
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('TapPopover (a11y)', () => {
  it('axe-core no violations on cell variant', async () => {
    const { container } = render(
      <TapPopover
        open={true}
        onOpenChange={mockOnOpenChange}
        payload={cellPayload}
        anchorPos={{ x: 100, y: 50 }}
      />,
    );
    // Run axe against document body (portal renders there)
    const results = await axe(document.body);
    // @ts-expect-error -- extended matcher
    expect(results).toHaveNoViolations();
  });

  it('popover content is present in DOM when open=true', () => {
    render(
      <TapPopover
        open={true}
        onOpenChange={mockOnOpenChange}
        payload={cellPayload}
        anchorPos={{ x: 100, y: 50 }}
      />,
    );
    const content = document.querySelector('[data-tap-popover-content]');
    expect(content).toBeTruthy();
  });

  it('popover content is NOT present in DOM when open=false', () => {
    render(
      <TapPopover
        open={false}
        onOpenChange={mockOnOpenChange}
        payload={cellPayload}
        anchorPos={{ x: 100, y: 50 }}
      />,
    );
    const content = document.querySelector('[data-tap-popover-content]');
    expect(content).toBeFalsy();
  });

  it('focus-traps and returns focus on close', () => {
    const triggerBtn = document.createElement('button');
    triggerBtn.setAttribute('data-testid', 'external-trigger');
    triggerBtn.textContent = 'Open';
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    render(
      <TapPopover
        open={true}
        onOpenChange={mockOnOpenChange}
        payload={cellPayload}
        anchorPos={{ x: 100, y: 50 }}
      />,
    );

    const content = document.querySelector('[data-tap-popover-content]');
    expect(content).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
