/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DecodeShellNode } from '../DecodeShellNode';

describe('DecodeShellNode', () => {
  it('renders a div with data-testid="decode-shell"', () => {
    render(<DecodeShellNode />);
    expect(screen.getByTestId('decode-shell')).toBeTruthy();
  });

  it('contains the exact locked descriptor text', () => {
    render(<DecodeShellNode />);
    expect(
      screen.getByText('Structural breakdown of why this video worked.'),
    ).toBeTruthy();
  });

  it('does not render a skeleton or shimmer (no animate-pulse class)', () => {
    const { container } = render(<DecodeShellNode />);
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('does not render a skeleton testid', () => {
    render(<DecodeShellNode />);
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('does not contain "coming soon" text', () => {
    const { container } = render(<DecodeShellNode />);
    expect(container.textContent?.toLowerCase()).not.toContain('coming soon');
  });

  it('root element is a div (DOM component, not Konva)', () => {
    render(<DecodeShellNode />);
    const root = screen.getByTestId('decode-shell');
    expect(root.tagName).toBe('DIV');
  });
});
