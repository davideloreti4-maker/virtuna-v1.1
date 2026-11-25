"use client";

/**
 * use-you — the You page's requests (plan 2026-11-24-you). `useYou` reads `GET /api/you`: the
 * accounts, the primary one's followers and what Maven read. Its own key, `["you", …]`. Below it:
 * the saves and the account actions.
 *
 * The saves change the shared entries (`["profile","creator-profile"]`, `["profile","current"]`)
 * at once, so Settings' tabs, the sidebar and Home follow. The screen closes a row the moment a save
 * resolves, so the entry must hold what was saved from the save's start to its re-read
 * (`sharedSave`). None of them retries (a mutation's default).
 *
 * An account's Make primary and Disconnect change the page's own entry at once, by the server's
 * rules, and two out at once cannot undo each other (`accountAction`).
 */
import {
  hashKey,
  notifyManager,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { CONNECT_OFFLINE } from "@/components/you-next/you-words";
import type { CreatorProfileResponse } from "@/hooks/queries/use-creator-profile";
import type { Platform } from "@/lib/connected-accounts/connected-accounts-repo";
import { queryKeys } from "@/lib/queries/query-keys";
import type { YouFactKey } from "@/lib/you/facts";
import type { YouPage } from "@/lib/you/you-read";

export const youKeys = {
  all: ["you"] as const,
  page: ["you", "page"] as const,
};

export function useYou(): UseQueryResult<YouPage> {
  return useQuery({
    queryKey: youKeys.page,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/you", { signal });
      if (!res.ok) throw new Error(`You request failed (${res.status})`);
      return (await res.json()) as YouPage;
    },
    // A refusal (signed out, the flag off, a server error) does not get better by asking again.
    retry: false,
  });
}

// ─── Saves of a shared entry ─────────────────────────────────────────────────

type Row = Record<string, unknown>;

/** The saves of one shared entry that are out, in one client. */
export interface SavesOut {
  count: number;
  /** Each save's keys, by save, in the order the saves began. */
  patches: Map<number, Row>;
  /** Ends the watch and forgets this record (the next save starts a new one). */
  stop(): void;
}

/** What a save keeps from its start: the entry before it, and its place among the saves out. */
export interface SaveContext<T> {
  previous?: T;
  save: number;
  saves: SavesOut;
}

const savesOut = new WeakMap<QueryClient, Map<string, SavesOut>>();
let lastSave = 0;

const withKeys = (now: unknown, keys: Row): unknown => (now !== null && typeof now === "object" ? { ...(now as Row), ...keys } : now);
const withPatches = (now: unknown, patches: ReadonlyMap<number, Row>): unknown =>
  patches.size === 0 ? now : withKeys(now, Object.assign({}, ...patches.values()) as Row);

/**
 * The record of the saves out for `key` in `client`, made on the first one. While it lives it watches
 * the entry: a read's answer that lands (any read: another save's, Settings', a second window's) gets
 * the saves' keys put back on top at once, in the same notification, so no render shows it bare. Only
 * a read's answer: these writes are `manual` and are left alone.
 */
function savesOf(client: QueryClient, key: QueryKey): SavesOut {
  let byKey = savesOut.get(client);
  if (!byKey) {
    byKey = new Map();
    savesOut.set(client, byKey);
  }
  const hash = hashKey(key);
  const found = byKey.get(hash);
  if (found) return found;
  const patches = new Map<number, Row>();
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.query.queryHash !== hash) return;
    if (event.action.type !== "success" || event.action.manual) return;
    client.setQueryData(key, (now: unknown) => withPatches(now, patches));
  });
  const map = byKey;
  const saves: SavesOut = {
    count: 0,
    patches,
    stop: () => {
      unsubscribe();
      if (map.get(hash) === saves) map.delete(hash);
    },
  };
  map.set(hash, saves);
  return saves;
}

/**
 * A save of `key` that shows at once and keeps showing until the server's answer is read back:
 *
 * - Begun: its keys go into the entry at once and into the saves out (`savesOf`), then any read
 *   still out is called off. While any save of the entry is out, a read that lands gets the saves'
 *   keys back on top, and these hooks start no read of it.
 * - Refused: only its keys go back to what they were before it (the other saves' keys stay on top).
 * - Settled, the last one out: any read still out (sent before a write landed) is called off, the
 *   watch ends, and the entry is read once, not awaited (the row closes on the yes). A save begun
 *   meanwhile takes that over.
 */
function sharedSave<TVariables, TData>(
  queryClient: QueryClient,
  key: QueryKey,
  keysOf: (variables: TVariables) => Row,
  send: (variables: TVariables) => Promise<void>,
) {
  return {
    mutationFn: send,
    onMutate: async (variables: TVariables): Promise<SaveContext<TData>> => {
      const previous = queryClient.getQueryData<TData>(key);
      const keys = keysOf(variables);
      const saves = savesOf(queryClient, key);
      const save = ++lastSave;
      saves.count += 1;
      saves.patches.set(save, keys);
      queryClient.setQueryData(key, (now: unknown) => withKeys(now, keys));
      await queryClient.cancelQueries({ queryKey: key });
      return { previous, save, saves };
    },
    onError: (_error: Error, variables: TVariables, context: SaveContext<TData> | undefined) => {
      if (!context) return;
      context.saves.patches.delete(context.save);
      const previous = context.previous as Row | undefined;
      if (!previous) return;
      const back = Object.fromEntries(Object.keys(keysOf(variables)).map((k) => [k, previous[k] ?? null]));
      queryClient.setQueryData(key, (now: unknown) => withPatches(withKeys(now, back), context.saves.patches));
    },
    onSettled: async (_data: void | undefined, _error: Error | null, _variables: TVariables, context: SaveContext<TData> | undefined) => {
      if (!context) return;
      const { saves } = context;
      saves.count -= 1;
      if (saves.count > 0) return;
      await queryClient.cancelQueries({ queryKey: key });
      if (saves.count > 0) return;
      saves.stop();
      void queryClient.invalidateQueries({ queryKey: key });
    },
  };
}

/** One save from You: a fact, the niche pair, or the goal. */
export type CreatorProfilePatch = Partial<Pick<CreatorProfileResponse, YouFactKey | "niche_primary" | "niche_sub" | "primary_goal">>;

/**
 * PATCH `/api/profile/creator-profile` with what one row holds, shown at once in the shared entry
 * (Settings' Creator Profile tab reads the same one). Refused: only this save's keys go back.
 */
export function useSaveCreatorProfile(): UseMutationResult<void, Error, CreatorProfilePatch, SaveContext<CreatorProfileResponse>> {
  const queryClient = useQueryClient();
  return useMutation(
    sharedSave<CreatorProfilePatch, CreatorProfileResponse>(
      queryClient,
      queryKeys.profile.creatorProfile(),
      (patch) => patch as Row,
      async (patch) => {
        const res = await fetch("/api/profile/creator-profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`Creator profile save failed (${res.status})`);
      },
    ),
  );
}

/**
 * PATCH `/api/profile` `{ display_name }`, shown at once where the name is read (sidebar, Home).
 * Refused: only the name goes back (a photo that came meanwhile stays).
 */
export function useSaveName(): UseMutationResult<void, Error, string, SaveContext<{ name: string }>> {
  const queryClient = useQueryClient();
  return useMutation(
    sharedSave<string, { name: string }>(
      queryClient,
      queryKeys.profile.current(),
      (name) => ({ name }),
      async (name) => {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: name }),
        });
        if (!res.ok) throw new Error(`Name save failed (${res.status})`);
      },
    ),
  );
}

// ─── Connect ─────────────────────────────────────────────────────────────────

/** The existing connect dialog's messages (`connect-account-dialog.tsx`). */
export const CONNECT_FAILED = "We couldn't read that account. Check the handle and try again.";

/** The route answers a sentence or a code ("invalid_connect_input"); only a sentence is shown. */
const sentenceOf = (value: unknown): string | null => (typeof value === "string" && /\s/.test(value.trim()) ? value.trim() : null);

/**
 * POST `/api/connected-accounts/connect` (a free profile read). Refused: an Error whose message is
 * what to show. It resolves once the page has been read again (`onSuccess` returns the re-read), so
 * the form closes onto the new account, never for a moment onto "Connect your account". A re-read
 * that fails does not make the connect fail: the page keeps what it showed.
 */
export function useConnectAccount(): UseMutationResult<void, Error, { platform: Platform; handle: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ platform, handle }) => {
      let res: Response;
      try {
        res = await fetch("/api/connected-accounts/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, handle }),
        });
      } catch {
        throw new Error(CONNECT_OFFLINE);
      }
      const data = (await res.json().catch(() => ({}))) as { account?: unknown; error?: unknown };
      if (!res.ok || !data.account) throw new Error(sentenceOf(data.error) ?? CONNECT_FAILED);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: youKeys.all });
      // TanStack tells the page's observers of the new answer on its next notify tick, after this
      // promise chain would have run on: wait for that tick, so the page holds the account first.
      await new Promise<void>((resolve) => notifyManager.schedule(resolve));
    },
  });
}

// ─── An account's More: Make primary, Disconnect ─────────────────────────────

/** Make primary or Disconnect, shown on the page before the server answers. */
export interface AccountAction {
  kind: "primary" | "disconnect";
  id: string;
}

/**
 * The page once `action` has gone through, by the server's rules: the primary listed first
 * (`listConnectedAccounts`), and a primary that leaves hands the mark to the oldest remaining account,
 * which is the first of the others (`deleteConnectedAccount`). The followers are the primary's: unknown
 * once the mark moves, until the page is read again. On a page that already shows it, it changes nothing.
 */
export function withAccountAction(page: YouPage, { kind, id }: AccountAction): YouPage {
  const target = page.accounts.find((a) => a.id === id);
  if (!target) return page;
  if (kind === "primary") {
    if (target.primary && page.accounts[0] === target) return page;
    const rest = page.accounts.filter((a) => a !== target).map((a) => (a.primary ? { ...a, primary: false } : a));
    return { ...page, accounts: [{ ...target, primary: true }, ...rest], followers: target.primary ? page.followers : null };
  }
  const rest = page.accounts.filter((a) => a !== target);
  return target.primary
    ? { ...page, accounts: rest.map((a, i) => (a.primary === (i === 0) ? a : { ...a, primary: i === 0 })), followers: null }
    : { ...page, accounts: rest };
}

/** The account actions out, in one client. */
export interface AccountActionsOut {
  /** The page as last read: the actions out are shown on top of it. */
  base: YouPage | undefined;
  /** Each action out not refused, by number, in the order they began. */
  actions: Map<number, AccountAction>;
  /** Actions not settled yet (a refused one counts until it settles). */
  count: number;
  /** Ends the watch and forgets this record (the next action starts a new one). */
  stop(): void;
}

/** What an action keeps from its start: its place among the actions out. */
export interface AccountActionContext {
  action: number;
  out: AccountActionsOut;
}

const accountActionsOut = new WeakMap<QueryClient, AccountActionsOut>();
let lastAccountAction = 0;

/** The page as shown: the last read with every action out on top, in order. */
function showActions(client: QueryClient, out: AccountActionsOut) {
  if (!out.base) return;
  client.setQueryData<YouPage>(youKeys.page, [...out.actions.values()].reduce(withAccountAction, out.base));
}

/**
 * The record of the account actions out in `client`, made by the first one. While it lives it
 * watches the page: a read's answer that lands (a connect elsewhere on the page asks for one) becomes
 * the base, and the actions out are put back on top in the same notification.
 */
function accountActionsOf(client: QueryClient): AccountActionsOut {
  const found = accountActionsOut.get(client);
  if (found) return found;
  const hash = hashKey(youKeys.page);
  const out: AccountActionsOut = { base: client.getQueryData<YouPage>(youKeys.page), actions: new Map(), count: 0, stop: () => {} };
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.query.queryHash !== hash) return;
    if (event.action.type !== "success" || event.action.manual) return;
    out.base = event.query.state.data as YouPage | undefined;
    showActions(client, out);
  });
  out.stop = () => {
    unsubscribe();
    if (accountActionsOut.get(client) === out) accountActionsOut.delete(client);
  };
  accountActionsOut.set(client, out);
  return out;
}

/**
 * An account action that shows at once and keeps showing until the server's answer is read back.
 * Two out at once cannot undo each other:
 *
 * - Begun: it goes on top of the page at once (the record above), then any read still out is
 *   called off. While any is out, a read that lands gets them all back on top, and these hooks start
 *   no read of the page.
 * - Refused: only it leaves; the page is the last read with the others still on top.
 * - Settled, the last one out: any read still out is called off, the watch ends, and the page is read
 *   once, not awaited. An action begun meanwhile takes that over.
 */
function accountAction(queryClient: QueryClient, kind: AccountAction["kind"], send: (id: string) => Promise<void>) {
  return {
    mutationFn: send,
    onMutate: async (id: string): Promise<AccountActionContext> => {
      const out = accountActionsOf(queryClient);
      const action = ++lastAccountAction;
      out.count += 1;
      out.actions.set(action, { kind, id });
      showActions(queryClient, out);
      await queryClient.cancelQueries({ queryKey: youKeys.page });
      return { action, out };
    },
    onError: (_error: Error, _id: string, context: AccountActionContext | undefined) => {
      if (!context) return;
      context.out.actions.delete(context.action);
      showActions(queryClient, context.out);
    },
    onSettled: async (_data: void | undefined, _error: Error | null, _id: string, context: AccountActionContext | undefined) => {
      if (!context) return;
      const { out } = context;
      out.count -= 1;
      if (out.count > 0) return;
      await queryClient.cancelQueries({ queryKey: youKeys.page });
      if (out.count > 0) return;
      out.stop();
      void queryClient.invalidateQueries({ queryKey: youKeys.all });
    },
  };
}

/**
 * PATCH `/api/connected-accounts/{id}` `{ is_primary: true }`. The mark moves at once and the account
 * goes first, as the server lists it; its followers are unknown until the page is read again.
 * Refused: only this change goes back. No retry.
 */
export function useMakePrimary(): UseMutationResult<void, Error, string, AccountActionContext> {
  const queryClient = useQueryClient();
  return useMutation(
    accountAction(queryClient, "primary", async (id) => {
      const res = await fetch(`/api/connected-accounts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      });
      if (!res.ok) throw new Error(`Make primary failed (${res.status})`);
    }),
  );
}

/**
 * DELETE `/api/connected-accounts/{id}`: the account's snapshots and posts go with it, its audiences
 * stay, unlinked. The row leaves at once; when it was the primary the oldest remaining account takes
 * the mark, as the server does. Refused: the row comes back in its place. No retry.
 */
export function useDisconnectAccount(): UseMutationResult<void, Error, string, AccountActionContext> {
  const queryClient = useQueryClient();
  return useMutation(
    accountAction(queryClient, "disconnect", async (id) => {
      const res = await fetch(`/api/connected-accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Disconnect failed (${res.status})`);
    }),
  );
}
