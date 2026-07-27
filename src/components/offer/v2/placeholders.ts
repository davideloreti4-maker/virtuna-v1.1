/**
 * Every unfilled slot on /go-v2, in ONE module, so the swap to real assets is one file.
 *
 * Placeholders are approved by the owner ("placeholders are approved for logos, testimonials,
 * quotes, screenshots, video") on one condition, which is the whole design of this file:
 *
 *   ⛔ NEVER FABRICATE a name, company, handle, avatar, quote, rating or metric.
 *
 * A dashed box that says "TESTIMONIAL 1 — awaiting name · handle · quote" is honest. An
 * invented testimonial from "Sarah K., 240k followers" is not, and this page's entire argument
 * is credibility — a visitor who catches one fake stops believing the real numbers too. So a
 * slot never renders a plausible value; it renders its own emptiness, legibly.
 *
 * `PLACEHOLDER_MARKER` is the tripwire. It is embedded in every slot's rendered output as a
 * data attribute, and `__tests__/placeholders.test.ts` fails the build if this module is
 * reachable from the PRODUCTION `/go` route. /go-v2 is exempt while it is a review route.
 * That test is the thing that stops a dashed box shipping to paid traffic.
 *
 * ── WHAT THE OWNER STILL OWES ─────────────────────────────────────────────────────────────
 * 6 logos · 3 testimonials (name, handle, avatar, quote) · the case-study quote.
 * Ideally one testimonial names a SPECIFIC second or a SPECIFIC fix — "it caught the drop at
 * 0:06" beats "this product is amazing", because a concrete claim is checkable and an
 * enthusiastic one is not.
 */

/** The tripwire string. Grep-able, and asserted absent from production `/go`. */
export const PLACEHOLDER_MARKER = "maven-placeholder-unfilled";

export interface PlaceholderSlot {
  /** Stable key + the label rendered in the box. */
  id: string;
  label: string;
  /** What asset fills this, in the owner's terms. Rendered as the muted second line. */
  awaiting: string;
}

/**
 * The logo wall. Six slots because that is what the owner said they have — the count is a
 * commitment from them, not a guess by us. If fewer arrive, delete slots; do not pad.
 */
export const LOGO_SLOTS: PlaceholderSlot[] = [
  { id: "logo-1", label: "LOGO 1", awaiting: "awaiting mark" },
  { id: "logo-2", label: "LOGO 2", awaiting: "awaiting mark" },
  { id: "logo-3", label: "LOGO 3", awaiting: "awaiting mark" },
  { id: "logo-4", label: "LOGO 4", awaiting: "awaiting mark" },
  { id: "logo-5", label: "LOGO 5", awaiting: "awaiting mark" },
  { id: "logo-6", label: "LOGO 6", awaiting: "awaiting mark" },
];

/**
 * Testimonials. Note what is NOT here: no names, no handles, no follower counts, no star
 * ratings, no avatars. Each slot names the four fields it needs and renders nothing else.
 */
export const TESTIMONIAL_SLOTS: PlaceholderSlot[] = [
  { id: "testimonial-1", label: "TESTIMONIAL 1", awaiting: "name · handle · avatar · quote" },
  { id: "testimonial-2", label: "TESTIMONIAL 2", awaiting: "name · handle · avatar · quote" },
  {
    id: "testimonial-3",
    label: "TESTIMONIAL 3",
    // The one worth asking for by shape, not just by field list.
    awaiting: "name · handle · avatar · quote naming a specific second or fix",
  },
];

/**
 * The case-study attribution. The 231 → 183,000 numbers themselves are REAL and cited
 * (`featured-video.ts`); what is missing is the creator's consent to be named. Until it
 * arrives the band runs unattributed — which §8 is explicit about: unattributed it is the
 * same unverifiable claim, just better positioned, so the slot stays visible as a reminder
 * that the section is not finished.
 */
export const CASE_STUDY_QUOTE_SLOT: PlaceholderSlot = {
  id: "case-study-quote",
  label: "CASE STUDY ATTRIBUTION",
  awaiting: "creator consent · name · handle · quote",
};

/** Product footage that is not yet cleared for use. */
export const MEDIA_SLOTS: PlaceholderSlot[] = [
  { id: "walkthrough-video", label: "WALKTHROUGH VIDEO", awaiting: "awaiting screen recording" },
];

/** Everything, for the guard test and for any future audit of what is still unfilled. */
export const ALL_PLACEHOLDER_SLOTS: PlaceholderSlot[] = [
  ...LOGO_SLOTS,
  ...TESTIMONIAL_SLOTS,
  CASE_STUDY_QUOTE_SLOT,
  ...MEDIA_SLOTS,
];
