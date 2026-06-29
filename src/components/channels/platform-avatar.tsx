"use client";

/**
 * PlatformAvatar — an Avatar with a small platform badge clipped to its corner
 * (Channels page chrome). Mirrors the Sandcastles channel rows/cards where each
 * avatar carries its source platform (TikTok / Instagram / YouTube).
 */
import { TiktokLogo, InstagramLogo, YoutubeLogo } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";

const PLATFORM_ICON: Record<string, Icon> = {
  tiktok: TiktokLogo,
  instagram: InstagramLogo,
  youtube: YoutubeLogo,
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
  const Badge = PLATFORM_ICON[platform] ?? TiktokLogo;
  return (
    <span className="relative inline-block shrink-0">
      <Avatar src={src} fallback={fallback} size={size} />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background-elevated text-foreground">
        <Badge size={10} weight="fill" />
      </span>
    </span>
  );
}
