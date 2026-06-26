/**
 * Phase 2 (Trustworthy-SIM Spike) Plan 02 — chat-bundle-adapter (THROWAWAY, D-05).
 *
 * The ONLY net-new logic in the spike: map a text chat/doc bundle (+ optional
 * `source=user` custom-context note) into an `EnrichInput` so the General
 * no-calibration case can drive the REAL synthesis path (`defaultSynthesize`,
 * temp 0 + seed) with ZERO omni video-watch calls.
 *
 * How the omni layer is skipped: the single `VideoData` carries NO `mediaUrl`, so
 * `prepareWatchUrl` never runs; the probe additionally injects
 * `watchVideo: async () => null` (enrich-signature.ts EnrichDeps) so not a single
 * omni call fires. The synth payload reads `caption` (enrich-signature.ts:433-449),
 * so packing the text into `caption` makes the bundle first-class evidence.
 *
 * Throwaway: deleted at spike close in 02-03 (recoverable from git if a NO-GO
 * fallback needs iteration). Imports TYPES ONLY — no runtime substrate, no network.
 */

import type { EnrichInput } from "@/lib/audience/enrich-signature";
import type { ProfileData, VideoData } from "@/lib/scraping/types";

/** Cap on the chat text packed into the single VideoData caption (synth-payload budget). */
const MAX_CAPTION_CHARS = 4000;

/**
 * Map a chat/doc text bundle (+ optional source=user note) into an `EnrichInput`.
 *
 * The note is folded into the caption as a tagged `[custom-context · source=user]`
 * suffix so the synthesis path sees it as first-class evidence (D-03). No video, no
 * mediaUrl, no omni — the probe stubs `watchVideo` to null so zero omni calls fire.
 */
export function chatBundleToEnrichInput(text: string, customNote?: string): EnrichInput {
  // Fold the source=user note into the caption text so the synth payload (which reads
  // caption — enrich-signature.ts:433-449) treats it as first-class evidence (D-03).
  const evidence = customNote
    ? `${text}\n\n[custom-context · source=user] ${customNote}`
    : text;

  const video: VideoData = {
    platformVideoId: "general-proto-0",
    videoUrl: "",
    caption: evidence.slice(0, MAX_CAPTION_CHARS),
    views: 1,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    hashtags: [],
    durationSeconds: 0,
    postedAt: new Date(0),
    // NO mediaUrl → prepareWatchUrl never runs; watchVideo is stubbed to null anyway.
  };

  const profile: ProfileData = {
    handle: "general-proto",
    displayName: "General Proto",
    bio: "",
    avatarUrl: "",
    verified: false,
    followerCount: 0,
    followingCount: 0,
    heartCount: 0,
    videoCount: 1,
  };

  return {
    handle: "general-proto",
    profile,
    videos: [video],
    subCoverage: "0/0",
    goalIntent: "grow",
  };
}
