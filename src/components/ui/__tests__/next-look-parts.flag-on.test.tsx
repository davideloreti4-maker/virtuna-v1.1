/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

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
});
