export interface ProfileData {
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
}

export interface VideoData {
  platformVideoId: string;
  videoUrl: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  hashtags: string[];
  durationSeconds: number;
  postedAt: Date;
}

export interface ScrapingProvider {
  /** Scrape a single TikTok profile by handle. Throws if profile not found. */
  scrapeProfile(handle: string): Promise<ProfileData>;

  /** Scrape recent videos for a TikTok handle. Returns validated videos (invalid items skipped). */
  scrapeVideos(handle: string, limit?: number): Promise<VideoData[]>;
}
