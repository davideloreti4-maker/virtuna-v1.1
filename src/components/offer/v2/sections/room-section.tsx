/**
 * 2.0 — The room. The constellation, breathing.
 *
 * This is the section that carries most of the page's ambient motion, and it is the right one
 * to carry it: the claim is "a room of viewers reacts", and a still field of dots asserts that
 * where a drifting one demonstrates it.
 *
 * ── EVERY NODE ON ITS OWN CLOCK ───────────────────────────────────────────────────────────
 * 34 nodes, each with a period from `ambientLoop` (6.4–11.7s) and a starting phase from a
 * second irrational, so no two are ever in step and the field never sweeps. Amplitude is
 * 1.2–3px — a breathe, never a shuffle. The shipped `AudienceTerrain` reached the same
 * conclusion independently and drives its nodes with seeded SVG SMIL; this is the CSS
 * equivalent, chosen because SMIL is invisible to `getComputedStyle().animationName` and would
 * therefore be motion the acceptance test cannot see.
 *
 * ── THE NUMBERS ARE REAL ──────────────────────────────────────────────────────────────────
 * Stop rate, the tri-state split and the three coded reasons (with their counts, quotes and
 * speakers) all come from `featured-video.ts` — the same room read the hero shot's rail
 * renders, so the two agree to the digit. `reasons` are the room's own; no viewer count
 * appears in any heading, per §8.
 */

import { MarketingSection, MarketingHeading } from "../marketing-shell";
import { FEATURED_VIDEO } from "@/components/offer/featured-video";
import { ambientNode, CONSTELLATION_NODES } from "../ambient";

const { room } = FEATURED_VIDEO;

/**
 * A deterministic cloud. Same LCG shape as `AudienceTerrain.useTerrain` — seeded so server and
 * client agree byte for byte, and so the layout is stable across runs (content lights the map,
 * it never moves it).
 */
function buildCloud(count: number) {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * 46;
    return {
      i,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius * 0.62,
      // The tri-state split decides how many nodes are lit: 21% stopped, and those are the
      // ones that read as present. This is the fixture's own number driving the picture.
      stopped: rand() < room.triState.stopped / 100,
      size: rand() < 0.18 ? 3.4 : 2.1,
    };
  });
}

const CLOUD = buildCloud(CONSTELLATION_NODES);

export function RoomSection() {
  return (
    <MarketingSection id="the-room" seam seamIndex={3}>
      <MarketingHeading
        index="2.0"
        eyebrow="The room"
        title="Ten named viewers, reacting in character."
        sub={room.read}
        align="left"
      />

      <div className="mt-10 grid gap-8 md:mt-12 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        {/* the field */}
        <div
          className="relative overflow-hidden rounded-[14px]"
          style={{ border: "1px solid var(--mk-hairline)", background: "#131210", minHeight: 320 }}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            {CLOUD.map((n) => (
              <circle
                key={n.i}
                className="mk-node-drift"
                cx={n.x.toFixed(2)}
                cy={n.y.toFixed(2)}
                r={n.size * 0.35}
                fill={n.stopped ? "#ece7de" : "#8a857c"}
                opacity={n.stopped ? 0.9 : 0.22}
                style={ambientNode(n.i)}
              />
            ))}
          </svg>

          {/* the verdict, on the field */}
          <div className="absolute bottom-4 left-4 flex items-end gap-3">
            <div className="relative">
              <span
                aria-hidden
                className="mk-verdict-ring absolute -inset-2 rounded-full"
                style={{ border: "1px solid rgba(236,231,222,0.4)" }}
              />
              <span className="relative block text-[30px] font-semibold leading-none text-[#ece7de]">
                {room.stopRate}
              </span>
            </div>
            <span className="pb-1 text-[12.5px] leading-tight text-[#8a857c]">
              would stop
              <br />
              {room.percentileLine}
            </span>
          </div>
        </div>

        {/* the coded reasons — the room's own words */}
        <ul className="flex flex-col gap-3">
          {room.reasons.map((reason) => (
            <li
              key={reason.label}
              className="rounded-[12px] px-4 py-4"
              style={{
                border: "1px solid var(--mk-hairline)",
                background: "loss" in reason && reason.loss ? "rgba(255,99,99,0.04)" : "var(--mk-s1)",
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14.5px] font-medium text-[#ece7de]">{reason.label}</span>
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-[#8a857c]">
                  {reason.count}
                </span>
              </div>
              <p className="mt-2 text-[13.5px] italic leading-[1.5] text-[#c2bdb4]">
                &ldquo;{reason.quote}&rdquo;
              </p>
              <span className="mt-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#6d6961]">
                {reason.who}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </MarketingSection>
  );
}
