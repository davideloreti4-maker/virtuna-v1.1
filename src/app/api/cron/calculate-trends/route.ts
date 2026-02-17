import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/calculate-trends
 *
 * Aggregates scraped_videos into trending_sounds with velocity scores.
 * Runs hourly via Vercel Cron.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const twentyFourHoursAgo = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    ).toISOString();
    const fortyEightHoursAgo = new Date(
      now.getTime() - 48 * 60 * 60 * 1000
    ).toISOString();

    // Fetch non-archived videos with sound names from the last 48h
    const { data: videos, error: fetchError } = await supabase
      .from("scraped_videos")
      .select(
        "sound_name, sound_url, views, likes, shares, created_at"
      )
      .is("archived_at", null)
      .not("sound_name", "is", null)
      .gte("created_at", fortyEightHoursAgo)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[calculate-trends] Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch videos" },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ processed: 0, message: "No recent videos" });
    }

    // Aggregate by sound_name
    const soundMap = new Map<
      string,
      {
        sound_url: string | null;
        video_count: number;
        total_views: number;
        recent_views: number; // last 24h
        older_views: number; // 24-48h
        first_seen: string;
        last_seen: string;
      }
    >();

    for (const video of videos) {
      const name = video.sound_name!;
      const existing = soundMap.get(name);
      const views = video.views ?? 0;
      const isRecent = video.created_at! >= twentyFourHoursAgo;

      if (existing) {
        existing.video_count++;
        existing.total_views += views;
        if (isRecent) existing.recent_views += views;
        else existing.older_views += views;
        if (video.created_at! < existing.first_seen)
          existing.first_seen = video.created_at!;
        if (video.created_at! > existing.last_seen)
          existing.last_seen = video.created_at!;
        if (!existing.sound_url && video.sound_url)
          existing.sound_url = video.sound_url;
      } else {
        soundMap.set(name, {
          sound_url: video.sound_url,
          video_count: 1,
          total_views: views,
          recent_views: isRecent ? views : 0,
          older_views: isRecent ? 0 : views,
          first_seen: video.created_at!,
          last_seen: video.created_at!,
        });
      }
    }

    // Calculate velocity scores and trend phases, then upsert
    const trendRecords = Array.from(soundMap.entries()).map(
      ([sound_name, data]) => {
        // Growth rate: (recent - older) / max(older, 1) — avoids division by zero
        const growth_rate =
          data.older_views > 0
            ? (data.recent_views - data.older_views) / data.older_views
            : data.recent_views > 0
              ? 1.0
              : 0;

        // Velocity score: combines video count, views, and growth
        const velocity_score =
          Math.log10(Math.max(data.total_views, 1)) *
          data.video_count *
          (1 + Math.max(growth_rate, 0));

        // Determine trend phase based on growth rate, velocity, and absolute volume
        const trend_phase = classifyTrendPhase(growth_rate, velocity_score, data.total_views);

        return {
          sound_name,
          sound_url: data.sound_url,
          video_count: data.video_count,
          total_views: data.total_views,
          growth_rate: Math.round(growth_rate * 1000) / 1000,
          velocity_score: Math.round(velocity_score * 100) / 100,
          trend_phase,
          first_seen: data.first_seen,
          last_seen: data.last_seen,
          metadata: { calculated_at: now.toISOString() },
        };
      }
    );

    // Upsert in batches
    const BATCH_SIZE = 50;
    let upsertedCount = 0;

    for (let i = 0; i < trendRecords.length; i += BATCH_SIZE) {
      const batch = trendRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("trending_sounds")
        .upsert(batch, { onConflict: "sound_name" });

      if (error) {
        console.error(
          `[calculate-trends] Upsert error (offset ${i}):`,
          error
        );
      } else {
        upsertedCount += batch.length;
      }
    }

    console.log(
      `[calculate-trends] Processed ${videos.length} videos into ${trendRecords.length} sounds (${upsertedCount} upserted)`
    );

    return NextResponse.json({
      processed: videos.length,
      sounds: trendRecords.length,
      upserted: upsertedCount,
    });
  } catch (error) {
    console.error("[calculate-trends] Failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function classifyTrendPhase(
  growthRate: number,
  velocityScore: number,
  totalViews: number
): string {
  // High absolute volume with modest growth = peak (not declining) — SIG-02
  if (totalViews >= 500_000 && growthRate >= -0.2) return "peak";
  if (growthRate > 0.5 && velocityScore < 50) return "emerging";
  if (growthRate > 0.3 && velocityScore >= 50) return "rising";
  if (growthRate >= -0.1 && growthRate <= 0.3 && velocityScore >= 100)
    return "peak";
  return "declining";
}
