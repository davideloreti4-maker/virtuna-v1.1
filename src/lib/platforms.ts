/**
 * platforms.ts — shared platform identity for the Discover Feed surfaces.
 *
 * One source of truth for the per-platform glyph + brand-badge background, used by
 * both the Channels avatar badge (platform-avatar) and the Videos card badge
 * (feed-card). Brand-colored badges were chosen over a matte circle (UI-refinement
 * decision): a platform mark is identity, not chrome accent, so it carries its real
 * brand color — IG's gradient, TikTok black, YouTube red — with a white glyph.
 *
 * House-rule safe: the IG gradient is a plain linear-gradient at 45deg (NOT the
 * banned 137deg Raycast-glass signature), no backdrop-filter, no coral (#FF7F50).
 */
import { TiktokLogo, InstagramLogo, YoutubeLogo } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";

export const PLATFORM_ICON: Record<string, Icon> = {
  tiktok: TiktokLogo,
  instagram: InstagramLogo,
  youtube: YoutubeLogo,
};

// Brand backgrounds. Instagram = its signature warm→cool gradient (45deg, not 137).
const PLATFORM_BADGE_BG: Record<string, CSSProperties> = {
  instagram: {
    background:
      "linear-gradient(45deg, #feda75 0%, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)",
  },
  tiktok: { backgroundColor: "#000000" },
  youtube: { backgroundColor: "#ff0000" },
};

/** The brand-colored badge background for a platform (matte fallback when unknown). */
export function platformBadgeStyle(platform: string | null | undefined): CSSProperties {
  return PLATFORM_BADGE_BG[platform ?? "tiktok"] ?? { backgroundColor: "#000000" };
}

/** Human label for a platform (titles / aria). */
export function platformLabel(platform: string | null | undefined): string {
  switch (platform) {
    case "instagram":
      return "Instagram";
    case "youtube":
      return "YouTube";
    case "tiktok":
    default:
      return "TikTok";
  }
}
