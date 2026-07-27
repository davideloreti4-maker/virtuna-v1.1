"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { NumberTicker } from "@/components/velora/number-ticker";
import { FEATURED_VIDEO } from "./featured-video";

/**
 * OutcomeReceipt — the fold's proof, as one artifact.
 *
 * Owner call 2026-07-27: show the receipt concretely — "the thumbnail and the views how they
 * evolve" — and then, on the redesign: "we want a premium hero ui design and animation".
 *
 * The first pass was a two-row before/after table with proportional bars. It read as an
 * infographic, and it fought its own best fact: this is ONE post, recut and reposted, so a
 * table of two rows implies two videos. The premium form of the same truth is a single counter
 * that TRANSFORMS — the post sits there, the number climbs from what it did to what it did
 * after, and the multiple lands last. Nothing loops; the motion resolves and stays resolved.
 *
 * A visitor arriving after the animation still gets the contrast, because the "was 231" line
 * persists underneath rather than being carried only by the motion.
 *
 * Accent dosage: the big number is CREAM, not coral. The only accent is the multiple's chip —
 * one small lit spot, which is what the liveness-only rule reserves it for.
 */
export function OutcomeReceipt() {
  const { cover, durationLabel, outcome } = FEATURED_VIDEO;
  const { viewsBefore, viewsAfter, credit } = outcome;

  const multiple = Math.round(viewsAfter / viewsBefore);

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <motion.div
        initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "0px 0px -12% 0px" }}
        transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="flex items-center gap-5 rounded-2xl border border-border bg-surface-sunken p-5 shadow-[0_32px_64px_-40px_rgba(0,0,0,0.9)] sm:gap-7 sm:p-6"
      >
        {/* the post — one cover, because it is one post */}
        <div className="relative aspect-[9/16] w-[100px] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/[0.08] sm:w-[116px]">
          <Image
            src={cover}
            alt="A frame from the video this page is about"
            fill
            sizes="116px"
            className="object-cover"
            priority
          />
          {/* runtime, where a video surface puts it */}
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/85">
            {durationLabel}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-foreground-muted">
            The same video, recut
          </div>

          {/* the counter that transforms — starts at what the post actually did */}
          <div className="mt-1.5 flex items-baseline gap-2">
            <NumberTicker
              value={viewsAfter}
              startValue={viewsBefore}
              delay={0.45}
              className="text-[38px] font-medium leading-none tabular-nums tracking-[-0.02em] text-foreground sm:text-[50px]"
            />
            <span className="text-[13px] text-foreground-muted">views</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {/* the multiple lands last — the one lit spot on the card */}
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.5, duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-[12px] font-semibold tabular-nums text-accent-text"
            >
              <span aria-hidden>↑</span>
              {multiple}×
            </motion.span>
            <span className="text-[13px] text-foreground-muted">
              was {viewsBefore.toLocaleString("en-US")} before the recut
            </span>
          </div>
        </div>
      </motion.div>

      {/* what actually changed — and which surface said so */}
      <p className="mx-auto mt-4 max-w-[46ch] text-center text-[13.5px] leading-relaxed text-foreground-muted">
        {credit}
      </p>
    </div>
  );
}
