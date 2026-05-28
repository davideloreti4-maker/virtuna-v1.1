'use client';
import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
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
  // Ref to the last tapped row — focus returns here when modal closes
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleTap = useCallback((item: RetrievalEvidenceItem, el?: HTMLElement | null) => {
    logger.info(TELEMETRY.SIMILAR_VIDEO_TAPPED, {
      video_url: item.video_url,
      similarity_score: item.similarity_score,
    });
    triggerRef.current = el ?? null;
    setOpenItem(item);
  }, []);

  const handleClose = useCallback(() => {
    setOpenItem(null);
  }, []);

  // Return focus to the triggering row when dialog closes
  const handleCloseAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    triggerRef.current?.focus();
  }, []);

  const isUnavailable = !signalAvailable;
  const isEmpty = isUnavailable || !items || items.length === 0;
  const emptyMessage = isUnavailable
    ? COPY.SIMILAR_VIDEOS_UNAVAILABLE
    : COPY.SIMILAR_VIDEOS_EMPTY;
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
            {emptyMessage}
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

      {/* Radix Dialog portals at body level — avoids Pitfall 7 (Konva event interference).
          onOpenAutoFocus: initial focus lands on the close button (explicit autoFocus).
          onCloseAutoFocus: returns focus to the triggering card row. */}
      <Dialog open={openItem !== null} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent
          className="max-w-[400px] bg-[#18191a] border-white/[0.06]"
          data-testid="similar-video-modal"
          onCloseAutoFocus={handleCloseAutoFocus}
          onOpenAutoFocus={(e) => {
            // Prevent default (which focuses the content root) so autoFocus on
            // the close button takes precedence
            e.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">TikTok video preview</DialogTitle>
          {/* Close button receives autoFocus so keyboard users land here first */}
          <DialogClose
            autoFocus
            className="absolute right-3 top-3 text-foreground-muted hover:text-foreground"
            aria-label="Close video preview"
            data-testid="similar-video-modal-close"
          >
            ×
          </DialogClose>
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
