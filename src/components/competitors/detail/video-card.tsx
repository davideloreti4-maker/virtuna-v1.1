import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { formatCount } from "@/lib/competitors-utils";

export interface VideoCardData {
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  duration_seconds: number | null;
  posted_at: string | null;
  video_url: string | null;
  engagementRate: number | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "--";
  const now = Date.now();
  const posted = new Date(dateStr).getTime();
  const diffMs = now - posted;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "just now";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  }
  // Older than 30 days: show absolute date
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Individual video card with text-based metrics display.
 *
 * Server component -- no interactivity needed.
 * Shows caption, 4 metric columns, duration, engagement rate badge,
 * and relative posting time.
 */
export function VideoCard({ video }: { video: VideoCardData }) {
  const card = (
    <div className="border border-white/[0.06] rounded-xl p-4 space-y-3 transition-colors hover:bg-white/[0.02]">
      {/* Caption */}
      <p className={`text-sm leading-snug ${video.caption ? "text-foreground line-clamp-2" : "text-foreground-muted italic"}`}>
        {video.caption || "No caption"}
      </p>

      {/* 4-column metrics grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center gap-1">
          <Eye className="w-3.5 h-3.5 text-foreground-muted" />
          <span className="text-xs text-foreground">{formatCount(video.views)}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Heart className="w-3.5 h-3.5 text-foreground-muted" />
          <span className="text-xs text-foreground">{formatCount(video.likes)}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5 text-foreground-muted" />
          <span className="text-xs text-foreground">{formatCount(video.comments)}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Share2 className="w-3.5 h-3.5 text-foreground-muted" />
          <span className="text-xs text-foreground">{formatCount(video.shares)}</span>
        </div>
      </div>

      {/* Bottom row: duration, engagement rate, posted time */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground-muted">
          {formatDuration(video.duration_seconds)}
        </span>

        {video.engagementRate !== null && (
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ backgroundColor: "oklch(0.72 0.16 40 / 0.1)", color: "#FF7F50" }}
          >
            {video.engagementRate}%
          </span>
        )}

        <span className="text-foreground-muted">
          {formatRelativeTime(video.posted_at)}
        </span>
      </div>
    </div>
  );

  if (video.video_url) {
    return (
      <a
        href={video.video_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {card}
      </a>
    );
  }

  return card;
}
