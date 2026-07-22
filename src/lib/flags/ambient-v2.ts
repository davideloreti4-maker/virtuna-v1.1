/**
 * AMBIENT_V2_ENABLED — the parallel-run switch for the Ambient Audience v2 surfaces.
 *
 * Owner call 2026-07-22: the v2 Overview/Simulate/Start/Brain surfaces wire to REAL producers and
 * mount ALONGSIDE the legacy `AudiencePresence` rail — never replacing it yet. OFF by default → the
 * composer's ≥xl thread rail renders the legacy room exactly as before, untouched.
 *
 * Set `NEXT_PUBLIC_AMBIENT_V2=true` (dev-server env) to render the v2 Overview in the rail, fed by
 * the REAL live projection descriptors + the active audience. The cutover — rip `AudiencePresence`
 * and wire the full Start → Simulate → Overview → Brain flow as the whole rail — is a follow-up once
 * the real-data surface is validated. Reversible for the cost of one env var.
 *
 * (Mirrors the `HORIZONTAL_ENABLED` flag convention, but env-gated so a review needs no code edit.)
 *
 * Build spec + provenance audit: docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md
 */
export const AMBIENT_V2_ENABLED = process.env.NEXT_PUBLIC_AMBIENT_V2 === "true";
