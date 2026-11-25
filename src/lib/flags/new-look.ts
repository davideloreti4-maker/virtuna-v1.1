/**
 * NEW_LOOK_ENABLED — the switch for the new look and the new app shell (owner ruling 2026-11-18).
 *
 * OFF by default: the app renders exactly as before. Set `NEXT_PUBLIC_NEW_LOOK=true` (env only,
 * like `NEXT_PUBLIC_AMBIENT_V2`) and the root layout renders
 * `<html data-look="next" data-theme="light|dark">`, which re-values the semantic tokens
 * (globals.css, "NEXT LOOK") and swaps the legacy shell for `src/components/shell`.
 *
 * Old screens inside the flag look unfinished on purpose; each is replaced by its own build part.
 * Spec: docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md
 */
export const NEW_LOOK_ENABLED = process.env.NEXT_PUBLIC_NEW_LOOK === "true";
