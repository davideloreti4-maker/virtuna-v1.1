import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/trending/stats
 *
 * Returns aggregate stats per category: video count, avg views, top sounds.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch non-archived videos
    const { data: videos, error: videosError } = await supabase
      .from("scraped_videos")
      .select("category, views, sound_name")
      .is("archived_at", null);

    if (videosError) {
      console.error("[trending/stats] Query error:", videosError);
      return Response.json(
        { error: "Failed to fetch stats" },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      return Response.json({ categories: [], total_videos: 0 });
    }

    // Aggregate by category
    const categoryMap = new Map<
      string,
      { count: number; totalViews: number; sounds: Map<string, number> }
    >();

    for (const video of videos) {
      const cat = video.category ?? "uncategorized";
      const existing = categoryMap.get(cat) ?? {
        count: 0,
        totalViews: 0,
        sounds: new Map<string, number>(),
      };

      existing.count++;
      existing.totalViews += video.views ?? 0;

      if (video.sound_name) {
        existing.sounds.set(
          video.sound_name,
          (existing.sounds.get(video.sound_name) ?? 0) + 1
        );
      }

      categoryMap.set(cat, existing);
    }

    const categories = Array.from(categoryMap.entries()).map(
      ([category, data]) => {
        // Top 5 sounds by frequency
        const topSounds = Array.from(data.sounds.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

        return {
          category,
          video_count: data.count,
          avg_views: Math.round(data.totalViews / data.count),
          top_sounds: topSounds,
        };
      }
    );

    // Sort by video count descending
    categories.sort((a, b) => b.video_count - a.video_count);

    return Response.json({
      categories,
      total_videos: videos.length,
    });
  } catch (error) {
    console.error("[trending/stats] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
