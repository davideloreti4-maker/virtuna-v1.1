/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlaceholderCard } from '../PlaceholderCard';

function StubIcon({ size, ...rest }: { size?: number; 'aria-hidden'?: boolean }) {
  return <svg width={size ?? 16} height={size ?? 16} data-testid="stub-icon" {...rest} />;
}

describe('PlaceholderCard', () => {
  it('renders the label text', () => {
    render(<PlaceholderCard label="Reshoot script" phase="6" icon={StubIcon} />);
    expect(screen.getByTestId('placeholder-label')).toHaveTextContent('Reshoot script');
  });

  it('renders "Coming in Phase 6" sub-label when phase is 6', () => {
    render(<PlaceholderCard label="Reshoot script" phase="6" icon={StubIcon} />);
    expect(screen.getByTestId('placeholder-sub-label')).toHaveTextContent('Coming in Phase 6');
  });

  it('renders "Coming in Phase 7" sub-label when phase is 7', () => {
    render(<PlaceholderCard label="Share & export" phase="7" icon={StubIcon} />);
    expect(screen.getByTestId('placeholder-sub-label')).toHaveTextContent('Coming in Phase 7');
  });

  it('applies role="presentation" (not in tab order)', () => {
    render(<PlaceholderCard label="x" phase="6" icon={StubIcon} />);
    expect(screen.getByTestId('placeholder-card').getAttribute('role')).toBe('presentation');
  });

  it('aria-label combines label + phase info', () => {
    render(<PlaceholderCard label="Reshoot script" phase="6" icon={StubIcon} />);
    expect(screen.getByTestId('placeholder-card').getAttribute('aria-label')).toBe(
      'Reshoot script: coming in Phase 6',
    );
  });

  it('applies inline border with "1px dashed" (NOT solid)', () => {
    render(<PlaceholderCard label="x" phase="6" icon={StubIcon} />);
    const card = screen.getByTestId('placeholder-card') as HTMLDivElement;
    const border = card.style.border;
    expect(border).toContain('dashed');
    expect(border).not.toContain('solid');
  });

  it('applies bg-white/[0.02] class', () => {
    render(<PlaceholderCard label="x" phase="6" icon={StubIcon} />);
    const card = screen.getByTestId('placeholder-card');
    expect(card.className).toContain('bg-white/[0.02]');
  });

  it('applies text-white/40 class', () => {
    render(<PlaceholderCard label="x" phase="6" icon={StubIcon} />);
    const card = screen.getByTestId('placeholder-card');
    expect(card.className).toContain('text-white/40');
  });

  it('renders the icon component', () => {
    render(<PlaceholderCard label="x" phase="6" icon={StubIcon} />);
    expect(screen.getByTestId('stub-icon')).toBeInTheDocument();
  });
});
