/**
 * Testimonials — three dashed slots, on the review route.
 *
 * ── WHY THIS AND NOT THE SHIPPED `Testimonials` COMPONENT ─────────────────────────────────
 * `sections/testimonials.tsx` has a considered empty state: rather than admit "no quotes yet"
 * mid-persuasion, it renders a "your first week" benefit block, and swaps to real quote cards
 * the moment its `TESTIMONIALS` array gets entries. That is the right thing to SHIP, and it
 * still is — that component is untouched and is what `/go` serves today.
 *
 * But /go-v2 is a REVIEW route, and the owner has the real quotes in hand. What they need to
 * see here is exactly where three quotes land, at what size, in what grid — which a substitute
 * section cannot show them. So this renders the slots, unmistakably empty.
 *
 * ⛔ Never fabricate a name, handle, avatar, follower count, star rating or quote to preview
 * the layout "more realistically". This page's whole argument is credibility; one invented
 * testimonial and a visitor has no reason to believe 231 → 183,000 either. The dashed box IS
 * the honest preview.
 *
 * AT CUTOVER: either fill `TESTIMONIALS` in the shipped component and mount that, or move the
 * real quotes here. Do not ship this file's dashed boxes to `/go` — `__tests__/placeholders.test.ts`
 * fails the build if that is attempted.
 */

import { MarketingSection, MarketingHeading } from "../marketing-shell";
import { PlaceholderBox } from "../placeholder-slot";
import { TESTIMONIAL_SLOTS } from "../placeholders";

export function TestimonialWall() {
  return (
    <MarketingSection tone="sunken" seam seamIndex={7}>
      <MarketingHeading
        eyebrow="Placeholder — real quotes pending"
        title="What creators say after the first run."
      />
      <div className="mt-10 grid gap-4 md:mt-12 md:grid-cols-3">
        {TESTIMONIAL_SLOTS.map((slot, i) => (
          <PlaceholderBox key={slot.id} slot={slot} index={i + 11} shape="card" />
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-[52ch] text-center text-[13px] leading-[1.55] text-[#6d6961]">
        One of these should name a specific second or a specific fix — a checkable claim beats an
        enthusiastic one.
      </p>
    </MarketingSection>
  );
}
