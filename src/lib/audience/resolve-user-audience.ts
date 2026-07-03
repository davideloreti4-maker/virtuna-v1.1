/**
 * resolveUserAudience — the shared USER-level last-used audience read.
 *
 * Sibling to resolveThreadAudience (the per-THREAD pin, D-04). Where that answers "what was
 * THIS thread generating for", this answers "what audience did the creator last pick, anywhere":
 * the default that survives a page reload (the empty /home has no open thread to read a pin from)
 * and seeds new threads + non-thread surfaces. Backed by user_settings.last_audience_id, written
 * by the audience presence switcher on every selection.
 *
 *  - user_settings.last_audience_id NULL/absent → General default (no getAudience round-trip).
 *  - Non-null → load the row via getAudience (virtual constants short-circuit; RLS-scoped).
 *  - A missing id OR a load failure degrades to GENERAL_AUDIENCE — graceful, NEVER blocks (D-04).
 *
 * Security (CR-01): userId is the SERVER-resolved session user, NEVER a request-body value.
 * getAudience runs under the session (RLS), so a forged id cannot escape the caller's rows.
 * ON DELETE SET NULL on the FK means a deleted audience already reads back as NULL → General.
 *
 * Lives in its own module (mirrors resolve-thread-audience.ts) so route tests that mock
 * getAudience / GENERAL_AUDIENCE on audience-repo keep working through the cross-module binding.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience } from "./audience-types";
import { getAudience, GENERAL_AUDIENCE } from "./audience-repo";

/**
 * Resolve the user-level last-used audience. Always resolves — General on any failure.
 *
 * @param supabase RLS-scoped session client.
 * @param userId   the SERVER-resolved session user id (never from the request body).
 */
export async function resolveUserAudience(
  supabase: SupabaseClient,
  userId: string,
): Promise<Audience> {
  let lastAudienceId: string | null = null;
  try {
    const { data } = await supabase
      .from("user_settings")
      .select("last_audience_id")
      .eq("user_id", userId)
      .maybeSingle();
    lastAudienceId = (data?.last_audience_id as string | null | undefined) ?? null;
  } catch {
    // Non-fatal: no settings row / read failure → General (no regression, D-04).
    return GENERAL_AUDIENCE;
  }

  if (!lastAudienceId) return GENERAL_AUDIENCE;

  try {
    const loaded = await getAudience(supabase, lastAudienceId);
    if (loaded) return loaded;
  } catch {
    // Non-fatal: fall back to General if the audience load fails (no regression, D-04).
  }
  return GENERAL_AUDIENCE;
}
