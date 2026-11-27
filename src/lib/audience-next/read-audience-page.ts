/**
 * read-audience-page.ts — the Audience page's one server read (spec 2026-11-25-audience, section 4). A face's
 * picture is the connected account's stored `avatar_url` (our rehosted copy) and a video's cover the post's
 * stored `cover_url`; `competitor_profiles` is not touched. SERVER ONLY: the one module of `src/lib/audience-next/` that reads, through the caller's
 * session client (row-level security scopes every table to its owner). It reads with the existing
 * repository functions, handed in as `deps` so the tests can stand in at that boundary; the model it builds
 * is `audience-model.ts`.
 *
 * In order: an address that names General or a preset → `none`; one that is no id → back to `/audience`; the
 * audiences, the accounts and the default (each failure but the audiences' degrades); the old
 * `?tab=account` address → that account's audience; `/audience/[id]` finds the audience in the list (no second
 * round trip), or a connected account's audience, else back to `/audience`; `/audience` picks one
 * (`pickAudience`). Then, for the account behind it, the newest snapshot, the posts and the topics at once
 * (each failure → empty). A redirect only ever names an id from the list.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { audienceForAccount } from "@/components/audience/audience-display";
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import { listAllPosts, type AccountPost } from "@/lib/account-metrics/account-posts-repo";
import { listAudiences, SENTINEL_IDS } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import { listConnectedAccounts, type ConnectedAccount } from "@/lib/connected-accounts/connected-accounts-repo";
import { buildContentPillars } from "@/lib/content-pillars/build-pillars";
import { UUID_PATTERN } from "@/lib/posted/posted";
import {
  accountFor,
  audiencePageOf,
  ownAudiences,
  pickAudience,
  switcherChoicesOf,
  type AccountRef,
  type AudienceRead,
  type PostedTopic,
} from "./audience-model";

export interface AudienceReadDeps {
  listAudiences(s: SupabaseClient): Promise<Audience[]>;
  listConnectedAccounts(s: SupabaseClient, userId: string): Promise<ConnectedAccount[]>;
  resolveUserAudience(s: SupabaseClient, userId: string): Promise<Audience>;
  getAccountSnapshots(s: SupabaseClient, accountId: string, limit: number): Promise<AccountSnapshot[]>;
  listAllPosts(s: SupabaseClient, accountId: string): Promise<AccountPost[]>; // its default cap, 80
  buildContentPillars(s: SupabaseClient, userId: string, accountId: string): Promise<PostedTopic[]>;
}

/** The real functions. */
export const AUDIENCE_READ_DEPS: AudienceReadDeps = {
  listAudiences,
  listConnectedAccounts,
  resolveUserAudience,
  getAccountSnapshots,
  listAllPosts,
  buildContentPillars,
};

export type AudienceTarget = { route: "index"; tab?: string; account?: string } | { route: "id"; id: string };

const INDEX = "/audience";
const pageAddress = (audience: Audience | undefined) => (audience ? `${INDEX}/${audience.id}` : INDEX);

/** A call as a promise, also when the function throws before it returns one. */
const call = async <T>(fn: () => Promise<T>): Promise<T> => fn();

/** What the model makes, or `FAILED` when it throws on what was stored. */
const FAILED = Symbol("failed");
function modelled<T>(make: () => T): T | typeof FAILED {
  try {
    return make();
  } catch {
    return FAILED;
  }
}

const refOf = (a: ConnectedAccount): AccountRef => ({
  id: a.id,
  handle: a.handle,
  platform: a.platform,
  is_primary: a.is_primary,
  picture: a.avatar_url ?? null,
});

export async function readAudiencePage(
  s: SupabaseClient,
  userId: string,
  target: AudienceTarget,
  now: Date,
  deps: AudienceReadDeps = AUDIENCE_READ_DEPS,
): Promise<AudienceRead> {
  const pushed = target.route === "id";
  if (target.route === "id") {
    if (SENTINEL_IDS.has(target.id)) return { kind: "none", pushed }; // General and the presets have no page
    if (!UUID_PATTERN.test(target.id)) return { kind: "redirect", to: INDEX }; // an unknown address: the audience page
  }

  // The old analytics address only redirects: it needs no default.
  const legacyTab = target.route === "index" && target.tab === "account";
  const [listed, connected, lastUsed] = await Promise.allSettled([
    call(() => deps.listAudiences(s)),
    call(() => deps.listConnectedAccounts(s, userId)),
    legacyTab ? Promise.resolve(null) : call(() => deps.resolveUserAudience(s, userId)),
  ]);
  if (listed.status === "rejected") return { kind: "failed", pushed };
  // The creator's own rows and the virtual ones only: row level security already scopes the list, and this
  // is a second lock, as the repository's writes have one.
  const audiences = listed.value.filter((a) => SENTINEL_IDS.has(a.id) || a.user_id === userId);
  const accounts = connected.status === "fulfilled" ? connected.value.map(refOf) : []; // as the old page

  if (target.route === "index" && legacyTab) {
    const account =
      accounts.find((a) => a.id === target.account) ?? accounts.find((a) => a.is_primary) ?? accounts[0];
    return { kind: "redirect", to: pageAddress(account ? audienceForAccount(account, audiences) : undefined) };
  }

  const used = lastUsed.status === "fulfilled" ? lastUsed.value : null;
  const defaultId = used && !used.is_general ? used.id : null;

  let audience: Audience | null;
  if (target.route === "id") {
    // Ids are stored in lower case; an address may carry one in capitals (the old page's uuid match took it).
    const id = target.id.toLowerCase();
    const found = audiences.find((a) => a.id === id);
    if (!found) {
      const account = accounts.find((a) => a.id.toLowerCase() === id);
      return { kind: "redirect", to: pageAddress(account ? audienceForAccount(account, audiences) : undefined) };
    }
    // Found, but not one of the creator's own (a `mode: "general"` row, a stored preset): no page.
    if (!ownAudiences(audiences).includes(found)) return { kind: "none", pushed };
    audience = found;
  } else {
    // The pick walks every stored read: one it cannot walk is the screen's own failure, not the route's.
    const picked = modelled(() => pickAudience(audiences, accounts, defaultId));
    if (picked === FAILED) return { kind: "failed", pushed };
    audience = picked;
    if (!audience) return { kind: "none", pushed };
  }

  const account = accountFor(audience, accounts, audiences);
  const [snapshot, posts, pillars]: [AccountSnapshot | null, AccountPost[], PostedTopic[]] = account
    ? await Promise.all([
        call(() => deps.getAccountSnapshots(s, account.id, 1)).then(
          (rows) => rows[0] ?? null,
          () => null,
        ),
        call(() => deps.listAllPosts(s, account.id)).catch((): AccountPost[] => []),
        call(() => deps.buildContentPillars(s, userId, account.id)).catch((): PostedTopic[] => []),
      ])
    : [null, [], []];

  // The model reads stored JSON: a read it cannot walk is the screen's own failure, not the route's error page.
  const chosen = audience;
  const made = modelled(() => ({
    page: audiencePageOf({ audience: chosen, audiences, accounts, defaultId, snapshot, posts, pillars }, now),
    choices: switcherChoicesOf(audiences, accounts, defaultId),
  }));
  if (made === FAILED) return { kind: "failed", pushed };
  return { kind: "audience", pushed, ...made };
}
