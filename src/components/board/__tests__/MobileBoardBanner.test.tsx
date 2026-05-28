/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MobileBoardBanner } from '../MobileBoardBanner';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('@/components/ui/icon', () => ({
  Icon: ({ size: _size }: { icon: unknown; size: number }) => (
    <svg data-testid="x-icon" width={_size} height={_size} />
  ),
}));

// Stub localStorage (happy-dom 20.x requires explicit stub)
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
  get length() { return Object.keys(mockStorage).length; },
  key: (index: number) => Object.keys(mockStorage)[index] ?? null,
});

const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
}

describe('MobileBoardBanner', () => {
  beforeEach(() => {
    mockStorage['virtuna-mobile-banner-dismissed'] && delete mockStorage['virtuna-mobile-banner-dismissed'];
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalInnerWidth) {
      Object.defineProperty(window, 'innerWidth', originalInnerWidth);
    }
  });

  it('renders banner at 768px viewport', async () => {
    setWindowWidth(768);
    await act(async () => {
      render(<MobileBoardBanner />);
    });
    expect(screen.queryByTestId('mobile-board-banner')).toBeInTheDocument();
  });

  it('does not render banner at 1280px viewport', async () => {
    setWindowWidth(1280);
    await act(async () => {
      render(<MobileBoardBanner />);
    });
    expect(screen.queryByTestId('mobile-board-banner')).toBeNull();
  });

  it('dismiss button hides the banner', async () => {
    setWindowWidth(768);
    await act(async () => {
      render(<MobileBoardBanner />);
    });
    expect(screen.queryByTestId('mobile-board-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mobile-board-banner-dismiss'));
    expect(screen.queryByTestId('mobile-board-banner')).toBeNull();
  });

  it('persists dismissal in localStorage', async () => {
    setWindowWidth(768);
    await act(async () => {
      render(<MobileBoardBanner />);
    });
    fireEvent.click(screen.getByTestId('mobile-board-banner-dismiss'));
    expect(mockStorage['virtuna-mobile-banner-dismissed']).toBe('1');
  });
});
