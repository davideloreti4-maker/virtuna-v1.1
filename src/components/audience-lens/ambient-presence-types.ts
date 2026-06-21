/**
 * ambient-presence-types — the focus contract the composer (Plan 13-04) drives the
 * persistent living-audience presence with (Surfaces 1/2/4 — AMBIENT-01, D-01/D-02/D-04).
 *
 * The presence component (`ambient-presence.tsx`) is built in ISOLATION against these two
 * props: a driven `focus` (the ONE in-focus concept, or null = idle) and the active
 * `audience`. The composer owns the scroll-spy + tap focus tracking (Plan 13-04) and passes
 * `focus` down; it also receives type-to-room focus back via the optional `onFocusChange`
 * callback (so a typed thought's reaction updates the composer's focus state).
 *
 * Honesty spine (binding — carried from P9 D-02 / P11 D-02): the spotlight reflects exactly
 * ONE real, labeled concept at a time and NEVER an aggregate/blend across cards; `focus: null`
 * is the honest idle state (roster shown, no reaction invented). The reaction data is the
 * focused concept's REAL already-emitted `{ fraction, scrollQuote }` — never fabricated.
 */

import type { Audience } from '@/lib/audience/audience-types';

/**
 * The ONE in-focus concept the spotlight reacts to, or `null` for the honest idle state.
 *
 * - `conceptText` — the labeled subject (`reacting to: {conceptText}`): a hook line, an idea
 *   title, or the creator's typed thought. NEVER an aggregate — exactly one concept.
 * - `fraction` — the concept's real `"N/T stop"` aggregate (already emitted by the skill, or
 *   returned by `POST /api/tools/react` for a typed thought). Feeds `cardScrollQuoteReactions`.
 * - `scrollQuote` — the single real verbatim lead quote for the concept (no fabrication).
 *
 * `null` ⇒ idle: the presence shows the roster at calm uniform cream with NO reaction — it
 * never invents a reaction to nothing (D-01 honesty spine).
 */
export type AmbientFocus = {
  conceptText: string;
  fraction: string;
  scrollQuote: string;
} | null;

/**
 * Props for the persistent `AmbientPresence` (built in isolation; composer-wired in 13-04).
 *
 * - `audience` — the active calibrated audience the presence represents (`null` ⇒ treated as
 *   General: the roster degrades to the `General audience · default panel` subtitle, no crash).
 * - `focus` — the driven in-focus concept (or `null` = idle). The composer owns focus tracking
 *   (scroll-spy + tap, Plan 13-04) and passes it down; this component is a pure view onto it.
 * - `reducedMotion` — gates ALL dot motion (hard-stop under reduce); sourced from the OS
 *   preference by the parent. Defaults `false`.
 * - `onFocusChange` — OPTIONAL callback the type-to-room input fires on an explicit submit so
 *   the composer's focus state updates to the typed thought's returned reaction (Plan 13-04
 *   listens; built in isolation it is a no-op when omitted).
 */
export interface AmbientPresenceProps {
  audience: Audience | null;
  focus: AmbientFocus;
  reducedMotion?: boolean;
  onFocusChange?: (focus: AmbientFocus) => void;
}
