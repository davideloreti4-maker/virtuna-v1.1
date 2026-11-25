/**
 * What Discover draws over a video's cover: the shade at the card's bottom, the multiple's pill, and
 * the words on them. A cover is a photo, light or dark, whatever the theme, so these do not follow the
 * theme: they are fixed here, in the one file of this folder allowed colour literals (as Earn's share
 * card keeps its own in `SHARE_LOOK`), and the parts take them from here as inline styles.
 *
 * The shade carries the words: white on 82% black at the card's foot reads on any photo, and on the
 * neutral tile of a cover that did not load.
 */
export const COVER_LOOK = {
  /** The words over a cover: the line. */
  ink: "#ffffff",
  /** The meta line under it. */
  inkSoft: "rgba(255, 255, 255, 0.74)",
  /** The multiple's pill at the top left. */
  badge: "rgba(20, 20, 19, 0.62)",
  /** The shade from the card's foot up: dark at the bottom, clear at the top. */
  shadeFrom: "rgba(0, 0, 0, 0.82)",
  shadeTo: "rgba(0, 0, 0, 0)",
} as const;

/** The shade's height, from the foot: the line and the meta sit inside it. */
export const SHADE_HEIGHT = "58%";

/** The shade as a background. */
export const SHADE_BACKGROUND = `linear-gradient(to top, ${COVER_LOOK.shadeFrom}, ${COVER_LOOK.shadeTo})`;
