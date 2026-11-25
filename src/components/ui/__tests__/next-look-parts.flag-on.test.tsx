/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

// The flag is a build-time constant; this file is the flag-on build.
vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: true }));

import { Card } from '../card';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../sheet';

describe('flag on: Card', () => {
  it('takes its surface from tokens; the legacy inline style is gone', () => {
    const { container } = render(<Card>x</Card>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.background).toBe('');
    expect(card.style.boxShadow).toBe('');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('shadow-[var(--shadow-rest)]');
  });

  it('still lets a caller pass its own style', () => {
    const { container } = render(<Card style={{ minHeight: 40 }}>x</Card>);
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe('40px');
  });
});

describe('flag on: Sheet', () => {
  it('a bottom sheet shows a grab handle', () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Skills</SheetTitle>
          <SheetDescription>Pick one.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(document.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
  });

  it('a side sheet does not', () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetTitle>Panel</SheetTitle>
          <SheetDescription>Details.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(document.querySelector('[data-slot="sheet-handle"]')).toBeNull();
  });

  it('with onHandleDismiss the handle sits in a zone that dismisses on a tap or a pull down', () => {
    const onHandleDismiss = vi.fn();
    render(
      <Sheet open>
        <SheetContent side="bottom" onHandleDismiss={onHandleDismiss}>
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>Details.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    const zone = document.querySelector('[data-slot="sheet-handle-zone"]') as HTMLElement;
    expect(zone.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
    fireEvent.click(zone);
    expect(onHandleDismiss).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(zone, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(zone, { clientY: 140, pointerId: 1 });
    expect(onHandleDismiss).toHaveBeenCalledTimes(2);
  });

  it('a drag that dismisses is not dismissed again by the click the browser fires after it', () => {
    const onHandleDismiss = vi.fn();
    render(
      <Sheet open>
        <SheetContent side="bottom" onHandleDismiss={onHandleDismiss}>
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>Details.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    const zone = document.querySelector('[data-slot="sheet-handle-zone"]') as HTMLElement;
    fireEvent.pointerDown(zone, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(zone, { clientY: 130, pointerId: 1 });
    fireEvent.pointerUp(zone, { clientY: 130, pointerId: 1 });
    fireEvent.click(zone);
    expect(onHandleDismiss).toHaveBeenCalledTimes(1);
  });

  it('a pull shorter than 24 (and no click) does not dismiss', () => {
    const onHandleDismiss = vi.fn();
    render(
      <Sheet open>
        <SheetContent side="bottom" onHandleDismiss={onHandleDismiss}>
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>Details.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    const zone = document.querySelector('[data-slot="sheet-handle-zone"]') as HTMLElement;
    fireEvent.pointerDown(zone, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(zone, { clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(zone, { clientY: 120, pointerId: 1 });
    expect(onHandleDismiss).not.toHaveBeenCalled();
  });

  it('without it the handle is the plain drawn bar (no zone)', () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>Details.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(document.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sheet-handle-zone"]')).toBeNull();
  });
});
