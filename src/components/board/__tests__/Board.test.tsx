/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-konva — Stage/Layer/Rect rendered as divs (RESEARCH §Validation Wave 0)
vi.mock('react-konva', () => ({
  Stage: ({ children, ...rest }: any) => <div data-testid="stage" {...rest}>{children}</div>,
  Layer: ({ children }: any) => <div data-testid="layer">{children}</div>,
  Rect: () => null,
  Group: ({ children }: any) => <div>{children}</div>,
  Text: () => null,
  Line: () => null,
}));

// Mock next/dynamic to render the dynamic target synchronously
vi.mock('next/dynamic', () => ({
  default: (loader: any) => {
    const Comp = (props: any) => {
      const [Mod, setMod] = require('react').useState<any>(null);
      require('react').useEffect(() => { loader().then((m: any) => setMod(() => (m.default ?? m))); }, []);
      return Mod ? <Mod {...props} /> : null;
    };
    return Comp;
  },
}));

// Mock useSearchParams
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

import { Board } from '../Board';

describe('Board', () => {
  it('Test 1: renders without crashing', () => {
    const { container } = render(<Board />);
    expect(container.firstChild).toBeTruthy();
  });

  it('Test 2 + 4: has role=application with aria-label "Analysis board"', () => {
    render(<Board />);
    const el = screen.getByRole('application');
    expect(el).toHaveAttribute('aria-label', 'Analysis board');
  });

  it('Test 3: renders 5 camera preset buttons with correct aria-labels', () => {
    render(<Board />);
    ['Overview view', 'Verdict view', 'Audience view', 'Content Analysis view', 'Reset view']
      .forEach((label) => expect(screen.getByRole('button', { name: label })).toBeInTheDocument());
  });
});
