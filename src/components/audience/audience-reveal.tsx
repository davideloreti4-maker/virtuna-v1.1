"use client";

/**
 * AudienceReveal — the "it's real" showcase (§P.5).
 *
 * Sandcastles' pitch is "every persona is based on a real person"; we go further and show
 * the ACTUAL scraped account + its real posts, then the derived audience signature. Reads
 * everything off the persisted Audience's `signature` + the lightweight `reveal` payload
 * (real scraped profile + top posts by engagement). Flat-warm system only — no new tokens.
 */

import Image from "next/image";
import { SealCheck } from "@phosphor-icons/react";
import type { Audience } from "@/lib/audience/audience-types";
import type { RevealData } from "@/lib/audience/calibration";
import { READING_CARD } from "@/components/reading/reading-section";
import { getPersonaDisplayName } from "@/components/audience/audience-display";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudienceRevealProps {
  audience: Audience;
  /** Real scraped account + posts (absent on the niche path). */
  reveal?: RevealData | null;
  /** "Use this audience" — proceeds with the calibrated audience. */
  onUse: () => void;
  className?: string;
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AudienceReveal({ audience, reveal, onUse, className }: AudienceRevealProps) {
  const sig = audience.signature ?? null;
  const profile = reveal?.profile;
  const posts = reveal?.posts ?? [];
  const handle = sig?.provenance.handle ?? audience.calibration?.handle ?? audience.name;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <p className="text-sm text-foreground-secondary">
        ✓ We read{" "}
        <span className="font-medium text-foreground">@{handle}</span>
      </p>

      {profile && (
        <div className={cn(READING_CARD, "flex items-center gap-4 px-5 py-4")}>
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.displayName}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] text-base font-semibold text-foreground-secondary">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-foreground">{profile.displayName}</span>
              {profile.verified && (
                <SealCheck weight="fill" className="h-4 w-4 shrink-0 text-cream-secondary" />
              )}
            </div>
            <p className="mt-0.5 text-xs text-foreground-secondary">
              {compactNumber(profile.followerCount)} followers · {compactNumber(profile.heartCount)} likes ·{" "}
              {compactNumber(profile.videoCount)} videos
            </p>
            {profile.bio && <p className="mt-1 truncate text-xs text-foreground-muted">{profile.bio}</p>}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
            Your posts we read
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {posts.map((p, i) => (
              <div key={i} className={cn(READING_CARD, "px-3 py-2.5")}>
                <p className="text-sm font-semibold text-foreground">{compactNumber(p.plays)} plays</p>
                <p className="mt-0.5 text-xs text-foreground-secondary">
                  {p.saveRate}% save · {p.shareRate}% share
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sig && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-foreground">Here&apos;s your audience</h3>
          {sig.summary && <p className="text-sm text-foreground-secondary">{sig.summary}</p>}

          {sig.audience.interest_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sig.audience.interest_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-xs text-foreground-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {sig.audience.what_resonates && (
            <p className="text-sm text-foreground-secondary">
              <span className="text-foreground-muted">What resonates: </span>
              {sig.audience.what_resonates}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {sig.audience.personas.map((p) => (
              <span
                key={p.archetype}
                title={p.reaction_frame}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-xs text-foreground-secondary"
              >
                {getPersonaDisplayName(p)} · {Math.round(p.share * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {sig && (
        <p className="text-xs text-foreground-muted">
          Read {sig.provenance.videos_analyzed} posts · watched {sig.provenance.videos_watched} ·
          subtitles {sig.provenance.sub_coverage}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={onUse}>
          Use this audience
        </Button>
      </div>
    </div>
  );
}
