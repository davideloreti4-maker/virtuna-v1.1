/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { badgeVariants } from '../badge';
import { buttonVariants } from '../button';
import { Card, CardContent, CardFooter, CardHeader } from '../card';

// ─────────────────────────────────────────────────────────────────────────────
// Flag off, the base parts must look exactly as they did before the new look.
//
// A `next:` class matches nothing unless <html data-look="next"> is set, so what the flag-off
// app sees is the class list WITHOUT them. This file was written and its snapshot recorded
// BEFORE the parts were restyled. If it fails, a legacy class was changed or removed: fix the
// component. Never update this snapshot with `-u`.
// ─────────────────────────────────────────────────────────────────────────────

const legacy = (cls: string) =>
  cls.split(/\s+/).filter((c) => c && !c.startsWith('next:')).sort().join(' ');

const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'destructive'] as const;
const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
const BADGE_VARIANTS = ['default', 'secondary', 'accent', 'success', 'warning', 'error', 'info'] as const;
const BADGE_SIZES = ['sm', 'md'] as const;

describe('flag off: the base parts keep their legacy classes', () => {
  it.each(BUTTON_VARIANTS.flatMap((v) => BUTTON_SIZES.map((s) => [v, s] as const)))(
    'button %s / %s',
    (variant, size) => {
      expect(legacy(buttonVariants({ variant, size }))).toMatchSnapshot();
    },
  );

  it.each(BADGE_VARIANTS.flatMap((v) => BADGE_SIZES.map((s) => [v, s] as const)))(
    'badge %s / %s',
    (variant, size) => {
      expect(legacy(badgeVariants({ variant, size }))).toMatchSnapshot();
    },
  );

  it('card keeps its inline surface and its classes', () => {
    const { container } = render(
      <Card>
        <CardHeader>h</CardHeader>
        <CardContent>c</CardContent>
        <CardFooter>f</CardFooter>
      </Card>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('style')).toMatchSnapshot();
    expect([card, ...Array.from(card.children)].map((el) => legacy(el.className))).toMatchSnapshot();
  });
});
