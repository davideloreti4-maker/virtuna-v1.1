import { VideoCard } from "./video-card";
import type { VideoCardData } from "./video-card";

interface TopVideosSectionProps {
  topVideos: VideoCardData[];
  recentVideos: VideoCardData[];
  cadence: { postsPerWeek: number; postsPerMonth: number } | null;
}

/**
 * Videos section with top performing and recent videos in responsive grids,
 * plus posting cadence stats.
 *
 * Server component -- VideoCard is a server component, no Recharts here.
 */
export function TopVideosSection({
  topVideos,
  recentVideos,
  cadence,
}: TopVideosSectionProps) {
  const hasVideos = topVideos.length > 0 || recentVideos.length > 0;

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-4">Videos</h2>

      {/* Posting cadence stats */}
      <div className="flex flex-wrap gap-2 mb-6">
        {cadence ? (
          <>
            <span className="border border-white/[0.06] rounded-lg px-3 py-1 inline-flex items-center text-sm text-foreground">
              ~{cadence.postsPerWeek} posts/week
            </span>
            <span className="border border-white/[0.06] rounded-lg px-3 py-1 inline-flex items-center text-sm text-foreground">
              ~{cadence.postsPerMonth} posts/month
            </span>
          </>
        ) : (
          <span className="border border-white/[0.06] rounded-lg px-3 py-1 inline-flex items-center text-sm text-foreground-muted">
            Not enough data
          </span>
        )}
      </div>

      {!hasVideos ? (
        <p className="text-center text-foreground-muted py-12">
          No videos available
        </p>
      ) : (
        <div className="space-y-8">
          {/* Top Performing */}
          {topVideos.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
                Top Performing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topVideos.map((video, i) => (
                  <VideoCard key={i} video={video} />
                ))}
              </div>
            </div>
          )}

          {/* Recent Videos */}
          {recentVideos.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
                Recent Videos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentVideos.map((video, i) => (
                  <VideoCard key={i} video={video} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
