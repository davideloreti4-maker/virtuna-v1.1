/**
 * How the Audience panel lays itself out for the width it is given (not the window's): the ring
 * beside the rows only where both fit, the ring above the rows everywhere else.
 *
 * Side by side the two cards are columns 1 : 1.15, 16 apart, and the ring (a 258 box) sits in the
 * first. At the design width (588) that card is 266 wide: the ring with 4 on each side. A little
 * narrower and the ring shrinks to keep that 4; below 570 the rows' card can no longer hold
 * "Purposeful viewers" beside "Left by 0:03", so the panel stacks (the phone's layout).
 */

/** The desktop ring's box: twice its outer radius (124) plus the dots' reach. */
export const DESKTOP_RING_BOX = 258;
/** What the ring keeps free on each side of its card. */
export const RING_CARD_INSET = 4;
/** The narrowest panel that shows the ring beside the rows. */
const SIDE_BY_SIDE_MIN = 570;

const GAP = 16;
const COLUMNS = 1 + 1.15;

export interface AudienceLayout {
  /** The ring above the rows (the phone's layout) instead of beside them. */
  stacked: boolean;
  /** The factor the side-by-side ring is drawn at; 1 when stacked. */
  ringScale: number;
}

export function audienceLayoutFor(panelWidth: number): AudienceLayout {
  if (panelWidth < SIDE_BY_SIDE_MIN) return { stacked: true, ringScale: 1 };
  const ringCard = (panelWidth - GAP) / COLUMNS;
  const ringScale = Math.min(1, (ringCard - 2 * RING_CARD_INSET) / DESKTOP_RING_BOX);
  return { stacked: false, ringScale };
}
