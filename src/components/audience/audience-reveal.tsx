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
import { humanizeSlug } from "@/lib/text/humanize-slug";
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
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ── The showcase body, bounded ───────────────────────────────────────────────────────
          Everything above the action scrolls INSIDE the card, so the card itself always fits
          the viewport and the action below is always on screen.

          A first attempt used `position: sticky` on the action and did nothing, for a reason
          worth recording: the onboarding layout is `flex min-h-screen items-center
          justify-center`, so this card is a centred flex item whose height is exactly its
          content. Sticky needs a containing block TALLER than the sticky element to have any
          range to move in — here there is none, and the whole card simply scrolled off the
          page with the button on it. Measured after that change: y=978, bottom=1022, viewport
          982. Still below the fold.

          The subtraction is the layout's fixed chrome — logo block (~60px), the card's py-10
          (80px), the step indicator (~38px) and the action row below (~70px). Generous rather
          than exact: overshooting costs a little scroll inside the body, undershooting puts
          the button back under the fold, and only one of those is a defect. */}
      <div className="flex max-h-[calc(100vh-260px)] flex-col gap-6 overflow-y-auto pr-1">
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

      {/* ── THE TEN PEOPLE — the hero ───────────────────────────────────────────────────────
          They used to be the LAST thing on this screen and the smallest: ten grey pills under a
          paragraph, below a six-box grid of plays/save/share. The one thing that makes this
          product different from a prompt box was rendered as the least important item on its own
          payoff screen, after a ~135s wait spent building exactly this.

          Now they lead, one row each, with the share and the reaction frame that is the actual
          product — "what this person does when your video comes up". `reading-reveal` staggers
          them in so the room assembles rather than appearing as a block; the stagger is capped
          so a 10-person audience finishes in well under a second. */}
      {sig && sig.audience.personas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold text-foreground">
            Here&apos;s your audience — {sig.audience.personas.length} people
          </h3>
          {sig.summary && (
            <p className="mb-1 text-sm leading-relaxed text-foreground-secondary">{sig.summary}</p>
          )}
          <div className="flex flex-col gap-1.5">
            {sig.audience.personas.map((p, i) => (
              <div
                key={p.archetype}
                className={cn(
                  READING_CARD,
                  "reading-reveal flex items-start gap-3 px-3.5 py-2.5",
                )}
                style={{ animationDelay: `${Math.min(i, 10) * 0.05}s` }}
              >
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-action" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-foreground">
                      {getPersonaDisplayName(p)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-foreground-muted">
                      {Math.round(p.share * 100)}%
                    </span>
                  </div>
                  {p.reaction_frame && (
                    <p className="mt-0.5 text-xs leading-relaxed text-foreground-secondary">
                      {p.reaction_frame}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div>
          <p className="mb-2 text-micro font-medium uppercase tracking-[0.14em] text-foreground-muted">
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

      {/* Supporting detail — what the room cares about. Below the people themselves, because
          this is a description OF them and used to sit above them. */}
      {sig && (
        <div className="flex flex-col gap-3">
          {sig.audience.interest_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {/* Humanized, not raw. `interest_tags` is model output and arrives as slugs —
                  a live run on @garyvee returned `financial_discipline`, `anti_consumerism`,
                  `ego_death`, `judgment_free_zone`. Rendering those verbatim on the payoff
                  screen of a two-minute wait shows the creator our database instead of their
                  audience. Keyed on the raw slug, which stays unique after formatting. */}
              {sig.audience.interest_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-xs text-foreground-secondary"
                >
                  {humanizeSlug(tag) ?? tag}
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

          {/* The persona pills that used to live here are GONE — they are the hero block above
              now. Rendering both would say the same ten names twice on one screen, and the pill
              version hid the reaction frame in a `title` attribute no touch device can open. */}
        </div>
      )}

      {sig && (
        <p className="text-xs text-foreground-muted">
          Read {sig.provenance.videos_analyzed} posts · watched {sig.provenance.videos_watched} ·
          subtitles {sig.provenance.sub_coverage}
        </p>
      )}
      </div>

      {/* ── The terminal action ─────────────────────────────────────────────────────────────
          Measured 2026-08-04 at 1512×982: this button sat at y=989 with the page unscrolled —
          SEVEN pixels below the fold, on a flat dark page with no scroll affordance. It is the
          last step of onboarding, after a ~2 minute wait, and an automated walk sat on this
          screen for 272s without ever reaching it.

          It is OUTSIDE the scrolling body above, so its position no longer depends on how much
          the scrape returned — the post grid, the interest tags and the persona chips all vary
          per account, and a layout tuned against one of them goes back under the fold for the
          next. */}
      <div className="flex justify-end border-t border-white/[0.06] pt-4">
        <Button type="button" variant="primary" onClick={onUse}>
          Use this audience
        </Button>
      </div>
    </div>
  );
}
