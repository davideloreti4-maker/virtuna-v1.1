/**
 * Shared matte atmosphere for the /go offer page.
 *
 * GRAIN_URL — a fine fractal-noise tile as an inline SVG data-URI (no asset,
 * CSP-safe). Laid at very low opacity with `mix-blend-soft-light` it gives the
 * dark charcoal a bit of tooth so nothing reads as dead-flat. The hero and every
 * below-hero section pull from this one source so the whole page shares a grain.
 */
export const GRAIN_URL =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>" +
      "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/>" +
      "<feColorMatrix type='saturate' values='0'/></filter>" +
      "<rect width='140' height='140' filter='url(#n)' opacity='0.55'/></svg>",
  );
