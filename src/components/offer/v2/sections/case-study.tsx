/**
 * The case study — the number as the headline (Attio's grammar for exactly this beat).
 *
 * ── WHY THIS IS NOT IN THE FOLD ANY MORE ──────────────────────────────────────────────────
 * The two-tile receipt used to open the page. An anonymous, unverifiable number cannot carry a
 * cold fold: a visitor who has not yet seen the machine work has no reason to believe 183,000,
 * and a claim nobody believes costs more than it earns. Placed HERE — after 1.0, 2.0 and 3.0
 * have each shown the product doing the thing — the same number corroborates instead of
 * asserting. Moving it is also what buys the fold its 300px of air.
 *
 * ── HONESTY ───────────────────────────────────────────────────────────────────────────────
 * 231 → 183,000 is real and owner-supplied: the same video, recut and reposted. It is
 * deliberately ANONYMOUS (owner call — no creator handle), which is precisely the weakness
 * this section still carries: unattributed it is a better-positioned unverifiable claim, not a
 * verified one. That is why the attribution placeholder is rendered rather than quietly
 * omitted — the section is visibly not finished, and it should stay visibly not finished until
 * the creator's consent arrives.
 *
 * ⚠️ Do NOT invent a handle, a name, a niche or a follower count to "complete" it.
 *
 * Motion: a token travels the connector from the drained tile to the lit one on a 6.11s loop —
 * the section's entire claim, expressed as movement rather than as an arrow glyph. The counts
 * themselves land once (`CountUp`) and then hold; a number that re-counts forever reads as a
 * slot machine, and this one has to read as a receipt.
 */

import Image from "next/image";
import { MarketingSection } from "../marketing-shell";
import { FEATURED_VIDEO } from "@/components/offer/featured-video";
import { CountUp } from "@/components/offer/motion/reveal";
import { PlaceholderBox } from "../placeholder-slot";
import { CASE_STUDY_QUOTE_SLOT } from "../placeholders";

const { outcome, cover } = FEATURED_VIDEO;

function Tile({ lit, views }: { lit: boolean; views: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3">
      <div
        className="relative aspect-[9/13] w-full overflow-hidden rounded-[10px]"
        style={{
          border: "1px solid var(--mk-hairline)",
          background: "#0a0a09",
          width: lit ? "100%" : "82%",
        }}
      >
        <Image
          src={cover}
          alt=""
          fill
          sizes="(max-width: 768px) 40vw, 260px"
          className="object-cover"
          style={lit ? undefined : { filter: "grayscale(1)", opacity: 0.45 }}
        />
        {/* the count sits ON the tile, where a video surface puts it */}
        <span
          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-2 text-[13px] font-medium tabular-nums"
          style={{
            background: "linear-gradient(180deg,transparent,rgba(10,10,9,0.92))",
            color: lit ? "#ece7de" : "#8a857c",
          }}
        >
          <span aria-hidden>▶</span>
          {lit ? <CountUp value={views} /> : views.toLocaleString("en-US")}
        </span>
      </div>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#6d6961]">
        {lit ? "recut" : "original"}
      </span>
    </div>
  );
}

export function CaseStudy() {
  return (
    <MarketingSection seam seamIndex={6}>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        {/* the number, as the headline */}
        <div>
          <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#6d6961]">
            One video, recut
          </span>
          <p
            className="mt-5 text-[clamp(2.6rem,5.4vw,4rem)] font-medium leading-[1.02] tabular-nums text-[#ece7de]"
            style={{ letterSpacing: "-0.022em" }}
          >
            {outcome.viewsBefore.toLocaleString("en-US")} views.
            <br />
            Then {outcome.viewsAfter.toLocaleString("en-US")}.
          </p>
          <p className="mt-6 max-w-[46ch] text-[16px] leading-[1.55] text-[#c2bdb4]">
            {outcome.fix} {outcome.credit}
          </p>

          {/* Rendered, not omitted: the section is not finished until this is a real quote. */}
          <div className="mt-8 max-w-[420px]">
            <PlaceholderBox slot={CASE_STUDY_QUOTE_SLOT} index={3} shape="line" />
          </div>
        </div>

        {/* the two tiles, and the connector that actually moves */}
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex min-w-0 flex-1 justify-end">
            <div className="w-full max-w-[190px]">
              <Tile lit={false} views={outcome.viewsBefore} />
            </div>
          </div>

          <div aria-hidden className="relative h-px w-12 shrink-0 self-center md:w-20">
            <div className="absolute inset-0" style={{ background: "var(--mk-hairline-strong)" }} />
            <div className="absolute inset-0 overflow-hidden">
              <span
                className="mk-count-flow absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full"
                style={{
                  background: "#ece7de",
                  ["--mk-flow-distance" as string]: "5rem",
                }}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1">
            <div className="w-full max-w-[230px]">
              <Tile lit views={outcome.viewsAfter} />
            </div>
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}
