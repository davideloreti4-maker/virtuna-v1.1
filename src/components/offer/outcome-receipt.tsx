import Image from "next/image";
import { NumberTicker } from "@/components/velora/number-ticker";
import { FEATURED_VIDEO } from "./featured-video";

/**
 * OutcomeReceipt — the fold's whole argument, as one artifact.
 *
 * Owner call 2026-07-27: the hero sells the OUTCOME, and the receipt is shown concretely —
 * "show the thumbnail and the views how they evolve" — not as a floating statistic. Because
 * this is the SAME video recut and reposted, one cover with a counter climbing from 231 to
 * 183,000 is literally what happened to that post; two thumbnails would imply two videos.
 *
 * The bars are proportional with a visible floor: 231/183,000 is 0.13%, which renders as
 * nothing, so the "before" bar is pinned to a hairline. The printed numbers carry the precision
 * — the bars only carry the shape of the gap, which is the point a visitor takes in one glance.
 *
 * The counter is a `NumberTicker` starting at the BEFORE value, so it climbs the real distance
 * when it enters view (and jumps straight to the end under reduced motion).
 *
 * Anonymous by owner call — no handle, no niche. The clip itself is placeholder footage and is
 * being replaced; everything here reads from `FEATURED_VIDEO`, so the swap is one edit.
 */
export function OutcomeReceipt() {
  const { cover, outcome } = FEATURED_VIDEO;
  const { viewsBefore, viewsAfter, credit } = outcome;

  // Hairline floor so the baseline is legible rather than mathematically invisible.
  const beforeWidth = Math.max((viewsBefore / viewsAfter) * 100, 1.5);

  return (
    <div className="mx-auto w-full max-w-[540px]">
      <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface-sunken p-4 sm:gap-6 sm:p-5">
        {/* the post itself — one cover, because it is one post */}
        <div className="relative aspect-[9/16] w-[86px] shrink-0 overflow-hidden rounded-xl border border-border sm:w-[104px]">
          <Image
            src={cover}
            alt="A frame from the video this page is about"
            fill
            sizes="104px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* before */}
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-foreground-muted">
              Before
            </div>
            <div className="mt-1 text-[15px] tabular-nums text-foreground-secondary">
              {viewsBefore.toLocaleString("en-US")} views
            </div>
            <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-foreground-muted"
                style={{ width: `${beforeWidth}%` }}
              />
            </div>
          </div>

          {/* after — the same post, recut */}
          <div className="mt-5">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-foreground-muted">
              After the recut
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <NumberTicker
                value={viewsAfter}
                startValue={viewsBefore}
                delay={0.25}
                className="text-[30px] font-medium leading-none tabular-nums tracking-tight text-accent-text sm:text-[36px]"
              />
              <span className="text-[13px] text-foreground-muted">views</span>
            </div>
            <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-full rounded-full bg-accent" />
            </div>
          </div>
        </div>
      </div>

      {/* what actually changed — and which surface said so */}
      <p className="mx-auto mt-4 max-w-[44ch] text-center text-[13.5px] leading-relaxed text-foreground-muted">
        {credit}
      </p>
    </div>
  );
}
