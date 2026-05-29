'use client';

import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, VideoOff } from 'lucide-react';
import type { BehavioralPredictions } from '@/lib/engine/types';
import { cn } from '@/lib/utils';

interface Props {
  /** Storage path for the uploaded video (e.g. `userId/abc.mp4`). */
  videoStoragePath: string | null;
  /** Direct video URL — used while streaming (blob: URL from local file). */
  videoUrl?: string | null;
  /** First filmstrip keyframe URL, used as poster while video loads. */
  thumbnailUrl: string | null;
  /** Behavioral predictions from the analysis result — only used once
   *  `isStreaming` is false (i.e. the analysis is complete). */
  behavioral: BehavioralPredictions | null;
  /** True while the analysis is in flight — hides metrics, shows a pulse. */
  isStreaming?: boolean;
}

/**
 * InputResultCard — full vertical TikTok-style preview rendered inside the
 * Input frame. The video fills the frame; once the analysis is complete, the
 * model's predicted percentile ranks overlay as a right-side sidebar (TikTok
 * convention).
 *
 * The percentile strings (e.g. "top 5%") come directly from the engine's
 * behavioral_predictions — no client-side fabrication.
 */
export function InputResultCard({
  videoStoragePath,
  videoUrl: directVideoUrl,
  thumbnailUrl,
  behavioral,
  isStreaming = false,
}: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (directVideoUrl || !videoStoragePath) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/videos/sign?path=${encodeURIComponent(videoStoragePath)}`);
        if (!res.ok) return;
        const body = (await res.json()) as { url?: string };
        if (!cancelled && body.url) setSignedUrl(body.url);
      } catch {
        // ignore — card falls back to thumbnail or empty state
      }
    })();
    return () => { cancelled = true; };
  }, [videoStoragePath, directVideoUrl]);

  const videoSrc = directVideoUrl ?? signedUrl;
  const hasMedia = !!videoSrc || !!thumbnailUrl;
  const showMetrics = !isStreaming && !!behavioral;

  // TikTok sidebar — driven by real percentile fields from behavioral_predictions.
  // Heart maps to completion (TikTok "liked it" reads as "watched through").
  const metricRows = behavioral
    ? [
        { key: 'completion', Icon: Heart, tint: 'text-red-400', fill: true,  name: 'Completion', label: behavioral.completion_percentile },
        { key: 'comment',    Icon: MessageCircle, tint: 'text-white', fill: false, name: 'Comments', label: behavioral.comment_percentile },
        { key: 'share',      Icon: Share2, tint: 'text-white', fill: false, name: 'Shares', label: behavioral.share_percentile },
        { key: 'save',       Icon: Bookmark, tint: 'text-white', fill: false, name: 'Saves', label: behavioral.save_percentile },
      ]
    : [];

  // No media — the source video is deleted after analysis (retention), so this
  // is the common state on history/permalink views. The TikTok overlay only
  // makes sense over actual video; with none, the predicted percentiles ARE the
  // value, so render them as a readable labeled list (no floating circles, no
  // gradient anchoring nothing). Branch with media keeps the overlay treatment.
  if (!hasMedia) {
    return (
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[8px]"
        style={{
          background: '#000',
          boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset, 0 8px 32px rgba(0,0,0,0.4)',
        }}
        data-testid="input-card-nomedia"
      >
        {/* Header chip — states the missing-video fact without reading as broken */}
        <div className="flex items-center gap-1.5 px-3 pt-3 text-white/30">
          <VideoOff className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="text-[10px] font-medium uppercase tracking-wider">
            {isStreaming ? 'Analyzing…' : 'Video unavailable'}
          </span>
        </div>

        {showMetrics ? (
          <div className="flex flex-1 flex-col justify-center gap-1.5 px-3 pb-3">
            <span className="mb-1 text-[9px] font-medium uppercase tracking-wider text-white/40">
              Predicted engagement
            </span>
            {metricRows.map(({ key, Icon, tint, fill, name, label }) => (
              <div
                key={key}
                className="flex items-center gap-2.5 rounded-[6px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
              >
                <Icon className={cn('h-4 w-4 shrink-0', tint)} fill={fill ? 'currentColor' : 'none'} />
                <span className="text-[11px] font-medium text-white/60">{name}</span>
                <span className="ml-auto whitespace-nowrap text-[11px] font-semibold text-white">
                  {label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Streaming / no metrics yet — calm centered glyph, not a broken player */
          <div className="flex flex-1 items-center justify-center">
            <VideoOff
              className={cn('h-7 w-7 text-white/15', isStreaming && 'animate-pulse')}
              strokeWidth={1.5}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[8px]"
      style={{
        background: '#000',
        boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset, 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {videoSrc ? (
        <video
          src={videoSrc}
          poster={thumbnailUrl ?? undefined}
          muted
          loop
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbnailUrl ?? undefined}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Bottom gradient — anchors readability when metrics overlay */}
      {showMetrics && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)',
          }}
        />
      )}

      {/* Streaming badge — top-left, only while analyzing */}
      {hasMedia && isStreaming && (
        <div className="absolute left-2 top-2 z-20">
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white/90"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Analyzing
          </div>
        </div>
      )}

      {/* TikTok right sidebar — percentile labels from real model output */}
      {showMetrics && (
        <div className="absolute bottom-3 right-2 z-20 flex flex-col items-center gap-3">
          {metricRows.map(({ key, Icon, tint, fill, label }) => (
            <div key={key} className="flex flex-col items-center gap-0.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
              >
                <Icon
                  className={cn('h-4 w-4', tint)}
                  fill={fill ? 'currentColor' : 'none'}
                />
              </div>
              <span
                className="whitespace-nowrap text-[9px] font-medium text-white"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Predicted label — bottom-left */}
      {showMetrics && (
        <div
          className="absolute bottom-3 left-2 z-20 text-[9px] font-medium uppercase tracking-wider text-white/60"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
        >
          Predicted
        </div>
      )}
    </div>
  );
}
