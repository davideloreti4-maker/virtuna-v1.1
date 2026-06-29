"use client";

/**
 * PlatformAvatar — an Avatar with a small brand-colored platform badge clipped to
 * its corner (Channels page chrome). Mirrors the Sandcastles channel rows/cards
 * where each avatar carries its source platform as a recognizable brand mark
 * (Instagram gradient / TikTok black / YouTube red) with a white glyph.
 */
import { Avatar } from "@/components/ui/avatar";
import { PLATFORM_ICON, platformBadgeStyle, platformLabel } from "@/lib/platforms";

const BADGE_SIZE: Record<"sm" | "md" | "lg", { box: string; glyph: number }> = {
  sm: { box: "h-3.5 w-3.5", glyph: 9 },
  md: { box: "h-4 w-4", glyph: 10 },
  lg: { box: "h-5 w-5", glyph: 12 },
};

export function PlatformAvatar({
  src,
  fallback,
  platform = "tiktok",
  size = "md",
}: {
  src?: string;
  fallback: string;
  platform?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Badge = PLATFORM_ICON[platform] ?? PLATFORM_ICON.tiktok!;
  const dims = BADGE_SIZE[size];
  return (
    <span className="relative inline-block shrink-0">
      <Avatar src={src} fallback={fallback} size={size} />
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full text-white ring-2 ring-background-elevated ${dims.box}`}
        style={platformBadgeStyle(platform)}
        title={platformLabel(platform)}
      >
        <Badge size={dims.glyph} weight="fill" />
      </span>
    </span>
  );
}
