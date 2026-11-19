/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import * as icons from '../icons';

const GLYPHS = Object.entries(icons);

describe('shell icons', () => {
  it('finds the glyphs (guards against an export list that matches nothing)', () => {
    expect(GLYPHS.length).toBeGreaterThan(0);
  });

  it.each(GLYPHS)('%s draws on the 24 grid, sizes from `size`, forwards aria-hidden', (_name, Icon) => {
    const { container } = render(<Icon size={23} aria-hidden />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('width')).toBe('23');
    expect(svg?.getAttribute('height')).toBe('23');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
