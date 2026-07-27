"use client";

/**
 * The hero shot — the product, bled, unframed.
 *
 * ── WHAT WAS MEASURED ─────────────────────────────────────────────────────────────────────
 * 2026-07-27, off the live references:
 *
 *   desktop 1440x900   Linear hero shot ≈ 91% viewport width · /go today ≈ 69%
 *   mobile  390x844    Linear <img> 100vw, border-radius 0px, border-width 0px, top at 61% vh
 *                      Cursor <img>  90vw, border-radius 0px, border-width 0px, top at 40% vh
 *
 * Both references show the shot as a full-bleed image with NO radius and NO border, on BOTH
 * viewports. /go frames it as a browser window — traffic lights, a fake URL bar, a rounded
 * border and a drop shadow — which is the shape of *a screenshot of a product*. Removing the
 * frame is what makes it read as *the product*. That is the entire move here, and it is why
 * `HeroProductWindow` gained a `chrome` prop rather than this file drawing a new surface: the
 * five previously-rejected hero concepts were all abstractions of the product, and the thing
 * that finally worked was the shipped components on the shipped fixtures.
 *
 * ── THE HONESTY LABEL ─────────────────────────────────────────────────────────────────────
 * Killing the chrome kills the "Sample read" tag that lived in it. That tag is a §8
 * requirement — the read IS a fixture and a visitor is entitled to know — so it comes back as
 * a caption chip on the surface. It is not decoration and must not be removed to tidy the
 * composition. Owner call, this session: kill the chrome, keep the label.
 *
 * ── MOTION ────────────────────────────────────────────────────────────────────────────────
 * `armOnMount` is on because this surface IS the fold. The intersection guard carries a −25%
 * bottom margin, and the shot's top measures at ~70% of a 900px viewport — inside that dead
 * band — so it would have sat blank until the visitor scrolled, on the one surface that has to
 * be alive on arrival. Measured, not assumed: at 1s, 3s and 7s after load the thread was still
 * empty before this changed.
 *
 * `loop` is on. The choreography used to finish at 6.3s and freeze for the rest of the visit,
 * which is the core diagnosis of this whole rebuild. It now replays every 28s, so the fold is
 * alive at 0:30 as well as at 0:03. The caption's live dot breathes continuously on top of
 * that, so the surface is never fully at rest even between passes.
 */

import { HeroProductWindow } from "@/components/offer/hero-product-window";

export function HeroShot() {
  return (
    <div data-hero-shot className="relative w-full">
      {/* Full-bleed on a phone (Linear: 100vw), 90vw on desktop (Linear: 91vw). `left-1/2 /
          -translate-x-1/2 / w-screen` escapes the 1400 content column without the parent
          needing to know it is being escaped. */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 md:w-[90vw]">
        {/* The shot bleeds past the fold rather than ending at it — Linear's shot top sits at
            61% of the phone viewport and simply continues off-screen. The bottom mask is what
            turns "cut off by the viewport" into "continues below", which is the difference
            between an open loop and a rendering fault. */}
        <div
          style={{
            maskImage: "linear-gradient(180deg,#000 88%,transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg,#000 88%,transparent 100%)",
          }}
        >
          <HeroProductWindow chrome={false} loop bloom={false} armOnMount />
        </div>

        {/* The disclosure. Muted, small, and permanently present — see the header. */}
        {/* LEFT on a phone, right on desktop. The thread's user turns are right-aligned and at
            390px the chip landed on top of "test this video for me"; the thread's top-left is
            empty at every phase, so that corner is the safe one. */}
        <div className="pointer-events-none absolute left-4 top-3 z-20 md:left-auto md:right-6 md:top-4">
          <span
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#8a857c]"
            style={{
              border: "1px solid var(--mk-hairline)",
              background: "rgba(13,13,12,0.72)",
              backdropFilter: "blur(6px)",
            }}
          >
            <span
              aria-hidden
              className="mk-live-pulse h-1.5 w-1.5 rounded-full"
              style={{ background: "#8a857c" }}
            />
            Sample read
          </span>
        </div>
      </div>
    </div>
  );
}
