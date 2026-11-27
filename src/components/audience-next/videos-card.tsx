"use client";

import { useCallback, useId, useState } from "react";

import { Card } from "@/components/ui/card";
import type { AudiencePage, ReadVideo, Whose } from "@/lib/audience-next/audience-model";
import { postsAbout, viewsLabel } from "@/lib/audience-next/audience-words";
import { cn } from "@/lib/utils";

/**
 * The videos Maven read (spec 3.2.8): "Your videos Maven read" ("Their …"), with no count beside it (the
 * archive can hold more than one read's posts, so its number would disagree with the source line); the
 * three most viewed as rows: the caption's first line (two lines at most), at the right the views and
 * under them the multiple of the usual in its tone; under the rows what the account posts about, as chips
 * with a count each (words, not buttons; a long topic is cut on its chip, never its row).
 *
 * The multiple's colour says only "against the usual": green above it, coral below, none around it
 * (After posting's rule, `toneOf`).
 *
 * Each row leads with the video's cover, 9:16 (our stored copy). No cover, or one that cannot be drawn: a
 * blank tile of the same size, so the captions stay aligned.
 */

const TONE: Record<NonNullable<ReadVideo["times"]>["tone"], string> = {
  above: "text-above",
  below: "text-below-text",
  around: "text-foreground-secondary",
};

/** A video's cover: decorative (the caption beside it is the name); a blank tile when it cannot be drawn. */
function Thumb({ src }: { src: string | null }) {
  // The address that failed; a new address is tried again.
  const [failed, setFailed] = useState<string | null>(null);
  // An image that failed before the page woke up fired its error before React listened for it.
  const failedEarly = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(img.getAttribute("src"));
  }, []);
  const shown = src && src !== failed ? src : null;
  return (
    <span data-thumb="" aria-hidden className="relative h-[58px] w-[44px] shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element -- a stored cover per row, not a static asset
        <img
          key={shown}
          ref={failedEarly}
          src={shown}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(shown)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}

export function VideosCard({ videos, whose }: { videos: NonNullable<AudiencePage["videos"]>; whose: Whose }) {
  const headingId = useId();
  return (
    <Card className="px-4 pb-4 pt-1">
      <section aria-labelledby={headingId}>
        <div className="pb-1 pt-3">
          <h2 id={headingId} className="text-title font-[650] text-foreground">
            {videos.heading}
          </h2>
        </div>
        <ul className="divide-y divide-border">
          {videos.rows.map((row) => (
            <li key={row.key} data-video="" className="flex items-start gap-3 py-3">
              <Thumb src={row.cover} />
              <p className="line-clamp-2 min-w-0 flex-1 break-words text-ui font-[600] leading-5 text-foreground">{row.text}</p>
              <div className="shrink-0 text-right">
                <span aria-hidden className="block text-ui font-bold leading-5 text-foreground tabular-nums">
                  {row.views}
                </span>
                <span className="sr-only">{viewsLabel(row.views)}</span>
                {row.times && (
                  <span data-times="" className={cn("block text-meta font-[600] tabular-nums", TONE[row.times.tone])}>
                    {row.times.words}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
        {videos.topics.length > 0 && (
          <ul aria-label={postsAbout(whose)} className="flex flex-wrap gap-2 pt-1">
            {videos.topics.map((topic, i) => (
              // By place as well: two topics can be named alike.
              <li key={`${i}:${topic}`} className="inline-flex h-8 min-w-0 max-w-full items-center rounded-lg bg-surface-sunken px-3 text-meta font-[560] text-foreground">
                <span className="truncate">{topic}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
