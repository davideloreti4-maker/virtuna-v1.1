/**
 * SURFACE_RADIAL_BG — single source of truth for the flat-warm "lit-from-top"
 * radial backdrop shared by the app surfaces (/start · /calendar · /analytics ·
 * /grow, …). Exact signed-off value; centralised so the gradient can never drift
 * across copies. Apply via inline style on a `relative min-h-full` container:
 * `style={{ background: SURFACE_RADIAL_BG }}`.
 */
export const SURFACE_RADIAL_BG =
  "radial-gradient(130% 90% at 50% -20%, #34322e, var(--color-background) 70%)";
