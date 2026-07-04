/**
 * SURFACE_RADIAL_BG — single source of truth for the flat-warm "lit-from-top"
 * radial backdrop shared by the app surfaces (/start · /calendar · /analytics ·
 * /grow, …). Exact signed-off value; centralised so the gradient can never drift
 * across copies. Apply via inline style on a `relative min-h-full` container:
 * `style={{ background: SURFACE_RADIAL_BG }}`.
 */
export const SURFACE_RADIAL_BG =
  "radial-gradient(120% 80% at 50% -10%, #2c2a27, var(--color-background) 60%)";
