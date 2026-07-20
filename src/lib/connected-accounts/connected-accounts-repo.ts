/**
 * connected-accounts-repo — persistence for connected_accounts (a first-class
 * social account the user owns: platform + handle).
 *
 * A connected account decouples CONNECT from CALIBRATE: one connect gives the
 * user their per-account analytics (account_snapshots.account_id) AND the raw
 * material for a calibrated audience (audiences.source_account_id). Flat list +
 * per-account switcher; exactly one is_primary per user (the default analytics
 * view + what /start reads).
 *
 * Cast convention mirrors account-metrics-repo: connected_accounts isn't in
 * database.types.ts yet, so the query builder is cast until types regenerate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Platform = "tiktok" | "instagram" | "youtube";

export interface ConnectedAccount {
  id: string;
  user_id: string;
  platform: Platform;
  handle: string; // no leading '@', lowercased
  display_name: string | null;
  is_primary: boolean;
  connection_method: "scrape" | "oauth";
  last_synced_at: string | null;
  /** Re-hosted public avatar URL (never the platform CDN URL — those expire).
   *  NULL = we hold no image; callers fall back to the handle's initial. */
  avatar_url: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = { from: (t: string) => any };

const SELECT =
  "id, user_id, platform, handle, display_name, is_primary, connection_method, last_synced_at, avatar_url";

function normalize(r: Record<string, unknown>): ConnectedAccount {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    platform: r.platform as Platform,
    handle: String(r.handle),
    display_name: (r.display_name as string) ?? null,
    is_primary: Boolean(r.is_primary),
    connection_method: (r.connection_method as "scrape" | "oauth") ?? "scrape",
    last_synced_at: (r.last_synced_at as string) ?? null,
    avatar_url: (r.avatar_url as string) ?? null,
  };
}

const normalizeHandle = (h: string) => h.replace(/^@/, "").toLowerCase();

/**
 * A user's connected accounts, primary first then oldest. RLS scopes to the caller
 * when passed a user client. Powers the account switcher + source picker.
 */
export async function listConnectedAccounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConnectedAccount[]> {
  const { data, error } = await (supabase as unknown as UntypedClient)
    .from("connected_accounts")
    .select(SELECT)
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalize);
}

/**
 * The user's primary connected account — the default analytics view and the
 * account /start + the "Your account" tab read. Null when nothing is connected yet.
 */
export async function getPrimaryAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConnectedAccount | null> {
  const { data, error } = await (supabase as unknown as UntypedClient)
    .from("connected_accounts")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data as Record<string, unknown>);
}

/**
 * Every connected account across all users — the cron's per-account refresh loop.
 * Service-client only (RLS-free). Replaces the old "latest handle per user"
 * derivation: an account enters the loop the moment it's connected, and each
 * (platform, handle) is its own row so cross-platform series never collide.
 */
export async function listAllConnectedAccounts(
  serviceClient: SupabaseClient,
): Promise<ConnectedAccount[]> {
  const { data, error } = await (serviceClient as unknown as UntypedClient)
    .from("connected_accounts")
    .select(SELECT)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalize);
}

/**
 * Resolve the (user, platform, handle) connected account, creating it if absent.
 * The first account a user connects becomes their primary. Idempotent + race-safe
 * (a concurrent insert hits UNIQUE(user_id, platform, handle) → we re-select).
 * This is the seam the decoupled "connect" action + the calibrate route share.
 */
export async function getOrCreateConnectedAccount(
  supabase: SupabaseClient,
  input: {
    userId: string;
    platform: Platform;
    handle: string;
    displayName?: string | null;
  },
): Promise<ConnectedAccount | null> {
  const handle = normalizeHandle(input.handle);
  const db = supabase as unknown as UntypedClient;

  const { data: existing } = await db
    .from("connected_accounts")
    .select(SELECT)
    .eq("user_id", input.userId)
    .eq("platform", input.platform)
    .eq("handle", handle)
    .maybeSingle();
  if (existing) return normalize(existing as Record<string, unknown>);

  // First connected account for this user → auto-primary.
  const { count } = await db
    .from("connected_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId);
  const isPrimary = (count ?? 0) === 0;

  const { data: inserted, error } = await db
    .from("connected_accounts")
    .insert({
      user_id: input.userId,
      platform: input.platform,
      handle,
      display_name: input.displayName ?? handle,
      is_primary: isPrimary,
      connection_method: "scrape",
    })
    .select(SELECT)
    .single();

  if (error || !inserted) {
    // Likely a concurrent insert (unique violation) — re-select the winner.
    const { data: raced } = await db
      .from("connected_accounts")
      .select(SELECT)
      .eq("user_id", input.userId)
      .eq("platform", input.platform)
      .eq("handle", handle)
      .maybeSingle();
    return raced ? normalize(raced as Record<string, unknown>) : null;
  }
  return normalize(inserted as Record<string, unknown>);
}

/** Stamp last_synced_at after a successful refresh (cron, service client). Best-effort. */
export async function touchAccountSynced(
  serviceClient: SupabaseClient,
  accountId: string,
): Promise<void> {
  await (serviceClient as unknown as UntypedClient)
    .from("connected_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", accountId);
}

/**
 * Stamp the identity the SCRAPE returned — the re-hosted avatar and the creator's real
 * display name. Both were previously thrown away: the connect step writes
 * `display_name: input.displayName ?? handle`, so an account connected without one reads
 * back as its own handle ("zachking" rather than "Zach King"), and no avatar was stored
 * at all. Only ever called with values a real scrape produced; a null/empty field is
 * skipped rather than written, so a failed re-host can't blank an image we already hold.
 */
export async function updateAccountIdentity(
  supabase: SupabaseClient,
  accountId: string,
  input: { avatarUrl?: string | null; displayName?: string | null },
): Promise<void> {
  const patch: Record<string, string> = {};
  const avatar = input.avatarUrl?.trim();
  const name = input.displayName?.trim();
  if (avatar) patch.avatar_url = avatar;
  if (name) patch.display_name = name;
  if (Object.keys(patch).length === 0) return;
  await (supabase as unknown as UntypedClient)
    .from("connected_accounts")
    .update(patch)
    .eq("id", accountId);
}

/**
 * Make one account the user's primary (the default analytics view + what /start reads).
 * The partial-unique index (one is_primary per user) forbids two primaries at once, so we
 * clear every row's is_primary first, THEN set it on the target — two sequential updates,
 * never transiently violating the index. Both statements are RLS-scoped to the caller and
 * re-pinned to user_id so a user can only reprimary their own accounts.
 */
export async function setPrimaryAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const db = supabase as unknown as UntypedClient;
  await db
    .from("connected_accounts")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .eq("is_primary", true);
  const { error } = await db
    .from("connected_accounts")
    .update({ is_primary: true })
    .eq("user_id", userId)
    .eq("id", accountId);
  return !error;
}

/**
 * Disconnect an account. The FKs cascade its snapshots/posts (ON DELETE CASCADE) and null
 * out any audiences.source_account_id (ON DELETE SET NULL) — calibrated audiences survive,
 * just unlinked. If the removed row was the primary and other accounts remain, the oldest
 * is promoted so the user always has a primary. RLS-scoped + re-pinned to user_id.
 */
export async function deleteConnectedAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const db = supabase as unknown as UntypedClient;

  // Was this the primary? (decide promotion before the row is gone)
  const { data: target } = await db
    .from("connected_accounts")
    .select("is_primary")
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle();
  if (!target) return false;

  const { error } = await db
    .from("connected_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("id", accountId);
  if (error) return false;

  // Promote the oldest remaining account when we just removed the primary.
  if ((target as { is_primary?: boolean }).is_primary) {
    const { data: next } = await db
      .from("connected_accounts")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await db
        .from("connected_accounts")
        .update({ is_primary: true })
        .eq("user_id", userId)
        .eq("id", (next as { id: string }).id);
    }
  }
  return true;
}
