/**
 * resolveThreadAudience — the shared per-thread audience read (D-04 pin).
 *
 * Every generative tool route (ideas / hooks / script / chat / react / explore) resolves the
 * ACTIVE calibrated audience the same way: read `active_audience_id` off the user's open thread
 * and load it under the session. This helper is that block, extracted once (E2 — de-dup).
 *
 *  - thread.active_audience_id NULL/absent → General default (no DB query — the virtual constant).
 *  - Non-null → load the row via getAudience (virtual constants short-circuit; RLS-scoped).
 *  - A missing id OR a load failure degrades to GENERAL_AUDIENCE — graceful, NEVER blocks a run
 *    (no regression, D-04).
 *
 * Security (CR-01): the audience id comes from the SERVER-resolved open thread, NEVER the request
 * body. getAudience runs under the session (RLS), so a forged id cannot escape the caller's rows.
 *
 * Lives in its own module (not audience-repo) so route tests that mock `getAudience` /
 * `GENERAL_AUDIENCE` on `audience-repo` keep working through the cross-module import binding.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience } from "./audience-types";
import { getAudience, GENERAL_AUDIENCE } from "./audience-repo";

/**
 * Resolve the active audience for an open thread. Always resolves — General on any failure.
 *
 * @param supabase RLS-scoped session client.
 * @param thread   the open thread row. Only `active_audience_id` is read; loosely typed so the
 *                 pre-regeneration cast callers used inline is no longer needed at the call site.
 */
export async function resolveThreadAudience(
  supabase: SupabaseClient,
  thread: { active_audience_id?: string | null },
): Promise<Audience> {
  const activeAudienceId = thread.active_audience_id ?? null;
  if (!activeAudienceId) return GENERAL_AUDIENCE;

  try {
    const loaded = await getAudience(supabase, activeAudienceId);
    if (loaded) return loaded;
  } catch {
    // Non-fatal: fall back to General if the audience load fails (no regression, D-04).
  }
  return GENERAL_AUDIENCE;
}
