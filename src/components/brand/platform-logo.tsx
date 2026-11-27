import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The platforms' own marks (new look): wherever a screen names TikTok, Instagram or YouTube, the mark
 * goes beside the word (owner 2026-11-26). Two forms:
 * - `PlatformLogo`: the glyph alone, in `currentColor` (ink), sized like an icon;
 * - `PlatformBadge`: the glyph in white on the platform's own colour, round, for the corner of a
 *   picture. A platform mark is identity, not accent (`src/lib/platforms.ts`), so it keeps its colour.
 * Decorative by default (`aria-hidden`): the word beside it is the name. Pass `title` when it stands alone.
 */
export type PlatformId = "tiktok" | "instagram" | "youtube";

const PATHS: Record<PlatformId, React.ReactNode> = {
  tiktok: (
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  ),
  instagram: (
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38A5.86 5.86 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12a5.86 5.86 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.12-1.38 5.86 5.86 0 0 0 1.38-2.12c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.13A5.86 5.86 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" />
  ),
  youtube: (
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
  ),
};

const NAMES: Record<PlatformId, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

/** A stored platform string as one of the three, or null for anything else. */
export function platformIdOf(value: string | null | undefined): PlatformId | null {
  return value === "tiktok" || value === "instagram" || value === "youtube" ? value : null;
}

export function PlatformLogo({
  platform,
  size = 16,
  title,
  className,
}: {
  platform: PlatformId;
  size?: number;
  title?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-platform-logo={platform}
      className={cn("shrink-0", className)}
    >
      {PATHS[platform]}
    </svg>
  );
}

const BADGE_BG: Record<PlatformId, React.CSSProperties> = {
  tiktok: { backgroundColor: "#000000" },
  instagram: { background: "linear-gradient(45deg, #feda75 0%, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)" },
  youtube: { backgroundColor: "#ff0000" },
};

/** The mark in white on its platform's colour, round: for the corner of a creator's picture. */
export function PlatformBadge({ platform, size = 16, className }: { platform: PlatformId; size?: number; className?: string }): React.JSX.Element {
  return (
    <span
      aria-hidden
      data-platform-badge={platform}
      style={{ ...BADGE_BG[platform], width: size, height: size }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-white ring-2 ring-[var(--color-surface,#fff)]", className)}
    >
      <PlatformLogo platform={platform} size={Math.round(size * 0.58)} />
    </span>
  );
}

/** The mark and the word, inline: "♪ TikTok". */
export function PlatformName({ platform, size = 14, className }: { platform: PlatformId; size?: number; className?: string }): React.JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <PlatformLogo platform={platform} size={size} />
      <span>{NAMES[platform]}</span>
    </span>
  );
}
