/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimilarVideosCard } from '../SimilarVideosCard';
import { fixtures } from '../../verdict/__tests__/fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('@/components/trending/tiktok-embed', () => ({
  TikTokEmbed: () => <div data-testid="tiktok-embed-stub" />,
}));

// Use real Radix Dialog (no stub) to test focus behaviour
// Stub the portal to render inline in happy-dom
vi.mock('@radix-ui/react-dialog', async (importOriginal) => {
  const original = await importOriginal<typeof import('@radix-ui/react-dialog')>();
  return {
    ...original,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('SimilarVideosCard — focus management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Esc key closes the modal', async () => {
    const user = userEvent.setup();
    render(
      <SimilarVideosCard
        items={fixtures.complete.retrieval_evidence!}
        signalAvailable={true}
      />,
    );
    // Open modal
    const rows = screen.getAllByTestId('similar-video-card-compact');
    fireEvent.click(rows[0]!);
    expect(screen.queryByTestId('similar-video-modal')).toBeInTheDocument();

    // Press Escape
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('similar-video-modal')).toBeNull();
  });

  it('close button is present inside the modal', () => {
    render(
      <SimilarVideosCard
        items={fixtures.complete.retrieval_evidence!}
        signalAvailable={true}
      />,
    );
    fireEvent.click(screen.getAllByTestId('similar-video-card-compact')[0]!);
    expect(screen.getByTestId('similar-video-modal-close')).toBeInTheDocument();
  });

  it('close button click closes the modal', () => {
    render(
      <SimilarVideosCard
        items={fixtures.complete.retrieval_evidence!}
        signalAvailable={true}
      />,
    );
    fireEvent.click(screen.getAllByTestId('similar-video-card-compact')[0]!);
    expect(screen.queryByTestId('similar-video-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('similar-video-modal-close'));
    expect(screen.queryByTestId('similar-video-modal')).toBeNull();
  });
});
