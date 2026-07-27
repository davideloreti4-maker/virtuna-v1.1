/**
 * 1.0 — The read. The filmstrip, with a playhead actually moving along it.
 *
 * Everything here is the REAL clip's real data out of `featured-video.ts`: the five beats in
 * cut order, their timestamps, which ones the card marked weak, the 0:12 drop label and the
 * craft score. Nothing is composed for the page. If the owner swaps the footage, this section
 * follows automatically, and the guard test in `offer/__tests__/featured-video.test.ts` fails
 * if the swap leaves a beat or a label inconsistent.
 *
 * ── THE MOTION ────────────────────────────────────────────────────────────────────────────
 * A playhead scrubs the strip on a 9.43s loop, and the two WEAK beats pulse — desynchronised,
 * because they sit in a row and two markers pulsing in lockstep is the single most obviously
 * cheap thing a filmstrip can do. That is Attio's rule (`pipeline-radar-bob` at 3.8s AND
 * 4.15s) applied where it is most visible.
 *
 * The strong beat does NOT pulse. Only the problems move, because the section's claim is that
 * the product finds the problem — and motion that lands everywhere lands nowhere.
 */

import Image from "next/image";
import { MarketingSection, MarketingHeading } from "../marketing-shell";
import { FEATURED_VIDEO } from "@/components/offer/featured-video";
import { ambientLoop } from "../ambient";

const { beats, durationLabel, dropLabel, read } = FEATURED_VIDEO;

const mmss = (ms: number) => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function ReadSection() {
  return (
    <MarketingSection id="the-read" tone="lifted" seam seamIndex={2}>
      <MarketingHeading
        index="1.0"
        eyebrow="The read"
        title="It watches the cut, not the caption."
        sub={`Five beats across ${durationLabel}. The card marks what works, what doesn't, and the second it goes wrong.`}
        align="left"
      />

      <div
        className="mt-14 overflow-hidden rounded-[14px] md:mt-16"
        style={{ border: "1px solid var(--mk-hairline)", background: "#131210" }}
      >
        {/* strip header — craft, runtime, the marked drop */}
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--mk-hairline)" }}
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="mk-live-pulse h-1.5 w-1.5 rounded-full"
              style={{ background: "#8a857c" }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#8a857c]">
              Craft {read.craftScore}
            </span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d6961]">
            {durationLabel}
          </span>
          <span
            className="rounded-md px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em]"
            style={{ background: "rgba(255,99,99,0.1)", color: "#ff8080" }}
          >
            {dropLabel}
          </span>
        </div>

        {/* the strip */}
        <div className="relative px-5 py-6">
          <div className="grid grid-cols-5 gap-2 md:gap-3">
            {beats.map((beat, i) => {
              const weak = beat.mark === "weak";
              return (
                <figure key={beat.label} className="relative min-w-0">
                  <div
                    className="relative aspect-[9/13] overflow-hidden rounded-[8px]"
                    style={{ border: "1px solid var(--mk-hairline)", background: "#0a0a09" }}
                  >
                    <Image
                      src={beat.still}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 20vw, 240px"
                      className="object-cover"
                      style={{ opacity: weak ? 0.55 : 0.9 }}
                    />
                    {weak && (
                      // Desynced per beat — `ambientLoop` gives this marker its own period AND
                      // its own starting phase, so the two weak beats never blink together.
                      <span
                        aria-hidden
                        className="mk-beat-pulse absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                        style={{ background: "#FF6363", ...ambientLoop(i, { base: 3.4, spread: 2.9 }) }}
                      />
                    )}
                  </div>
                  <figcaption className="mt-2 min-w-0">
                    <span className="block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d6961]">
                      {mmss(beat.atMs)}
                    </span>
                    <span
                      className="block truncate text-[12.5px]"
                      style={{ color: weak ? "#ff8080" : "#c2bdb4" }}
                    >
                      {beat.label}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {/* The playhead. Travels the full strip width on a 9.43s cycle — a period that
              shares no factor with either weak-beat pulse, so the three never align. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-5 top-6 h-[calc(100%-3rem)] overflow-hidden"
          >
            <div
              className="mk-playhead-scrub absolute inset-y-0 w-px"
              style={{
                background: "linear-gradient(180deg,transparent,rgba(236,231,222,0.5),transparent)",
                ["--mk-scrub-distance" as string]: "100%",
              }}
            />
          </div>
        </div>

        {/* what the card actually said — real strings from the fixture, not paraphrase */}
        <div
          className="grid gap-px md:grid-cols-2"
          style={{ borderTop: "1px solid var(--mk-hairline)" }}
        >
          <div className="px-5 py-5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#6d6961]">
              Working
            </span>
            <ul className="mt-3 space-y-2">
              {read.working.slice(0, 2).map((line) => (
                <li key={line} className="text-[14px] leading-[1.5] text-[#c2bdb4]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="px-5 py-5" style={{ background: "rgba(255,99,99,0.03)" }}>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#6d6961]">
              Not working
            </span>
            <ul className="mt-3 space-y-2">
              {read.notWorking.slice(0, 2).map((item) => (
                <li key={item.text} className="text-[14px] leading-[1.5] text-[#ece7de]">
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}
