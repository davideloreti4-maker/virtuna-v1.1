/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBoardStore } from '@/stores/board-store';
import { OrientationHint } from '../OrientationHint';

beforeEach(() => {
  localStorage.clear();
  useBoardStore.setState({ boardState: 'idle' });
});

describe('OrientationHint', () => {
  it('renders when not dismissed and state is idle', async () => {
    const { findByRole } = render(<OrientationHint />);
    // Hint reads localStorage in useEffect; allow microtask flush
    await findByRole('status');
    expect(screen.getByText(/Drop a video below/)).toBeInTheDocument();
  });

  it('does NOT render when localStorage flag is set', () => {
    localStorage.setItem('virtuna-orientation-hint-dismissed', '1');
    const { container } = render(<OrientationHint />);
    expect(container.firstChild).toBeNull();
  });

  it('does NOT render when state is streaming', () => {
    useBoardStore.setState({ boardState: 'streaming' });
    const { container } = render(<OrientationHint />);
    expect(container.firstChild).toBeNull();
  });

  it('clicking X dismisses + persists', async () => {
    const { findByLabelText } = render(<OrientationHint />);
    const dismissBtn = await findByLabelText('Dismiss orientation hint');
    fireEvent.click(dismissBtn);
    expect(localStorage.getItem('virtuna-orientation-hint-dismissed')).toBe('1');
    expect(screen.queryByText(/Drop a video below/)).not.toBeInTheDocument();
  });

  it('auto-dismisses when state transitions away from idle', async () => {
    const { findByRole, rerender } = render(<OrientationHint />);
    await findByRole('status');
    useBoardStore.setState({ boardState: 'streaming' });
    rerender(<OrientationHint />);
    expect(localStorage.getItem('virtuna-orientation-hint-dismissed')).toBe('1');
  });
});
