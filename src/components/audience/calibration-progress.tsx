"use client";

/**
 * CalibrationProgress — the ~2-minute calibration wait, as the account itself.
 *
 * ONE card, rendered by BOTH calibration clients (`/audience/new`'s AudienceCreate and
 * `/welcome`'s CalibrationFlow). They had drifted into two different waits for the same
 * pipeline: /welcome drew the avatar and the progress spine, /audience/new drew a pulsing dot
 * over one line of text and a stat that was wrong. Same SSE stream, same phases — so one
 * component, and the drift cannot come back.
 *
 * The order is the argument the card makes, top to bottom:
 *
 *   1. WHO — avatar, display name, verified tick, @handle · PLATFORM. This is the first proof
 *      the run is real, and it lands within seconds of the crawler reaching the account.
 *   2. WHAT THEY HAVE — the account's own totals. `videoCount` is the PROFILE total, not the
 *      scraped window; rendering the window here is what made @mrbeast read "12 VIDEOS".
 *   3. WHAT WE ARE DOING — the shared ProgressChecklist, driven by the route's real `stage`
 *      frames against the calibration plan. Same spine as every other wait in the product.
 *   4. WHAT WE ARE WORKING WITH — the posts, as covers with their view counts.
 *
 * HONESTY, and it is load-bearing here because everything on this card is scraped:
 *  - A zero figure is OMITTED, never printed as "0". Instagram and YouTube expose no
 *    profile-level total likes (`scraping/types.ts` — their remaps set heartCount to 0), so a
 *    "0 LIKES" tile would be a fabricated absence dressed as a measurement.
 *  - NO COUNT of what the pipeline pulled or watched appears anywhere (owner call
 *    2026-08-05). The numbers on this card are the ACCOUNT's facts, never the engine's.
 *  - Covers and avatars are ephemeral CDN URLs. A dead one degrades to a placeholder that
 *    keeps its slot; nothing ever renders as a broken image.
 *  - Before the scrape returns there is no account to show, so the card is the plan alone —
 *    still the whole pipeline, never a spinner.
 */

import { useState } from "react";
import type { CalibrationEvidence } from "@/lib/audience/calibration";
import { formatCount } from "@/lib/account-metrics/account-metrics";
import { CoverFill } from "@/components/primitives/CoverFill";
import { ProgressChecklist, type StageState } from "@/components/thread/progress-checklist";
import { cn } from "@/lib/utils";

/** Cap the grid at two dense rows — past that a wall of covers stops reading as evidence. */
const MAX_COVERS = 12;

export interface CalibrationProgressProps {
  /** The account, the moment the scraper has it. Null until then → the plan stands alone. */
  evidence: CalibrationEvidence | null;
  /** Live stage frames from the calibrate SSE route, merged onto `plan` by name. */
  stages: StageState[];
  /** The ordered phase plan — from `calibrationVocabulary(hasHandle)`, never hand-written. */
  plan: string[];
  /** Last `status` message — the fallback if a stream somehow sends no `stage` frame. */
  statusMsg?: string;
  /** Platform label for the identity line ("TIKTOK"). */
  platformLabel?: string;
  className?: string;
  /** Root test id, so both call sites keep the hooks their suites already bind. */
  testId?: string;
}

export function CalibrationProgress({
  evidence,
  stages,
  plan,
  statusMsg,
  platformLabel = "TikTok",
  className,
  testId,
}: CalibrationProgressProps) {
  const covers = evidence?.videos.slice(0, MAX_COVERS) ?? [];

  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-white/[0.06] bg-surface-sunken p-5",
        className,
      )}
      data-testid={testId}
    >
      {evidence ? (
        <>
          <AccountIdentity evidence={evidence} platformLabel={platformLabel} />
          <AccountFigures evidence={evidence} />
        </>
      ) : null}

      <Spine stages={stages} plan={plan} statusMsg={statusMsg} />

      {covers.length > 0 && (
        <div
          className="grid grid-cols-4 gap-1.5 sm:grid-cols-6"
          data-testid="calibration-covers"
        >
          {covers.map((v, i) => (
            <PostCover key={i} coverUrl={v.coverUrl} views={v.views} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The spine, or the one status line if the stream sent no phases.
 *
 * The fallback is not defensive tidiness: `calibration-flow` has always kept `statusMsg` for a
 * stream that emits `status` but no `stage`, and dropping it would be a silent contract break
 * for any consumer still on the old frames.
 */
function Spine({
  stages,
  plan,
  statusMsg,
}: {
  stages: StageState[];
  plan: string[];
  statusMsg?: string;
}) {
  if (stages.length > 0) {
    return (
      <div data-testid="calibration-status">
        <ProgressChecklist stages={stages} plan={plan} />
      </div>
    );
  }
  // No live phase yet: draw the PLAN, which is still the whole pipeline. Only when there is no
  // plan either (a caller that has none) does this degrade to the single status line.
  if (plan.length > 0) {
    return (
      <div data-testid="calibration-status">
        <ProgressChecklist stages={[]} plan={plan} />
      </div>
    );
  }
  return (
    <p className="text-sm text-foreground-secondary" data-testid="calibration-status">
      {statusMsg}
    </p>
  );
}

/** Avatar + display name + verified + @handle · PLATFORM. */
function AccountIdentity({
  evidence,
  platformLabel,
}: {
  evidence: CalibrationEvidence;
  platformLabel: string;
}) {
  const name = evidence.displayName?.trim() || `@${evidence.handle}`;

  return (
    <div className="flex items-center gap-3" data-testid="calibration-identity">
      <Avatar url={evidence.avatarUrl} name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-reading font-semibold tracking-[-0.01em] text-foreground">
            {name}
          </span>
          {evidence.verified ? <VerifiedTick /> : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-label text-foreground-muted">
          <span className="truncate">@{evidence.handle}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-micro uppercase tracking-[0.08em]">{platformLabel}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * The scraped avatar over a warm placeholder carrying the initial.
 *
 * TikTok's avatar CDN URLs are ephemeral and expire, so the <img> removes ITSELF on error and
 * the initial shows through — never a broken-image box, and never an empty circle either.
 */
function Avatar({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name.replace(/^@/, "")[0] ?? "?").toUpperCase();

  return (
    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.06]">
      <span
        className="absolute inset-0 flex items-center justify-center text-reading font-semibold text-foreground-muted"
        aria-hidden="true"
      >
        {initial}
      </span>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- ephemeral CDN avatar, not a static asset
        <img
          src={url}
          alt=""
          className="relative h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

/** Subtle verified tick — cream-secondary (a data signal, not brand accent, not platform blue). */
function VerifiedTick() {
  return (
    <span
      className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-white/[0.08]"
      title="Verified"
      aria-label="Verified"
    >
      <svg viewBox="0 0 10 10" className="h-[7px] w-[7px]" fill="none" aria-hidden="true">
        <path
          d="M1.5 5L4 7.5L8.5 2.5"
          stroke="var(--color-foreground-secondary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * The account's own totals — POSTS · FOLLOWERS · LIKES.
 *
 * `videoCount` is the profile-level total. The old card rendered `videos.length` here, which is
 * the 12-post scrape WINDOW, so an account with thousands of posts announced "12".
 *
 * A zero is dropped rather than drawn. Instagram and YouTube expose no profile-level total
 * likes at all, so their remaps set `heartCount: 0` — an honest absence, and printing it as
 * "0 LIKES" would turn a missing measurement into a claim that the account has none.
 */
function AccountFigures({ evidence }: { evidence: CalibrationEvidence }) {
  const figures = [
    { key: "posts", n: evidence.videoCount, label: "Posts" },
    { key: "followers", n: evidence.followerCount, label: "Followers" },
    { key: "likes", n: evidence.heartCount, label: "Likes" },
  ].filter((f) => f.n > 0);

  if (figures.length === 0) return null;

  return (
    // Capped rather than stretched: at a wide card an even 3-column split pushes the figures
    // ~250px apart and they stop reading as one set — "1.4B" ends up floating alone in empty
    // space instead of being the third number of a group. The cap is above the natural width at
    // 390px, so mobile is untouched and only the wide case tightens.
    <div
      className="grid max-w-[440px] gap-3 border-t border-white/[0.06] pt-4"
      style={{ gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))` }}
      data-testid="reveal-figures"
    >
      {figures.map((f) => (
        <div key={f.key} className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-heading font-semibold tabular-nums tracking-[-0.01em] text-foreground">
            {formatCount(f.n)}
          </span>
          <span className="truncate font-mono text-micro uppercase tracking-[0.08em] text-foreground-muted">
            {f.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * One post: its cover, and the views it actually got.
 *
 * Staggered so the grid fills in rather than snapping — the posts really are read in order, and
 * a wall of covers appearing at once reads as a mock-up rather than as work.
 */
function PostCover({
  coverUrl,
  views,
  index,
}: {
  coverUrl: string | null;
  views: number;
  index: number;
}) {
  return (
    <div
      className="reading-reveal relative aspect-[9/16] overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.02]"
      style={{ animationDelay: `${index * 0.06}s` }}
      data-testid="calibration-cover"
    >
      <CoverFill coverUrl={coverUrl} playSize={16} />
      {views > 0 && (
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-micro font-medium tabular-nums text-white/90">
          <svg viewBox="0 0 8 8" className="h-[7px] w-[7px]" fill="currentColor" aria-hidden="true">
            <path d="M1.5 1L7 4L1.5 7Z" />
          </svg>
          {formatCount(views)}
        </span>
      )}
    </div>
  );
}
