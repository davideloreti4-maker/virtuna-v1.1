/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimilarVideosCard } from '../SimilarVideosCard';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('@/components/trending/tiktok-embed', () => ({
  TikTokEmbed: () => <div />,
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: () => null,
  DialogTitle: () => null,
}));

describe('SimilarVideosCard — empty state', () => {
  it('shows CTA copy when retrieval_evidence is empty array (zero items)', () => {
    render(<SimilarVideosCard items={[]} signalAvailable={true} />);
    expect(screen.getByTestId('similar-videos-empty')).toHaveTextContent(
      'No similar videos yet — try a new analysis',
    );
  });

  it('shows unavailable copy when signalAvailable is false', () => {
    const fakeItems = [
      {
        source_pool: 'scraped_videos' as const,
        source_id: '00000000-0000-0000-0000-000000000001',
        video_url: 'https://tiktok.com/@x/video/1',
        creator_handle: 'a',
        caption_snippet: null,
        views: 100,
        likes: 10,
        shares: 5,
        comments: 2,
        saves: null,
        hashtags: [],
        posted_at: null,
        similarity_score: 0.9,
        bucket_label: 'average' as const,
        bucket_source: 'derived' as const,
        relaxed_to: null,
      },
    ];
    render(<SimilarVideosCard items={fakeItems} signalAvailable={false} />);
    expect(screen.getByTestId('similar-videos-empty')).toHaveTextContent(
      "Similar videos isn't available for this analysis",
    );
  });

  it('shows CTA copy when retrieval_evidence is undefined (no data yet)', () => {
    render(<SimilarVideosCard items={undefined} signalAvailable={true} />);
    expect(screen.getByTestId('similar-videos-empty')).toHaveTextContent(
      'No similar videos yet — try a new analysis',
    );
  });

  it('does NOT render the list element in empty state', () => {
    render(<SimilarVideosCard items={[]} signalAvailable={true} />);
    expect(screen.queryByTestId('similar-videos-list')).toBeNull();
  });
});
