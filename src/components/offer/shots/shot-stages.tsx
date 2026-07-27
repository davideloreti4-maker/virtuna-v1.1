"use client";

/**
 * ShotStages — the dev-only capture stages behind `/_shots`.
 *
 * Each stage is a fixed-size, `data-shot`-tagged box holding ONE shipped app
 * surface at the exact framing the offer page wants. `scripts/capture-offer-shots.ts`
 * takes an element screenshot of each `[data-shot]` at deviceScaleFactor 2 and
 * writes `public/images/offer/<id>.webp`.
 *
 * Rules for adding a stage:
 *  • Mount the REAL component (never a mock) and feed it the same fixtures the
 *    hero uses, so the shots and the live hero can't disagree.
 *  • Size the box to the aspect ratio the section renders, so the section never
 *    letterboxes or crops a second time.
 *  • `offsetY` slides a tall surface inside its box to frame a specific band
 *    (the card is ~1780px tall; the interesting parts are not at the top).
 *    Measure, don't guess — the script logs each surface's real height.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { EmbeddedComposer } from "@/components/app/home/embedded-composer";
import { AmbientDetail } from "@/components/audience-lens/v2/AmbientDetail";
import { CREATOR_TEMPLATE } from "@/components/audience-lens/v2/detail-fixture";
import { VideoTestCardRenderer } from "@/components/thread/video-test-card-block";
import { TEST_CARD_FIXTURE } from "@/components/offer/test-card-fixture";

/**
 * Where the card's "director's fixes" band starts, at the 620px stage width.
 * Measured from the live card via the `measure` stage (the script prints the
 * numbers). Re-measure after a card redesign — the card reflows with width, so
 * this constant is only valid for the 620px stage.
 */
const FIXES_OFFSET_Y = 604;

/** The same landmark at the 390px mobile stage width — measured separately
 *  (the card is 2071px tall there, and the fixes label sits at y=673). */
const FIXES_OFFSET_Y_SM = 650;

/** A tagged, fixed-size capture box. Overflow-hidden so `offsetY` frames a band. */
function Stage({
  id,
  width,
  height,
  offsetY = 0,
  children,
}: {
  id: string;
  width: number;
  height: number;
  offsetY?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground-muted">
        {id} · {width}×{height}
      </p>
      <div
        data-shot={id}
        className="relative overflow-hidden bg-background"
        style={{ width, height }}
      >
        <div className="absolute inset-x-0 top-0" style={{ transform: `translateY(${-offsetY}px)` }}>
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * The composer, mid-intent: the Test verb with a real link already in the field.
 * `compact` drops the outer padding for the phone-width stage (and shortens the
 * seeded URL, which would otherwise wrap to three lines at 390px).
 */
function ComposerStage({ compact = false }: { compact?: boolean }) {
  const [verb, setVerb] = useState<"Make" | "Test" | "Ask">("Test");
  return (
    <div className={compact ? "" : "px-7 py-6"}>
      <EmbeddedComposer
        verb={verb}
        onVerbChange={(v) => setVerb(v as "Make" | "Test" | "Ask")}
        seed={{
          text: compact
            ? "tiktok.com/@creator/video/7460113"
            : "https://www.tiktok.com/@creator/video/7460113355847",
          nonce: 1,
        }}
        onLaunch={() => {}}
      />
    </div>
  );
}

export function ShotStages() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={qc}>
      <div className="flex flex-col items-start gap-12 bg-background p-10">
        <header className="max-w-xl">
          <h1 className="text-lg font-semibold text-foreground">Offer-page capture stages</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground-secondary">
            Dev-only. Run{" "}
            <code className="font-mono text-foreground">
              npx tsx scripts/capture-offer-shots.ts
            </code>{" "}
            to photograph every stage into <code className="font-mono">public/images/offer/</code>.
          </p>
        </header>

        {/* Stage widths are deliberately CLOSE to the widths the sections render
            them at (~620px media column, ~520px split column). Capturing a 900px
            surface and downscaling it to a 320px card is what makes product
            screenshots illegible; DPR 2 supplies the retina density instead. */}

        {/* 01 — paste: the real composer atom, Test verb, link in the field */}
        <Stage id="step-paste" width={760} height={216}>
          <ComposerStage />
        </Stage>

        {/* 02 — react: the shipped v2 read, audience tab (owner correction
            2026-07-26: the LEGACY AmbientRoom is a surface the platform no
            longer shows — photograph the CURRENT drilled read instead). Same
            fixture the hero window's rail renders, so the two agree to the
            digit. Bounded flex host per the AmbientPanel pattern; sheet
            presentation so the host owns ground + cap (no stray rail hairline
            in a standalone shot). */}
        <Stage id="step-react" width={620} height={724}>
          <div className="flex h-[724px] flex-col overflow-hidden bg-[#181817]">
            <AmbientDetail
              template={CREATOR_TEMPLATE}
              presentation="sheet"
              initialTab="audience"
            />
          </div>
        </Stage>

        {/* 03 — verdict: the card's head — craft ring, drivers, the filmstrip */}
        <Stage id="step-verdict" width={760} height={462}>
          <div className="w-[760px] px-3 pt-3">
            <VideoTestCardRenderer block={TEST_CARD_FIXTURE} />
          </div>
        </Stage>

        {/* 04 — the fixes band: the payoff the hero's 600px cut hides. offsetY is
            measured, not guessed — see the `measure` stage below. */}
        <Stage id="verdict-fixes" width={620} height={775} offsetY={FIXES_OFFSET_Y}>
          <div className="w-[620px] px-3 pt-3">
            <VideoTestCardRenderer block={TEST_CARD_FIXTURE} />
          </div>
        </Stage>

        {/* ── Mobile variants ──────────────────────────────────────────────
            Art direction, not a resize. The desktop shots downscaled into a
            ~350px phone column render app UI at ~7px — unreadable, which turns
            the whole "these are real product pixels" argument into decoration on
            the traffic that matters most. These are captured at phone width so
            they display near 1:1. `ProductShot` picks between them with a
            <picture> media query, so exactly one file is ever downloaded. */}

        <Stage id="step-paste-sm" width={390} height={200}>
          <div className="px-4 py-4">
            <ComposerStage compact />
          </div>
        </Stage>

        <Stage id="step-react-sm" width={390} height={620}>
          <div className="flex h-[620px] flex-col overflow-hidden bg-[#181817]">
            <AmbientDetail
              template={CREATOR_TEMPLATE}
              presentation="sheet"
              initialTab="audience"
            />
          </div>
        </Stage>

        <Stage id="step-verdict-sm" width={390} height={472}>
          <div className="w-[390px] px-2 pt-2">
            <VideoTestCardRenderer block={TEST_CARD_FIXTURE} />
          </div>
        </Stage>

        <Stage id="verdict-fixes-sm" width={390} height={560} offsetY={FIXES_OFFSET_Y_SM}>
          <div className="w-[390px] px-2 pt-2">
            <VideoTestCardRenderer block={TEST_CARD_FIXTURE} />
          </div>
        </Stage>

        {/* Measuring aids — the card at each fixes-stage width, natural height,
            so the FIXES_OFFSET_Y constants come from real geometry. The card
            reflows with width, so a measure MUST match its stage's width. */}
        <section className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground-muted">
            measure · card at 620px, natural height
          </p>
          <div data-measure="card" className="w-[620px] px-3 pt-3">
            <VideoTestCardRenderer block={TEST_CARD_FIXTURE} />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground-muted">
            measure · card at 390px, natural height
          </p>
          <div data-measure="card-sm" className="w-[390px] px-2 pt-2">
            <VideoTestCardRenderer block={TEST_CARD_FIXTURE} />
          </div>
        </section>
      </div>
    </QueryClientProvider>
  );
}
