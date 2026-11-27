/**
 * you-read.ts — what the You page shows that no existing client request gives (plan 2026-11-24-you,
 * Task 2): the creator's connected accounts, the followers of the primary one, and what Maven read
 * from their account. SERVER ONLY. Reads only, through the caller's session client: row-level
 * security scopes every table to its owner, and every query also filters by `user_id` by hand.
 *
 * What Maven read: the newest audience linked to the primary account (`source_account_id`) whose
 * `creator_persona` says something, else the newest calibrated personal audience. Only the persona's
 * two description fields are selected (as JSON paths): `writing_style_sample` is a verbatim caption
 * and never leaves the database.
 *
 * An account carries no sync time (rulings 4: nothing refreshes the snapshots on a schedule, so a
 * sync time would stand still). Accounts listed with `read: null` is "connected, not read yet";
 * no accounts is "no account" (rulings 5).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform } from "@/lib/connected-accounts/connected-accounts-repo";

export interface YouAccount {
  id: string;
  platform: Platform;
  /** No leading "@", lower case (as stored). */
  handle: string;
  primary: boolean;
  /** Profile picture — our rehosted storage URL (`connected_accounts.avatar_url`), or null. */
  picture: string | null;
}

export interface YouRead {
  /** One sentence on what the creator makes. */
  contentDescription: string | null;
  /** One line on audience, voice, formats, expertise and what to avoid. */
  context: string | null;
  /** The handle that was read (no "@"). */
  handle: string | null;
  /** When it was read. */
  readAt: string | null;
}

export interface YouPage {
  /** Primary first, then oldest. Empty: no account connected. */
  accounts: YouAccount[];
  /** The primary account's latest follower count, or null. */
  followers: number | null;
  /** Null with accounts listed: connected, not read yet. */
  read: YouRead | null;
}

// The tables here are cast as `connected-accounts-repo.ts` casts them (its types are not regenerated).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };
type Result = { data: Record<string, unknown>[] | null; error: { message: string } | null };

const ACCOUNT_COLUMNS = "id, platform, handle, is_primary, avatar_url";
const READ_COLUMNS =
  "handle:calibration->>handle, scraped_at:calibration->>scraped_at, updated_at, " +
  "content_description:creator_persona->>content_description, context:creator_persona->>context";

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

function rowsOf(result: Result, what: string): Record<string, unknown>[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data ?? [];
}

async function followersOf(db: Db, userId: string, primary: YouAccount | null): Promise<number | null> {
  if (!primary) return null;
  const rows = rowsOf(
    await db
      .from("account_snapshots")
      .select("follower_count")
      .eq("user_id", userId)
      .eq("account_id", primary.id)
      .order("snapshot_date", { ascending: false })
      .limit(1),
    "account_snapshots",
  );
  const count = rows[0]?.follower_count;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}

interface ReadQuery {
  order(column: string, opts: { ascending: boolean }): { limit(n: number): PromiseLike<Result> };
}

async function newestRead(query: ReadQuery): Promise<YouRead | null> {
  const rows = rowsOf(await query.order("updated_at", { ascending: false }).limit(1), "audiences");
  const row = rows[0];
  if (!row) return null;
  const contentDescription = text(row.content_description);
  const context = text(row.context);
  if (!contentDescription && !context) return null;
  return { contentDescription, context, handle: text(row.handle), readAt: text(row.scraped_at) ?? text(row.updated_at) };
}

async function readOf(db: Db, userId: string, primary: YouAccount | null): Promise<YouRead | null> {
  const audiences = () =>
    db
      .from("audiences")
      .select(READ_COLUMNS)
      .eq("user_id", userId)
      .eq("is_general", false)
      .not("creator_persona", "is", null);
  if (primary) {
    const linked = await newestRead(audiences().eq("source_account_id", primary.id));
    if (linked) return { ...linked, handle: linked.handle ?? primary.handle };
  }
  return newestRead(audiences().eq("type", "personal").not("calibration->>handle", "is", null));
}

export async function readYouPage(supabase: SupabaseClient, userId: string): Promise<YouPage> {
  const db = supabase as unknown as Db;
  const accounts: YouAccount[] = rowsOf(
    await db
      .from("connected_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    "connected_accounts",
  ).map((row) => ({
    id: String(row.id),
    platform: row.platform as Platform,
    handle: String(row.handle),
    primary: row.is_primary === true,
    picture: text(row.avatar_url),
  }));
  const primary = accounts.find((a) => a.primary) ?? null;
  const [followers, read] = await Promise.all([followersOf(db, userId, primary), readOf(db, userId, primary)]);
  return { accounts, followers, read };
}
