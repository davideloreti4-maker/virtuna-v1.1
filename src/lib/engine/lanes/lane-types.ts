/**
 * Lane — one candidate way a creator with no niche could show up (spec §4, mock §9 right).
 *
 * Produced by synthesizeLanes from the creator's own 20-minute answer; consumed by
 * buildLaneDrops as the `niche` steer handed to the real adapt.ts call. Zero imports so
 * both the server producer and the client reveal can hold the shape.
 */
export interface Lane {
  /** Short lane name shown as the group head — "The numbers person". */
  name: string;
  /** The one-line who, beside the name — "receipts, not vibes". */
  who: string;
  /** The niche string this lane feeds to adapt.ts (never rendered). */
  niche: string;
}
