'use client';
import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { RetrievalEvidenceItem } from '@/lib/engine/types';
import { SimilarVideoCardCompact } from './SimilarVideoCardCompact';
import { COPY, TELEMETRY } from './actions-constants';
import { logger } from '@/lib/logger';
// TikTokEmbed requires both videoUrl (full URL) and videoId (extracted ID).
// See src/components/trending/tiktok-embed.tsx for props signature.
import { TikTokEmbed } from '@/components/trending/tiktok-embed';

/** Extract TikTok video ID from a URL like https://www.tiktok.com/@user/video/1234567890 */
function extractTikTokVideoId(url: string): string {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? '';
}

interface Props {
  items: ReadonlyArray<RetrievalEvidenceItem> | undefined;
  signalAvailable: boolean;
}

export function SimilarVideosCard({ items, signalAvailable }: Props) {
  const [openItem, setOpenItem] = useState<RetrievalEvidenceItem | null>(null);

  const handleTap = useCallback((item: RetrievalEvidenceItem) => {
    logger.info(TELEMETRY.SIMILAR_VIDEO_TAPPED, {
      video_url: item.video_url,
      similarity_score: item.similarity_score,
    });
    setOpenItem(item);
  }, []);

  const isEmpty = !signalAvailable || !items || items.length === 0;
  const visible = (items ?? []).slice(0, 5);

  return (
    <>
      <div
        className="flex h-full w-full flex-col gap-1 overflow-hidden p-2"
        data-testid="similar-videos-card"
      >
        <h4
          className="text-[10px] font-normal uppercase tracking-[0.04em] text-white/50"
          data-testid="similar-videos-title"
        >
          {COPY.SIMILAR_VIDEOS_TITLE}
        </h4>
        {isEmpty ? (
          <p
            className="text-xs italic text-foreground-muted"
            data-testid="similar-videos-empty"
          >
            {COPY.SIMILAR_VIDEOS_EMPTY}
          </p>
        ) : (
          <ul
            className="flex flex-col gap-1 overflow-y-auto"
            data-testid="similar-videos-list"
          >
            {visible.map((item) => (
              <li key={item.video_url ?? item.source_id}>
                <SimilarVideoCardCompact item={item} onTap={handleTap} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Radix Dialog portals at body level — avoids Pitfall 7 (Konva event interference) */}
      <Dialog open={openItem !== null} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DialogContent
          className="max-w-[400px] bg-[#18191a] border-white/[0.06]"
          data-testid="similar-video-modal"
        >
          <DialogTitle className="sr-only">TikTok video preview</DialogTitle>
          {openItem && openItem.video_url && (
            <TikTokEmbed
              videoUrl={openItem.video_url}
              videoId={extractTikTokVideoId(openItem.video_url)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
