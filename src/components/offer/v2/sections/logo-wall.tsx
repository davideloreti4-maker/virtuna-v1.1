/**
 * The logo wall — Attio/Linear grammar, running on placeholders until the owner's marks land.
 *
 * Two tracks at 31.4s and 37.9s moving in OPPOSITE directions. One track at one speed reads as
 * a carousel with a seam; two at mutually prime speeds read as a continuous surface, which is
 * the same trick Linear runs on its own `scroll` (30s) band.
 *
 * ⚠️ Every box here is a PLACEHOLDER and looks like one — dashed border, mono label, the name
 * of the missing asset. It never renders a plausible grey rectangle, because a plausible grey
 * rectangle reads as a logo that failed to load and gets skimmed past. See `placeholders.ts`
 * for why fabricating a company name here would poison the rest of the page's numbers.
 */

import { MarketingSection } from "../marketing-shell";
import { PlaceholderBox } from "../placeholder-slot";
import { LOGO_SLOTS } from "../placeholders";

function Track({ className, offset }: { className: string; offset: number }) {
  // Duplicated once: the track translates by exactly -50%, so the second copy is under the
  // pointer at the instant the first leaves. Any other duplication factor shows a gap.
  const row = [...LOGO_SLOTS, ...LOGO_SLOTS];
  return (
    <div className="flex w-max gap-4 pr-4">
      <div className={`${className} flex w-max gap-4`}>
        {row.map((slot, i) => (
          <PlaceholderBox
            key={`${slot.id}-${i}`}
            slot={slot}
            index={i + offset}
            shape="logo"
            className="w-[168px] shrink-0"
          />
        ))}
      </div>
    </div>
  );
}

export function LogoWall() {
  return (
    <MarketingSection tone="sunken" seam seamIndex={0} compact bleed>
      <p className="mx-auto mb-9 max-w-[1400px] px-5 text-center text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#6d6961] md:px-8">
        Placeholder — real marks pending
      </p>
      {/* Masked at both edges so the tracks arrive and leave rather than popping. */}
      <div
        className="flex flex-col gap-4 overflow-hidden"
        style={{
          maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)",
          WebkitMaskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)",
        }}
      >
        <Track className="mk-marquee-a" offset={0} />
        <Track className="mk-marquee-b" offset={7} />
      </div>
    </MarketingSection>
  );
}
