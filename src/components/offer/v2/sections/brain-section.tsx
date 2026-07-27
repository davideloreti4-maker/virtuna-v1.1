/**
 * 3.0 — The brain. The attention curve, with a playhead on it, and the networks at the dip.
 *
 * ⚠️ This section deliberately does NOT mount `CortexCanvas`. The cortex is WebGL
 * (`public/brain/cortex.glb`) and does not render headless at all — every screenshot of it is
 * an empty box — so a marketing page that leads with it is a page whose most expensive surface
 * cannot be verified in CI and shows nothing to a visitor whose GPU is blocked. The attention
 * curve carries the same claim (this is a measurement, not an opinion), renders everywhere, and
 * is the surface the room's own read actually cites.
 *
 * ── THE MOTION ────────────────────────────────────────────────────────────────────────────
 * A playhead scrubs the curve, and the four network bars breathe on scaleY. The curve is
 * already the product's own; giving it a moving read-head is the difference between a chart
 * and an instrument. `transform-origin: bottom` on the bars means nothing reflows.
 *
 * ── THE DATA IS THE CLIP'S ────────────────────────────────────────────────────────────────
 * `attentionPoints`, `attentionMoments`, `networks` and `whyThisSecond` are all the real read
 * of the real clip. These became load-bearing the moment the hero probe started visiting the
 * brain page: the inherited fixture used to narrate a different video entirely — a 12-second
 * clip about a "$400 stake" dropping at 0:04 — and nobody had caught it because nothing ever
 * rendered this surface. Two guards now pin it. Do not paraphrase these strings here.
 */

import { MarketingSection, MarketingHeading } from "../marketing-shell";
import { FEATURED_VIDEO } from "@/components/offer/featured-video";
import { ambientLoop } from "../ambient";

const { room } = FEATURED_VIDEO;
const POINTS = room.attentionPoints;

/** The curve as an SVG path across a 0–100 box, y inverted (higher attention = higher line). */
const CURVE = POINTS.map((v, i) => {
  const x = (i / (POINTS.length - 1)) * 100;
  const y = 100 - v;
  return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
}).join(" ");

const AREA = `${CURVE} L100,100 L0,100 Z`;

/**
 * `dip` and `loss` are OPTIONAL flags on the fixture, and the fixture is `as const` — so the
 * union member for a moment without a dip genuinely has no `dip` key and a bare `m.dip` does
 * not typecheck. `in` narrows it, and keeps the "absent means false" reading explicit rather
 * than casting the flag into existence.
 */
const isDip = (m: (typeof room.attentionMoments)[number]) => "dip" in m && m.dip === true;
const isLoss = (n: { loss?: boolean } | Record<string, unknown>) => "loss" in n && n.loss === true;

/** Where the dip sits, as a percentage across the clip — used to place the marker. */
const DIP = room.attentionMoments.find(isDip);
const DIP_X = DIP ? (POINTS.indexOf(DIP.v) / (POINTS.length - 1)) * 100 : null;

export function BrainSection() {
  return (
    <MarketingSection id="the-brain" tone="lifted" seam seamIndex={4}>
      <MarketingHeading
        index="3.0"
        eyebrow="The brain"
        title="The exact second, and why."
        sub={`${room.whyThisSecond.lead}${room.whyThisSecond.loss}.`}
        align="left"
      />

      <div className="mt-10 grid gap-8 md:mt-12 lg:grid-cols-[1.3fr_1fr] lg:gap-10">
        {/* the curve */}
        <div
          className="relative overflow-hidden rounded-[14px] px-5 pb-4 pt-5"
          style={{ border: "1px solid var(--mk-hairline)", background: "#131210" }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#6d6961]">
              Attention
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#ff8080]">
              {room.whyThisSecond.moment}
            </span>
          </div>

          <div className="relative mt-4 h-[190px]">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              <path d={AREA} fill="rgba(236,231,222,0.05)" />
              <path
                d={CURVE}
                fill="none"
                stroke="#ece7de"
                strokeWidth="0.8"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {DIP_X !== null && (
                <line
                  x1={DIP_X}
                  y1="0"
                  x2={DIP_X}
                  y2="100"
                  stroke="#FF6363"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.6"
                />
              )}
            </svg>

            {/* the read-head */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="mk-playhead-scrub absolute inset-y-0 w-px"
                style={{
                  background:
                    "linear-gradient(180deg,transparent,rgba(236,231,222,0.55),transparent)",
                  ["--mk-scrub-distance" as string]: "100%",
                }}
              />
            </div>
          </div>

          <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-[#6d6961]">
            {room.attentionMoments.map((m) => (
              <span key={m.t} style={isDip(m) ? { color: "#ff8080" } : undefined}>
                {m.t}
              </span>
            ))}
          </div>
        </div>

        {/* the networks at that second — σ receipts, translated */}
        <div className="flex flex-col gap-3">
          {room.networks.map((n, i) => (
            <div
              key={n.label}
              className="flex items-center gap-4 rounded-[12px] px-4 py-3"
              style={{
                border: "1px solid var(--mk-hairline)",
                background: isLoss(n) ? "rgba(255,99,99,0.04)" : "var(--mk-s2)",
              }}
            >
              {/* the bar — scaleY only, desynced per network */}
              <span aria-hidden className="flex h-9 w-1.5 items-end">
                <span
                  className="mk-signal-breathe block w-full rounded-full"
                  style={{
                    height: "100%",
                    background: isLoss(n) ? "#FF6363" : "#ece7de",
                    ...ambientLoop(i, { base: 4.4, spread: 3.1 }),
                  }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium text-[#ece7de]">{n.label}</span>
                  <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-[#8a857c]">
                    {n.z > 0 ? "+" : ""}
                    {n.z}σ
                  </span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-[#c2bdb4]">
                  {n.read}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}
