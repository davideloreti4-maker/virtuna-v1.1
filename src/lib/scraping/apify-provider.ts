import { ApifyClient } from "apify-client";
import {
  apifyProfileSchema,
  apifyVideoSchema,
} from "@/lib/schemas/competitor";
import type { ProfileData, VideoData, ScrapingProvider } from "./types";

const PROFILE_ACTOR = "clockworks/tiktok-profile-scraper";
const VIDEO_ACTOR = "clockworks/tiktok-scraper";

export class ApifyScrapingProvider implements ScrapingProvider {
  private client: ApifyClient;

  constructor(token?: string) {
    this.client = new ApifyClient({
      token: token ?? process.env.APIFY_TOKEN!,
    });
  }

  async scrapeProfile(handle: string): Promise<ProfileData> {
    const run = await this.client
      .actor(PROFILE_ACTOR)
      .call(
        { profiles: [handle], resultsPerPage: 1 },
        { waitSecs: 60 },
      );

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (!items.length) {
      throw new Error(`No profile data returned for handle: ${handle}`);
    }

    const { authorMeta } = apifyProfileSchema.parse(items[0]);

    return {
      handle: authorMeta.name,
      displayName: authorMeta.nickName,
      bio: authorMeta.signature,
      avatarUrl: authorMeta.avatar ?? "",
      verified: authorMeta.verified,
      followerCount: authorMeta.fans,
      followingCount: authorMeta.following,
      heartCount: authorMeta.heart,
      videoCount: authorMeta.video,
    };
  }

  async scrapeVideos(handle: string, limit = 30): Promise<VideoData[]> {
    const run = await this.client
      .actor(VIDEO_ACTOR)
      .call(
        { profiles: [handle], resultsPerPage: limit },
        { waitSecs: 120 },
      );

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    return items
      .map((item) => {
        const result = apifyVideoSchema.safeParse(item);
        if (!result.success) {
          console.warn(
            `[scraping] Video validation failed:`,
            result.error.issues,
          );
          return null;
        }

        const v = result.data;
        return {
          platformVideoId: v.id,
          videoUrl: v.webVideoUrl ?? "",
          caption: v.text,
          views: v.playCount,
          likes: v.diggCount,
          comments: v.commentCount,
          shares: v.shareCount,
          saves: v.collectCount,
          hashtags: v.hashtags.map((h) => h.name),
          durationSeconds: v.videoMeta?.duration ?? 0,
          postedAt: v.createTime
            ? new Date(v.createTime * 1000)
            : new Date(),
        };
      })
      .filter((v): v is VideoData => v !== null);
  }
}
