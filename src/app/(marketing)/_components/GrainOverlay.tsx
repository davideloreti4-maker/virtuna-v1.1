/**
 * GrainOverlay.tsx — Static SVG noise layer (Linear/Raycast grain pattern).
 *
 * Server component (no client directive). Implements POLISH-01.
 *
 * Per UI-SPEC § Grain Overlay Contract:
 *   - <div aria-hidden="true" className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }}>
 *     wraps an inline SVG <filter id="virtuna-grain"> with <feTurbulence
 *     type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
 *     and <feColorMatrix type="saturate" values="0"/>, painted onto a 100%×100% <rect>.
 *   - Opacity 0.03 (3%) on the SVG element — barely perceptible, matches Linear/Raycast restraint.
 *   - z-index -1 keeps it behind all page content.
 *   - aria-hidden + pointer-events-none ensures it never blocks clicks or screen-reader nav
 *     (mitigates STRIDE D threat T-01-05).
 *
 * Why pure SVG (not backdrop-filter): Lightning CSS strips backdrop-filter / mask-image from
 * Tailwind classes (PITFALLS § 2). feTurbulence is a pure SVG render — no script, no external
 * resource loading — so it survives Tailwind v4 + Next.js build pipeline intact.
 *
 * Filter id is namespaced "virtuna-grain" to avoid collision with any other SVG filter on the
 * page that might use id="grain".
 */

import type { JSX } from "react";

export function GrainOverlay(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.03 }}
      >
        <defs>
          <filter id="virtuna-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#virtuna-grain)" />
      </svg>
    </div>
  );
}
