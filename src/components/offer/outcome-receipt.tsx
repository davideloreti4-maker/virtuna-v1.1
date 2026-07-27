"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { NumberTicker } from "@/components/velora/number-ticker";
import { FEATURED_VIDEO } from "./featured-video";

/**
 * OutcomeReceipt — the fold's proof: the same post, twice.
 *
 * Owner call 2026-07-27, third pass: "showcase the thumbnail of the video at 200 vs the
 * thumbnail and the video at 180k views… premium ui design and animation — this card is basic
 * and doesn't capture attention."
 *
 * The two versions before this were a before/after table and then a single transforming
 * counter. Both were *readable* and neither was arresting, because the proof was carried by
 * type while the video — the thing that actually flopped and then went — sat in a thumbnail
 * the size of a stamp. This puts the artefact in the lead: two tiles of the SAME clip, the
 * first drained and small, the second full-colour, larger, lit, with the count climbing on it.
 * You get the story before you read a word.
 *
 * The counts sit ON the tiles, where a video surface puts them, so the tile reads as a post
 * rather than an illustration. The left is desaturated rather than a different frame — same
 * video, which is the whole claim.
 *
 * Accent dosage: one lit spot, the multiple. The bloom behind the winning tile is a soft
 * radial at 0.14, the same family as the hero's own atmosphere layers — not a glow on the
 * element (matte rule).
 */

function PlayGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" fill="currentColor" aria-hidden>
      <path d="M3.5 2.2v7.6a.4.4 0 0 0 .61.34l6-3.8a.4.4 0 0 0 0-.68l-6-3.8a.4.4 0 0 0-.61.34z" />
    </svg>
  );
}

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export function OutcomeReceipt() {
  const { cover, outcome } = FEATURED_VIDEO;
  const { viewsBefore, viewsAfter, credit } = outcome;
  const multiple = Math.round(viewsAfter / viewsBefore);

  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {/* BEFORE — the post as it went out the first time */}
        <motion.figure
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="m-0 shrink-0"
        >
          <div className="relative aspect-[9/16] w-[104px] overflow-hidden rounded-xl opacity-55 ring-1 ring-white/[0.06] grayscale sm:w-[118px]">
            <Image src={cover} alt="" fill sizes="118px" className="object-cover" />
            <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-white/85">
              <PlayGlyph />
              {viewsBefore.toLocaleString("en-US")}
            </span>
          </div>
          <figcaption className="mt-2.5 text-center text-[11px] font-medium uppercase tracking-[0.11em] text-foreground-muted">
            Before
          </figcaption>
        </motion.figure>

        {/* the multiple, on the connector between them */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.35, duration: 0.5, ease: EASE }}
          className="flex shrink-0 flex-col items-center gap-1.5 pb-9 sm:pb-11"
        >
          <span className="inline-flex items-center gap-0.5 rounded-md bg-accent-soft px-2 py-0.5 text-[12px] font-semibold tabular-nums text-accent-text">
            <span aria-hidden>↑</span>
            {multiple}×
          </span>
          <span aria-hidden className="text-[15px] leading-none text-foreground-muted">
            →
          </span>
        </motion.div>

        {/* AFTER — the same clip, recut. Larger, lit, and counting. */}
        <motion.figure
          initial={{ opacity: 0, y: 22, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ delay: 0.5, duration: 0.8, ease: EASE }}
          className="relative m-0 shrink-0"
        >
          {/* composed light behind the winner — blurred radial, never an element glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 opacity-[0.14] blur-[46px]"
            style={{ background: "radial-gradient(circle at 50% 45%, #FF6363, transparent 70%)" }}
          />
          <div className="relative aspect-[9/16] w-[142px] overflow-hidden rounded-xl ring-1 ring-white/[0.14] shadow-[0_28px_56px_-24px_rgba(0,0,0,0.9)] sm:w-[164px]">
            <Image src={cover} alt="A frame from the video this page is about" fill sizes="164px" className="object-cover" priority />
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[13px] font-semibold tabular-nums text-white">
              <PlayGlyph />
              <NumberTicker
                value={viewsAfter}
                startValue={viewsBefore}
                delay={0.7}
                className="tabular-nums text-white"
              />
            </span>
          </div>
          <figcaption className="mt-2.5 text-center text-[11px] font-medium uppercase tracking-[0.11em] text-foreground-secondary">
            After the recut
          </figcaption>
        </motion.figure>
      </div>

      {/* what actually changed — and which surface said so */}
      <p className="mx-auto mt-5 max-w-[46ch] text-center text-[13.5px] leading-relaxed text-foreground-muted">
        {credit}
      </p>
    </div>
  );
}
