// Server component: import icons from the SSR-safe entry so Phosphor's
// createContext-based IconContext is never evaluated in the RSC graph
// (importing from the main entry breaks `next build` page-data collection).
import { Eye, Heart, ChatCircle, ShareNetwork } from "@phosphor-icons/react/dist/ssr";
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
  /**
   * Durable rehosted cover (covers bucket). OPT-IN: when the key is present the card renders a
   * cover thumbnail on top (a null value → gradient+caption poster). When OMITTED entirely (e.g.
   * the outlier-tile reuse, which brings its own cover banner) no cover block renders at all.
   */
  cover_url?: string | null;
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
  const showCoverBlock = "cover_url" in video;
  const card = (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden transition-colors hover:bg-white/[0.02]">
      {/* Cover thumbnail (durable rehosted cover) — opt-in via the cover_url key. A null cover
          falls through to the gradient + caption poster (same graceful degrade as the feed tile).
          Server component: the cover is a permanent bucket URL so it won't 403 (no onError needed). */}
      {showCoverBlock && (
        <div className="relative aspect-[9/16] bg-[linear-gradient(165deg,#312f2b,#181715)]">
          {video.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- rehosted cover, external bucket
            <img src={video.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <p className="rounded-md bg-[#f4f1ea] px-[11px] py-[9px] text-center font-serif text-[12px] font-bold leading-[1.3] text-[#17150f] line-clamp-4">
                {video.caption || "No caption"}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
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
          <ChatCircle className="w-3.5 h-3.5 text-foreground-muted" />
          <span className="text-xs text-foreground">{formatCount(video.comments)}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ShareNetwork className="w-3.5 h-3.5 text-foreground-muted" />
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
            style={{ backgroundColor: "oklch(0.72 0.16 40 / 0.1)", color: "var(--color-foreground-secondary)" }}
          >
            {video.engagementRate}%
          </span>
        )}

        <span className="text-foreground-muted">
          {formatRelativeTime(video.posted_at)}
        </span>
      </div>
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
