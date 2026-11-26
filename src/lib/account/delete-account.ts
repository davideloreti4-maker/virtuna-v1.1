/**
 * Delete an account: the steps of `POST /api/settings/account/delete`, given its clients so they can be
 * tested. Spec: docs/superpowers/specs/2026-11-26-settings-design.md, 3.2.
 *
 * In order, stopping at the first refusal:
 *   1. The plan. A Whop membership that will bill again refuses (`plan_renews`); Whop not reachable
 *      refuses (`whop_unreachable`). Deleting the account would not stop Whop billing.
 *   2. The ledger. Any `wallet_transactions` row refuses (`ledger`): that table is ON DELETE RESTRICT.
 *   3. The files. `storage.objects` has no foreign key to users, so the caller's files are listed
 *      first (every listing before any removal: a failed listing removes nothing) and then removed.
 *      A failed removal refuses (`files_failed`) and the account stays, so a retry runs it again.
 *   4. The account. `auth.admin.deleteUser`; the per-user rows cascade from `auth.users`.
 *
 * The log gets step names and counts only: never the user id, an email or a storage path.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { membershipRenews, type LiveMembership } from "@/lib/whop/membership";

export type DeleteOutcome =
  | { ok: true; removedFiles: number }
  | { ok: false; reason: "plan_renews"; renewsAt: string | null }
  | { ok: false; reason: "whop_unreachable" }
  | { ok: false; reason: "ledger" }
  | { ok: false; reason: "files_failed" }
  | { ok: false; reason: "delete_failed" };

export interface DeleteDeps {
  /** The service-role client. */
  service: SupabaseClient;
  /** null: Whop has no such membership. Throws when Whop cannot be asked. */
  fetchMembership(id: string): Promise<LiveMembership | null>;
  /** Step names and counts only. */
  log(event: string, fields: Record<string, number | string | boolean>): void;
}

/** Supabase's `list` page size; a shorter page is the last one. */
const LIST_PAGE = 1000;
/** Objects removed per `remove` call. */
const REMOVE_CHUNK = 100;
/** Prefixes listed at once (one per blueprint or analysis id can be many). */
const LIST_CONCURRENCY = 8;

type Bucket = "avatars" | "videos" | "clips" | "filmstrips";
const BUCKETS: readonly Bucket[] = ["avatars", "videos", "clips", "filmstrips"];

class StepError extends Error {}

/** Every object path under `prefix` in `bucket`. A folder (an entry without an id) is listed too. */
async function listUnder(service: SupabaseClient, bucket: Bucket, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await service.storage.from(bucket).list(prefix, { limit: LIST_PAGE, offset });
    if (error) throw new StepError(`list ${bucket}`);
    const entries = data ?? [];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id == null) paths.push(...(await listUnder(service, bucket, path)));
      else paths.push(path);
    }
    if (entries.length < LIST_PAGE) return paths;
  }
}

/** The ids of the caller's rows in `table`. */
async function idsOf(service: SupabaseClient, table: "remix_blueprints" | "analysis_results", userId: string): Promise<string[]> {
  const { data, error } = await service.from(table).select("id").eq("user_id", userId);
  if (error) throw new StepError(`read ${table}`);
  return ((data ?? []) as Array<{ id: unknown }>).map((row) => String(row.id));
}

/** Runs `task` over `items`, a few at a time; the first failure rejects. */
async function eachLimited<T>(items: readonly T[], task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(LIST_CONCURRENCY, items.length) }, worker));
}

/** Every file of the caller, by bucket. Throws a StepError when any listing fails. */
async function collectFiles(service: SupabaseClient, userId: string): Promise<Record<Bucket, string[]>> {
  const files: Record<Bucket, string[]> = { avatars: [], videos: [], clips: [], filmstrips: [] };
  files.avatars = await listUnder(service, "avatars", userId);
  files.videos = await listUnder(service, "videos", userId);

  const blueprintIds = await idsOf(service, "remix_blueprints", userId);
  const analysisIds = await idsOf(service, "analysis_results", userId);
  // clips/{blueprintId}/{beat}.mp4; filmstrips/{analysisId}/… and filmstrips/{blueprintId}/… (with a scrub/ folder).
  const prefixes: Array<[Bucket, string]> = [
    ...blueprintIds.map((id): [Bucket, string] => ["clips", id]),
    ...[...new Set([...analysisIds, ...blueprintIds])].map((id): [Bucket, string] => ["filmstrips", id]),
  ];
  await eachLimited(prefixes, async ([bucket, prefix]) => {
    files[bucket].push(...(await listUnder(service, bucket, prefix)));
  });
  return files;
}

export async function deleteAccount(userId: string, deps: DeleteDeps): Promise<DeleteOutcome> {
  const { service, log } = deps;

  // 1. The plan.
  const subscription = await service
    .from("user_subscriptions")
    .select("whop_membership_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (subscription.error) {
    log("delete: subscription read failed", { step: "plan" });
    return { ok: false, reason: "delete_failed" };
  }
  const membershipId = (subscription.data as { whop_membership_id?: unknown } | null)?.whop_membership_id;
  if (typeof membershipId === "string" && membershipId !== "") {
    let membership: LiveMembership | null;
    try {
      membership = await deps.fetchMembership(membershipId);
    } catch {
      log("delete: whop unreachable", { step: "plan" });
      return { ok: false, reason: "whop_unreachable" };
    }
    if (membership && membershipRenews(membership)) {
      log("delete: refused, plan renews", { step: "plan" });
      return { ok: false, reason: "plan_renews", renewsAt: membership.renewsAt };
    }
  }

  // 2. The ledger.
  const ledger = await service
    .from("wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (ledger.error) {
    log("delete: ledger read failed", { step: "ledger" });
    return { ok: false, reason: "delete_failed" };
  }
  if ((ledger.count ?? 0) > 0) {
    log("delete: refused, ledger rows", { step: "ledger", rows: ledger.count ?? 0 });
    return { ok: false, reason: "ledger" };
  }

  // 3. The files: every listing first, then the removals.
  let files: Record<Bucket, string[]>;
  try {
    files = await collectFiles(service, userId);
  } catch (err) {
    log("delete: file listing failed", { step: "files", at: err instanceof StepError ? err.message : "unknown" });
    return { ok: false, reason: "files_failed" };
  }
  log("delete: files listed", {
    step: "files",
    avatars: files.avatars.length,
    videos: files.videos.length,
    clips: files.clips.length,
    filmstrips: files.filmstrips.length,
  });

  let removedFiles = 0;
  for (const bucket of BUCKETS) {
    const paths = files[bucket];
    for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
      let failed = false;
      try {
        const { error } = await service.storage.from(bucket).remove(paths.slice(i, i + REMOVE_CHUNK));
        failed = Boolean(error);
      } catch {
        failed = true;
      }
      if (failed) {
        log("delete: file removal failed", { step: "files", bucket, removedBefore: removedFiles });
        return { ok: false, reason: "files_failed" };
      }
      removedFiles += Math.min(REMOVE_CHUNK, paths.length - i);
    }
  }
  log("delete: files removed", { step: "files", removed: removedFiles });

  // 4. The account; its rows cascade.
  const { error: deleteError } = await service.auth.admin.deleteUser(userId);
  if (deleteError) {
    log("delete: user delete failed after files were removed", { step: "account", removedFiles });
    return { ok: false, reason: "delete_failed" };
  }
  log("delete: account deleted", { step: "account", removedFiles });
  return { ok: true, removedFiles };
}
