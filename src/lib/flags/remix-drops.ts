/**
 * REMIX_DROPS_ENABLED — where the daily drops (Home's remix carousel) and their two routes
 * (`/api/surfaces/drops`, `/api/surfaces/drops/remix`) are live.
 *
 * The v8 parallel run opened them; the new look opens them too (owner 2026-11-26: "enable it
 * always" — the carousel is new-look Home's, and prod runs the new look with v8 off). Nothing else
 * v8 gates (/welcome, the sim door, lanes) moves with this.
 *
 * ⚠️ A spend surface: a cache miss costs ≤6 adapt calls + one batched Flash sim, once a day per
 * audience. With both flags off the routes still 404, so the legacy look stays byte-identical.
 */

import { CONCEPT_V8_ENABLED } from "./concept-v8";
import { NEW_LOOK_ENABLED } from "./new-look";

export const REMIX_DROPS_ENABLED = CONCEPT_V8_ENABLED || NEW_LOOK_ENABLED;
