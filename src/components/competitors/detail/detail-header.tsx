import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatCount } from "@/lib/competitors-utils";
import type { Tables } from "@/types/database.types";

interface DetailHeaderProps {
  profile: Tables<"competitor_profiles">;
}

/**
 * Profile header section for the competitor detail page.
 *
 * Displays avatar, handle, display name, bio, and key stat cards
 * (Followers, Total Likes, Videos). Server component.
 */
export function DetailHeader({ profile }: DetailHeaderProps) {
  const fallbackInitials = profile.tiktok_handle.slice(0, 2).toUpperCase();

  return (
    <div className="border-b border-white/[0.06] pb-6 mb-6">
      {/* Back link */}
      <Link
        href="/competitors"
        className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Back to Competitors
      </Link>

      {/* Profile info */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
        <Avatar
          src={profile.avatar_url ?? undefined}
          alt={profile.tiktok_handle}
          fallback={fallbackInitials}
          size="xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-foreground">
            @{profile.tiktok_handle}
          </h1>
          {profile.display_name && (
            <p className="text-sm text-foreground-muted">
              {profile.display_name}
            </p>
          )}
          {profile.bio && (
            <p className="text-sm text-foreground-muted mt-1 line-clamp-2">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-foreground-muted">Followers</p>
          <p className="text-xl font-semibold text-foreground">
            {formatCount(profile.follower_count)}
          </p>
        </div>
        <div className="border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-foreground-muted">Total Likes</p>
          <p className="text-xl font-semibold text-foreground">
            {formatCount(profile.heart_count)}
          </p>
        </div>
        <div className="border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-foreground-muted">Videos</p>
          <p className="text-xl font-semibold text-foreground">
            {formatCount(profile.video_count)}
          </p>
        </div>
      </div>
    </div>
  );
}
