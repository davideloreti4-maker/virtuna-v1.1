"use client";

/**
 * The hero shot — the product, framed on desktop, bled on a phone.
 *
 * ── A MEASUREMENT ERROR, AND ITS CORRECTION ───────────────────────────────────────────────
 * The first pass shipped this as a bald full-bleed rectangle with no radius, no border and no
 * shadow, on every viewport. That came from over-generalising one number: on a 390x844 phone
 * both Linear's and Cursor's hero `<img>` genuinely report `border-radius: 0px` and
 * `border-width: 0px`, because on a phone the shot runs edge to edge. That is TRUE, and it is
 * true only on mobile.
 *
 * On DESKTOP both references frame it, and looking at the captures side by side is unambiguous:
 *
 *   Linear   rounded top corners + a hairline border, inset from the page edges, sitting in a
 *            soft vignette — no browser chrome (no traffic lights, no URL bar)
 *   Attio    an actual macOS window: traffic lights, ~10px radius, a real drop shadow, floated
 *            on a pale gradient
 *
 * So the owner's call this session — "kill the chrome, keep the label as a caption" — was
 * right and is kept: no traffic lights, no fake URL bar. What was wrong was throwing away the
 * FRAME along with the chrome. A radius, a hairline and a deep shadow are not chrome; they are
 * what stops a dark product surface from dissolving into a dark page. Without them the shot had
 * no edge at all, and the fold read as a text block sitting on top of a grey slab.
 *
 * Mobile keeps the bleed, because that is what the references actually do there.
 *
 * ── THE HONESTY LABEL ─────────────────────────────────────────────────────────────────────
 * "Sample read" is a §8 requirement — the read IS a fixture and a visitor is entitled to know.
 * It rides as a caption chip on the surface. Not decoration; never removed to tidy up.
 *
 * ── MOTION ────────────────────────────────────────────────────────────────────────────────
 * `armOnMount` is on because this surface IS the fold. The intersection guard carries a −25%
 * bottom margin and the shot's top measures at ~70% of a 900px viewport — inside that dead
 * band — so it sat blank until the visitor scrolled. Measured, not assumed: at 1s, 3s and 7s
 * after load the thread was still empty before this changed.
 *
 * `loop` is on. The choreography used to finish at 6.3s and freeze for the rest of the visit,
 * which is the core diagnosis of this rebuild. It now replays every 28s.
 */

import { HeroProductWindow } from "@/components/offer/hero-product-window";

export function HeroShot() {
  return (
    <div data-hero-shot className="relative w-full">
      {/* Full-bleed on a phone (Linear: 100vw), 90vw on desktop (Linear: 91vw). */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 md:w-[90vw]">
        {/*
          THE FRAME. Radius + hairline + a deep, low drop shadow — matte, non-zero Y, never a
          glow. The shadow is what lifts the surface off the floor; the hairline is what gives
          it an edge against a near-black page. Square on a phone, framed from md up.
        */}
        <div
          className="relative overflow-hidden md:rounded-t-[14px]"
          style={{
            boxShadow: "0 -1px 0 0 var(--mk-hairline-strong), 0 40px 90px -30px rgba(0,0,0,0.9)",
            maskImage: "linear-gradient(180deg,#000 88%,transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg,#000 88%,transparent 100%)",
          }}
        >
          {/* A hairline drawn INSIDE the mask, so the top edge reads crisp while the bottom
              still dissolves. A plain `border` would be clipped by the same mask and vanish. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px"
            style={{ background: "var(--mk-hairline-strong)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-px md:block"
            style={{ background: "var(--mk-hairline)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-px md:block"
            style={{ background: "var(--mk-hairline)" }}
          />

          <HeroProductWindow chrome={false} loop bloom={false} armOnMount />
        </div>

        {/* The disclosure. LEFT on a phone, right on desktop: the thread's user turns are
            right-aligned and at 390px the chip landed on top of "test this video for me". */}
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
