/**
 * frame-stills — self-contained "video frames" for the landing's Test card, so
 * the filmstrip reads as a real talking-head clip instead of empty play-tiles.
 *
 * Each beat is a 9:16 cinematic still rendered as an inline SVG data-URI (no CDN
 * asset, no CSP fetch, never a broken box): a duotone-lit backdrop, a soft
 * out-of-focus subject (head + shoulders) placed on a third, a key-light bloom,
 * a vignette, and film grain. The moods track the cut — a punchy cold open, a
 * cooler setup, the desaturated 0:06 stall (the drop), a warm payoff, a dim
 * close — so scrubbing the strip feels like scrubbing a video.
 *
 * Depicted imagery, not UI chrome — the matte/coral dosage rule governs the app
 * surface, not the content of a video frame, so these carry real scene color.
 */

interface Beat {
  /** Backdrop gradient (top → bottom). */
  top: string;
  bottom: string;
  /** Key-light bloom hue behind the subject. */
  glow: string;
  /** Subject horizontal center (0–90) and head radius. */
  x: number;
  r: number;
  /** Extra grain/haze opacity (the stall reads flatter/dustier). */
  haze: number;
}

function still({ top, bottom, glow, x, r, haze }: Beat): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='160' viewBox='0 0 90 160'>` +
    `<defs>` +
    `<linearGradient id='b' x1='0' y1='0' x2='0.2' y2='1'>` +
    `<stop offset='0' stop-color='${top}'/><stop offset='1' stop-color='${bottom}'/>` +
    `</linearGradient>` +
    `<radialGradient id='k' cx='${(x / 90) * 100}%' cy='40%' r='55%'>` +
    `<stop offset='0' stop-color='${glow}' stop-opacity='0.55'/>` +
    `<stop offset='1' stop-color='${glow}' stop-opacity='0'/>` +
    `</radialGradient>` +
    `<radialGradient id='v' cx='50%' cy='42%' r='78%'>` +
    `<stop offset='52%' stop-color='#000' stop-opacity='0'/>` +
    `<stop offset='100%' stop-color='#000' stop-opacity='0.6'/>` +
    `</radialGradient>` +
    `<filter id='s' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='3.2'/></filter>` +
    `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix type='saturate' values='0'/>` +
    `<feComponentTransfer><feFuncA type='linear' slope='${0.05 + haze}'/></feComponentTransfer></filter>` +
    `</defs>` +
    `<rect width='90' height='160' fill='url(#b)'/>` +
    `<rect width='90' height='160' fill='url(#k)'/>` +
    // subject — soft out-of-focus head + shoulders
    `<g filter='url(#s)'>` +
    `<ellipse cx='${x}' cy='128' rx='${r * 2.1}' ry='${r * 1.7}' fill='#000' opacity='0.32'/>` +
    `<ellipse cx='${x}' cy='72' rx='${r}' ry='${r * 1.12}' fill='#000' opacity='0.34'/>` +
    `<ellipse cx='${x - r * 0.35}' cy='66' rx='${r * 0.5}' ry='${r * 0.7}' fill='#fff' opacity='0.06'/>` +
    `</g>` +
    `<rect width='90' height='160' fill='url(#v)'/>` +
    `<rect width='90' height='160' filter='url(#g)'/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The five filmstrip beats, in cut order. */
export const FRAME_STILLS = {
  coldOpen: still({ top: "#4a3128", bottom: "#1c1512", glow: "#ff8a5c", x: 45, r: 12, haze: 0 }),
  setup: still({ top: "#28322f", bottom: "#141a19", glow: "#6fb4a6", x: 34, r: 11, haze: 0.02 }),
  stall: still({ top: "#2b2b28", bottom: "#181817", glow: "#8a8a84", x: 52, r: 9, haze: 0.06 }),
  payoff: still({ top: "#463726", bottom: "#181410", glow: "#ffc36b", x: 44, r: 13, haze: 0 }),
  close: still({ top: "#242835", bottom: "#121317", glow: "#7f8ab0", x: 46, r: 10, haze: 0.03 }),
} as const;
