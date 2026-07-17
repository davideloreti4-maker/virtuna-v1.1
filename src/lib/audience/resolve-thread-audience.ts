/**
 * resolveThreadAudience — the shared per-thread audience read (D-04 pin).
 *
 * Every generative tool route (ideas / hooks / script / chat / react / explore) resolves the
 * ACTIVE calibrated audience the same way: read `active_audience_id` off the user's open thread
 * and load it under the session. This helper is that block, extracted once (E2 — de-dup).
 *
 *  - thread.active_audience_id non-null → load the row via getAudience (virtual constants
 *    short-circuit; RLS-scoped).
 *  - thread.active_audience_id NULL/absent → fall back to the user's LAST-USED audience
 *    (`resolveUserAudience`) when a `userId` is supplied, else General. This is the AUD-SYNC-01
 *    fix: a freshly-created open thread is inserted with a NULL pin (`createOpenThreadLazy`), yet
 *    the composer pill displays the user's last-used calibrated audience (seeded from
 *    `user_settings.last_audience_id`, never from the thread pin). Reading a HARD General here made
 *    the runner score against General while the UI showed the calibrated audience — so a new thread
 *    silently lost every per-audience effect (repaint / intent / the Sim-v2 population projection)
 *    until the user re-clicked the switcher. Falling back to last-used keeps the runner in sync with
 *    the pill (both are last-used-centric; an explicit General pick writes BOTH the thread pin and
 *    last_audience_id to null, so General still resolves to General).
 *  - A missing id OR a load failure degrades to GENERAL_AUDIENCE — graceful, NEVER blocks a run
 *    (no regression, D-04).
 *
 * Security (CR-01): the audience id comes from the SERVER-resolved open thread, and `userId` is the
 * SERVER-resolved session user — NEVER the request body. getAudience runs under the session (RLS),
 * so a forged id cannot escape the caller's rows.
 *
 * Lives in its own module (not audience-repo) so route tests that mock `getAudience` /
 * `GENERAL_AUDIENCE` on `audience-repo` keep working through the cross-module import binding.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience } from "./audience-types";
import { getAudience, GENERAL_AUDIENCE } from "./audience-repo";
import { resolveUserAudience } from "./resolve-user-audience";

/**
 * Resolve the active audience for an open thread. Always resolves — General on any failure.
 *
 * @param supabase RLS-scoped session client.
 * @param thread   the open thread row. Only `active_audience_id` is read; loosely typed so the
 *                 pre-regeneration cast callers used inline is no longer needed at the call site.
 * @param userId   OPTIONAL server-resolved session user id. When the thread carries no pin, the
 *                 active audience falls back to this user's last-used audience (AUD-SYNC-01) so the
 *                 runner matches the composer pill. Omitted → the legacy hard-General fallback.
 */
export async function resolveThreadAudience(
  supabase: SupabaseClient,
  thread: { active_audience_id?: string | null },
  userId?: string,
): Promise<Audience> {
  const activeAudienceId = thread.active_audience_id ?? null;
  if (!activeAudienceId) {
    // No per-thread pin: honor the user's last-used audience (what the pill shows), not a hard
    // General — a fresh thread's NULL pin must not silently drop the calibrated audience.
    return userId ? resolveUserAudience(supabase, userId) : GENERAL_AUDIENCE;
  }

  try {
    const loaded = await getAudience(supabase, activeAudienceId);
    if (loaded) return loaded;
  } catch {
    // Non-fatal: fall back to General if the audience load fails (no regression, D-04).
  }
  return GENERAL_AUDIENCE;
}
