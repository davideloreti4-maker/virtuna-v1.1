/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdaptShellNode } from '../AdaptShellNode';

describe('AdaptShellNode', () => {
  it('renders a div with data-testid="adapt-shell"', () => {
    render(<AdaptShellNode />);
    expect(screen.getByTestId('adapt-shell')).toBeTruthy();
  });

  it('contains the exact locked descriptor text', () => {
    render(<AdaptShellNode />);
    expect(
      screen.getByText('Niche-adapted concepts drawn from the source format.'),
    ).toBeTruthy();
  });

  it('does not render a skeleton or shimmer (no animate-pulse class)', () => {
    const { container } = render(<AdaptShellNode />);
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('does not render a skeleton testid', () => {
    render(<AdaptShellNode />);
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('does not contain "coming soon" text', () => {
    const { container } = render(<AdaptShellNode />);
    expect(container.textContent?.toLowerCase()).not.toContain('coming soon');
  });

  it('root element is a div (DOM component, not Konva)', () => {
    render(<AdaptShellNode />);
    const root = screen.getByTestId('adapt-shell');
    expect(root.tagName).toBe('DIV');
  });
});
