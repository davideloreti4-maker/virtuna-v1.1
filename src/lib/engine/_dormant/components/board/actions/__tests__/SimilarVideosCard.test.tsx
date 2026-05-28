/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimilarVideosCard } from '../SimilarVideosCard';
import { fixtures } from '../../verdict/__tests__/fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
// Stub TikTokEmbed to avoid loading the embed script in tests
vi.mock('@/components/trending/tiktok-embed', () => ({
  TikTokEmbed: ({ videoUrl }: { videoUrl: string }) => <div data-testid="tiktok-embed-stub">{videoUrl}</div>,
}));
// Stub Dialog to render children inline (avoid portal complexity in happy-dom)
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  DialogClose: ({ children, ...rest }: { children?: React.ReactNode; [k: string]: unknown }) =>
    <button data-testid="similar-video-modal-close" {...rest}>{children}</button>,
}));

import { logger } from '@/lib/logger';

describe('SimilarVideosCard — non-empty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Similar videos" title', () => {
    render(
      <SimilarVideosCard
        items={fixtures.complete.retrieval_evidence!}
        signalAvailable={true}
      />,
    );
    expect(screen.getByTestId('similar-videos-title')).toHaveTextContent('Similar videos');
  });

  it('renders 5 SimilarVideoCardCompact rows when 5 items provided', () => {
    render(
      <SimilarVideosCard
        items={fixtures.complete.retrieval_evidence!}
        signalAvailable={true}
      />,
    );
    expect(screen.getAllByTestId('similar-video-card-compact')).toHaveLength(5);
  });

  it('caps at 5 rows even when 8 items are provided', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({
      source_pool: 'scraped_videos' as const,
      source_id: `00000000-0000-0000-0000-00000000000${i}`,
      video_url: `https://tiktok.com/@u/video/${i}`,
      creator_handle: `creator_${i}`,
      caption_snippet: null,
      views: 10000 + i,
      likes: 500,
      shares: 100,
      comments: 50,
      saves: null,
      hashtags: [],
      posted_at: null,
      similarity_score: 0.7 + i * 0.01,
      bucket_label: 'average' as const,
      bucket_source: 'derived' as const,
      relaxed_to: null,
    }));
    render(<SimilarVideosCard items={eight} signalAvailable={true} />);
    expect(screen.getAllByTestId('similar-video-card-compact')).toHaveLength(5);
  });

  it('tap on a row opens the TikTok embed modal', () => {
    render(
      <SimilarVideosCard
        items={fixtures.complete.retrieval_evidence!}
        signalAvailable={true}
      />,
    );
    const rows = screen.getAllByTestId('similar-video-card-compact');
    fireEvent.click(rows[0]!);
    expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    expect(screen.getByTestId('tiktok-embed-stub')).toHaveTextContent(
      fixtures.complete.retrieval_evidence![0]!.video_url!,
    );
  });

  it('tap fires similar_video_tapped telemetry with video_url + similarity_score', () => {
    render(
      <SimilarVideosCard
        items={fixtures.complete.retrieval_evidence!}
        signalAvailable={true}
      />,
    );
    const rows = screen.getAllByTestId('similar-video-card-compact');
    fireEvent.click(rows[0]!);
    const firstItem = fixtures.complete.retrieval_evidence![0]!;
    expect(logger.info).toHaveBeenCalledWith(
      'similar_video_tapped',
      expect.objectContaining({
        video_url: firstItem.video_url,
        similarity_score: firstItem.similarity_score,
      }),
    );
  });

  it('renders compact view counts (e.g. 124K) inside rows', () => {
    render(
      <SimilarVideosCard
        items={fixtures.complete.retrieval_evidence!}
        signalAvailable={true}
      />,
    );
    // fixtures.complete first item has views: 124000 → formats to "124.0K"
    const views = screen.getAllByTestId('similar-video-views');
    expect(views[0]!.textContent).toMatch(/124\.0K views/);
  });
});
