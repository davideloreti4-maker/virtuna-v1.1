"use client";

/**
 * TeardownDetailDialog — one teardown, opened from anywhere in the Discover hub.
 *
 * This is the depth the corpus already held and no surface rendered. Every extracted row
 * carries a `why_it_works` analysis (p50 578 characters), a `hook_template` separate from
 * the `spoken_hook`, and a three-part taxonomy — and until this dialog the hub showed the
 * spoken line on a card, the template on a collection row, and the analysis nowhere at all.
 *
 * It is also the fix for the surface's one unreachable action. Remix lived only on an
 * `opacity-0 → group-hover:opacity-100` overlay, so on a touch device it could not be seen —
 * while still occupying its slot and taking the tap, which meant a thumb landing on the
 * lower third of a card fired a remix it never saw and got dropped on /home. The card now
 * OPENS this, and Remix is a plain always-visible button inside it. One path, every input.
 *
 * Two-phase by design: it opens instantly with everything the card already had in memory
 * (cover, hook, receipt, handle, views, age) and fills in the analysis + taxonomy from a
 * per-id read. Those fields are deliberately not in the page payload — see
 * `app/actions/discover/teardown.ts` for the measurement behind that split.
 */

import { useEffect, useState } from "react";
import { ArrowRight, ArrowSquareOut, X } from "@phosphor-icons/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverFill } from "@/components/primitives/CoverFill";
import { getTeardownDetail, type TeardownDetail } from "@/app/actions/discover/teardown";
import { cn } from "@/lib/utils";
import type { CorpusVideo } from "@/lib/discover/corpus-reads";
import { useRemixLaunch } from "./use-remix-launch";
import { Chip, Kicker, MultiplierChip, fmtAge, fmtViews } from "./discover-primitives";

/** `full-screen-hybrid` → `Full screen hybrid`. Sentence case, not title case: these are
 *  slugs with connectives in them (`a-vs-b-comparison`), and Title Casing Every Word reads
 *  like a headline for what is really a tag. */
function humanizeSlug(slug: string | null): string | null {
  if (!slug) return null;
  const words = slug.replace(/[-_]/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

/** The cover slot — a link to the original when we have a URL, an inert tile when we don't. */
function Cover({
  video,
  className,
  playSize = 26,
  showWatchOverlay = false,
}: {
  video: CorpusVideo;
  className?: string;
  playSize?: number;
  showWatchOverlay?: boolean;
}) {
  return (
    <a
      {...(video.videoUrl
        ? {
            href: video.videoUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            // Its only content is a decorative cover, so without this the link has no
            // accessible name and a screen reader announces a bare URL (axe: link-name).
            // The hover overlay does not count — it is absent on the mobile thumbnail, and
            // naming a link by text that only appears on hover is not a name.
            "aria-label": `Watch the original${video.handle ? ` by @${video.handle}` : ""} on TikTok`,
          }
        : {})}
      className={cn(
        "group relative block overflow-hidden rounded-xl border border-border bg-surface-sunken",
        className,
      )}
    >
      <CoverFill coverUrl={video.coverUrl} playSize={playSize} />
      {showWatchOverlay && video.videoUrl ? (
        <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-lg bg-black/70 py-1.5 text-label font-medium text-white/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Watch original <ArrowSquareOut size={13} weight="bold" />
        </span>
      ) : null}
    </a>
  );
}

export function TeardownDetailDialog({
  video,
  onClose,
}: {
  /** The open teardown, or null when the dialog is closed. */
  video: CorpusVideo | null;
  onClose: () => void;
}) {
  const { remix, pendingId } = useRemixLaunch();
  const [detail, setDetail] = useState<TeardownDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const id = video?.id ?? null;

  useEffect(() => {
    if (!id) return;
    // A second open of a different card must not paint the first one's analysis under the
    // new hook, so the state resets here and a stale in-flight response is dropped.
    let live = true;
    setDetail(null);
    setDetailError(null);
    void getTeardownDetail(id).then((res) => {
      if (!live) return;
      if (res.detail) setDetail(res.detail);
      else setDetailError(res.error ?? "Couldn't load the teardown just now.");
    });
    return () => {
      live = false;
    };
  }, [id]);

  if (!video) return null;

  const hook = video.spokenHook || video.template || "Untitled teardown";
  const age = fmtAge(video.postedAt);
  const taxonomy = [
    humanizeSlug(detail?.format ?? null),
    humanizeSlug(detail?.visualHook ?? null),
    humanizeSlug(detail?.editingStyle ?? null),
  ].filter((t): t is string => Boolean(t));

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        // The shared DialogContent defaults to a 448px near-black panel with the retired
        // inset shine. This one is a reading pane: wide enough for a cover beside ~600
        // characters of prose, and repainted onto flat-warm charcoal, matte.
        className="max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-[860px] overflow-hidden p-0"
        style={{
          backgroundColor: "var(--color-surface-elevated)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
        }}
      >
        {/* Radix closes on Escape and on the overlay, but neither is discoverable — and the
            surface this opens from is a touch grid, where there is no Escape key. */}
        <DialogClose
          aria-label="Close teardown"
          className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/40 text-foreground-secondary transition-colors hover:bg-black/60 hover:text-foreground"
        >
          <X size={15} weight="bold" />
        </DialogClose>

        <div className="flex max-h-[88vh] flex-col overflow-hidden sm:flex-row">
          {/* Cover, at two sizes on purpose. On a phone it is IDENTIFICATION, not content: at
              the desktop column's proportions it ran 437px of a 664px viewport and pushed the
              analysis — the reason the dialog exists — below the fold. So it shrinks to a
              thumbnail beside the title there, and keeps the full column from `sm` up. */}
          <div className="hidden shrink-0 p-4 pr-0 sm:block sm:w-[264px]">
            <Cover video={video} className="aspect-[3/4] w-full" showWatchOverlay />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:block">
              <Cover
                video={video}
                className="aspect-[3/4] w-[84px] shrink-0 sm:hidden"
                playSize={16}
              />
              {/* pr-9 clears the absolutely-positioned close button — without it the kicker
                  truncates INTO the X on a phone, where the dialog is only 366px wide. */}
              <div className="min-w-0 flex-1 pr-9">
                {/* Kicker is an inline span, and `truncate` on an inline element does not
                    clip — it needs a block box to overflow against, or it runs on under the
                    close button at phone width. */}
                <div className="truncate">
                  <Kicker>
                    {[humanizeSlug(video.archetype), humanizeSlug(video.niche)]
                      .filter(Boolean)
                      .join(" · ") || "Teardown"}
                  </Kicker>
                </div>

                <DialogTitle className="mt-1.5 text-subhead font-semibold leading-snug text-foreground">
                  {hook}
                </DialogTitle>
              </div>
            </div>

            <DialogDescription className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-caption text-foreground-muted">
              <MultiplierChip video={video} />
              <span>@{video.handle ?? "unknown"}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{fmtViews(video.views)} views</span>
              {age ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{age}</span>
                </>
              ) : null}
            </DialogDescription>

            <section className="mt-4">
              <h3 className="text-micro font-semibold uppercase tracking-[0.09em] text-foreground-muted">
                Why it works
              </h3>
              {detail ? (
                detail.whyItWorks ? (
                  <p className="mt-1.5 whitespace-pre-line text-body leading-relaxed text-foreground-secondary">
                    {detail.whyItWorks}
                  </p>
                ) : (
                  // The corpus has one on all 524 rows today, but an ingest that skipped the
                  // analysis step must read as absent, never as a blank paragraph.
                  <p className="mt-1.5 text-body text-foreground-muted">
                    No analysis recorded for this one.
                  </p>
                )
              ) : detailError ? (
                <p className="mt-1.5 text-body text-foreground-muted">{detailError}</p>
              ) : (
                <div className="mt-2 space-y-2" aria-hidden="true">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-[82%]" />
                </div>
              )}
            </section>

            {video.template ? (
              <section className="mt-4">
                <h3 className="text-micro font-semibold uppercase tracking-[0.09em] text-foreground-muted">
                  The reusable template
                </h3>
                {/* The pattern, not the line this creator said — the card shows the spoken
                    hook, and the two are separate columns in the corpus for exactly this. */}
                <p className="mt-1.5 rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-body leading-relaxed text-foreground">
                  {video.template}
                </p>
              </section>
            ) : null}

            {taxonomy.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {taxonomy.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            ) : null}

            {/* The action, plainly. No hover to discover it, no pointer required. */}
            <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void remix(video.id, video.videoUrl)}
                disabled={pendingId === video.id || !video.videoUrl}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-action)] px-4 py-2.5 text-label font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex-none"
              >
                {pendingId === video.id ? "Starting…" : "Remix → Read"}
                {pendingId === video.id ? null : <ArrowRight size={13} weight="bold" />}
              </button>
              {video.videoUrl ? (
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2.5 text-label font-medium text-foreground-secondary transition-colors hover:border-border-hover hover:text-foreground"
                >
                  Watch original <ArrowSquareOut size={13} />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
