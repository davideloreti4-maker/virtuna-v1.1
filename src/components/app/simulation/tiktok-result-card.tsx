'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, Play } from 'lucide-react';
import type { PredictedEngagement } from '@/lib/engine/types';
import { cn } from '@/lib/utils';
import { Caption } from '@/components/ui/typography';

interface TikTokResultCardProps {
  videoSrc: string | null;
  thumbnailSrc: string | null;
  engagement: PredictedEngagement;
  creatorHandle?: string;
  caption?: string;
}

/**
 * Format a number to TikTok-style compact notation.
 * Examples: 1234 → "1,234", 12400 → "12.4K", 1500000 → "1.5M"
 */
function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (n >= 10_000) {
    const k = n / 1_000;
    return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return n.toString();
}

const ENGAGEMENT_ICONS = [
  { key: 'likes', Icon: Heart, label: 'Likes' },
  { key: 'comments', Icon: MessageCircle, label: 'Comments' },
  { key: 'shares', Icon: Share2, label: 'Shares' },
  { key: 'saves', Icon: Bookmark, label: 'Saves' },
] as const;

/**
 * TikTokResultCard — Vertical TikTok-style post mockup with autoplay video
 * and predicted engagement metrics overlay.
 *
 * Features:
 * - Video autoplay muted, loops continuously
 * - Click toggles mute/unmute with visual indicator
 * - Right sidebar with engagement icons + predicted counts
 * - Falls back to thumbnail if no video
 */
export function TikTokResultCard({
  videoSrc,
  thumbnailSrc,
  engagement,
  creatorHandle,
  caption,
}: TikTokResultCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // Autoplay on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    video.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      // Autoplay blocked — show play button
      setIsPlaying(false);
    });
  }, [videoSrc]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isPlaying) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      return;
    }

    video.muted = !video.muted;
    setIsMuted(!video.muted);
  }, [isPlaying]);

  const hasVideo = !!videoSrc;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-xl border border-white/[0.06]"
      style={{
        aspectRatio: '9/16',
        maxHeight: '420px',
        background: '#000',
        boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset, 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Video / Thumbnail */}
      {hasVideo ? (
        <video
          ref={videoRef}
          src={videoSrc}
          poster={thumbnailSrc ?? undefined}
          muted={isMuted}
          loop
          playsInline
          onClick={toggleMute}
          className="absolute inset-0 h-full w-full cursor-pointer object-cover"
        />
      ) : thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt="Content thumbnail"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-white/[0.03]">
          <Play className="h-12 w-12 text-white/20" />
        </div>
      )}

      {/* Click-to-play overlay when autoplay blocked */}
      {hasVideo && !isPlaying && (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/30"
        >
          <div className="rounded-full bg-white/20 p-4" style={{ backdropFilter: 'blur(8px)' }}>
            <Play className="h-8 w-8 text-white" />
          </div>
        </button>
      )}

      {/* Mute/unmute indicator (briefly shown on toggle) */}
      {hasVideo && isPlaying && (
        <div className="absolute left-3 top-3 z-20">
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/80',
            )}
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </div>
        </div>
      )}

      {/* Bottom overlay — creator + caption */}
      <div className="absolute bottom-0 left-0 right-12 z-20 p-3">
        <div
          className="space-y-1"
          style={{
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}
        >
          {creatorHandle && (
            <p className="text-sm font-semibold text-white">
              @{creatorHandle}
            </p>
          )}
          {caption && (
            <p className="line-clamp-2 text-xs text-white/80">
              {caption}
            </p>
          )}
        </div>
      </div>

      {/* Right sidebar — engagement icons */}
      <div className="absolute bottom-4 right-2 z-20 flex flex-col items-center gap-4">
        {ENGAGEMENT_ICONS.map(({ key, Icon }) => (
          <div key={key} className="flex flex-col items-center gap-0.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px]',
                  key === 'likes' ? 'text-red-400' : 'text-white'
                )}
                fill={key === 'likes' ? 'currentColor' : 'none'}
              />
            </div>
            <span className="text-[10px] font-medium text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
              {formatCount(engagement[key])}
            </span>
          </div>
        ))}
      </div>

      {/* Views count badge */}
      <div className="absolute right-2 top-3 z-20">
        <div
          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white/80"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        >
          {formatCount(engagement.views)} views
        </div>
      </div>

      {/* Predicted label */}
      <div className="absolute left-3 bottom-[calc(100%-32px)] z-20">
        <Caption className="text-white/50" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
          Predicted Performance
        </Caption>
      </div>
    </div>
  );
}
