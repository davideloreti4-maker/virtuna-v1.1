"use client";

import * as React from "react";

import { initialsOf } from "@/components/home-next/greeting";
import { useCreatorProfile } from "@/hooks/queries/use-creator-profile";
import { useProfile, useUploadAvatar } from "@/hooks/queries/use-profile";
import {
  CONNECT_FAILED,
  useConnectAccount,
  useDisconnectAccount,
  useMakePrimary,
  useSaveCreatorProfile,
  useSaveName,
  useYou,
  type CreatorProfilePatch,
} from "@/hooks/queries/use-you";
import { YOU_FACT_KEYS, type YouFactKey } from "@/lib/you/facts";

import { AccountMenu } from "./account-menu";
import { YouScreen, type YouAccountRow } from "./you-screen";
import { SAVE_FAILED, accountLine, accountName, disconnectFailed, isGoal, primaryFailed, readFoot, readHow, whoLine } from "./you-words";

/**
 * You with its data (plan 2026-11-24-you): the name and photo (`useProfile`), the facts, niche and
 * goal (`useCreatorProfile`), the accounts and what Maven read (`useYou`). Every save sends one row's
 * keys through the app's hooks, which change the shared entries at once and resolve only once those
 * hold what was saved (the screen closes the row then). Nothing here spends credits: the requests are
 * reads, the saves, the photo, and a connect (a free profile read).
 *
 * - The page waits for its first answers. It fails only when the name or the profile never loaded: a
 *   read that fails later (the one after a save) keeps the page and what it shows.
 * - The accounts fail on their own: the line under Accounts, with its Try again. While that retry is
 *   out the page stays as it is (an open row keeps its text) and the line stays until they land.
 * - "From your account" and where Connect lives follow from `read` and the accounts list (rulings 11
 *   and 12); the account rows carry no sync time (rulings 4 and 10).
 * - An account's More (`AccountMenu`): Make primary and Disconnect, each for the account of its own
 *   row (its id, never a place in the list), one request per confirmation. The change shows at once
 *   (`useMakePrimary`, `useDisconnectAccount`); a refusal puts back only that change and says so
 *   under the Accounts card until the next action.
 */

/** True when the request went through. */
async function went(send: () => Promise<unknown>): Promise<boolean> {
  try {
    await send();
    return true;
  } catch {
    return false;
  }
}

/** The photo route's own refusals are shown as they are; anything else is a failed save. */
function photoMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^(Invalid file type|File too large)/.test(message) ? message : SAVE_FAILED;
}

const one = (key: YouFactKey, value: string | null) => ({ [key]: value }) as CreatorProfilePatch;

/**
 * Nothing loaded and refused at least once. On the app's client the name and the profile reads keep
 * the library's three retries (Settings shares them); the page says so at the first refusal, not
 * after about 7 s, and a retry behind it that goes through simply shows the page.
 */
const neverLoaded = (query: { data: unknown; isError: boolean; failureCount: number }) =>
  query.data === undefined && (query.isError || query.failureCount > 0);

export function YouNext(): React.JSX.Element {
  const profile = useProfile();
  const creator = useCreatorProfile();
  const you = useYou();
  const saveProfile = useSaveCreatorProfile();
  const saveName = useSaveName();
  const upload = useUploadAvatar();
  const connect = useConnectAccount();
  const makePrimary = useMakePrimary();
  const disconnect = useDisconnectAccount();
  // A refused Make primary or Disconnect, under the Accounts card until the next one. Told from each
  // action's own promise: a hook's per-call callbacks are only the latest call's, and two can be out.
  const [accountsNotice, setAccountsNotice] = React.useState<string | null>(null);
  const accountAction = (send: () => Promise<void>, refused: string) => {
    setAccountsNotice(null);
    send().catch(() => setAccountsNotice(refused));
  };

  // The accounts failed: none in hand and refused, until a read of them lands. A Try again that is out
  // keeps it so (TanStack makes a query with no data pending again while it asks), so the page is not
  // drawn as loading over an open row. With accounts in hand a refused re-read (after a connect that
  // went through) keeps them and the line.
  const accountsFailed = you.data === undefined && you.errorUpdateCount > 0;
  const state =
    neverLoaded(profile) || neverLoaded(creator)
      ? "error"
      : profile.data === undefined || creator.data === undefined || (you.data === undefined && !accountsFailed)
        ? "loading"
        : "ready";

  const accounts = you.data?.accounts ?? [];
  const primary = accounts.find((a) => a.primary) ?? null;
  const rows: YouAccountRow[] = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    primary: a.primary,
    line: accountLine(a.platform),
  }));
  const read = you.data?.read ?? null;
  const row = creator.data;
  const facts = Object.fromEntries(YOU_FACT_KEYS.map((key) => [key, row?.[key] ?? null])) as Record<YouFactKey, string | null>;
  const goal = row?.primary_goal;
  // No saved name: the heading shows the email in its place, and the name opens empty under it.
  const savedName = profile.data?.name?.trim() ?? "";

  return (
    <YouScreen
      state={state}
      onRetry={() => {
        void profile.refetch();
        void creator.refetch();
        void you.refetch();
      }}
      who={{
        name: savedName || profile.data?.email?.trim() || "",
        unnamed: savedName === "",
        initials: initialsOf(profile.data?.name, profile.data?.email),
        avatar: profile.data?.avatar ?? null,
        // Not known while the accounts failed: no line rather than "No account connected".
        line: accountsFailed ? "" : whoLine(primary, you.data?.followers ?? null),
      }}
      read={read ? { what: read.contentDescription, how: readHow(read.context), foot: readFoot(read.handle, read.readAt) } : null}
      facts={facts}
      niche={{ primary: row?.niche_primary ?? null, sub: row?.niche_sub ?? null }}
      goal={isGoal(goal) ? goal : null}
      accounts={rows}
      accountsState={accountsFailed ? "error" : "ready"}
      accountsNotice={accountsNotice}
      onRetryAccounts={() => void you.refetch()}
      renderAccountMenu={(account) => (
        <AccountMenu
          handle={account.handle}
          name={accountName(account, accounts)}
          primary={account.primary}
          onMakePrimary={() => accountAction(() => makePrimary.mutateAsync(account.id), primaryFailed(accountName(account, accounts)))}
          onDisconnect={() => accountAction(() => disconnect.mutateAsync(account.id), disconnectFailed(accountName(account, accounts)))}
        />
      )}
      onSaveFact={(key, value) => went(() => saveProfile.mutateAsync(one(key, value)))}
      onSaveNiche={(nichePrimary, sub) => went(() => saveProfile.mutateAsync({ niche_primary: nichePrimary, niche_sub: sub }))}
      onSaveGoal={(value) => went(() => saveProfile.mutateAsync({ primary_goal: value }))}
      onSaveName={(name) => went(() => saveName.mutateAsync(name))}
      onPhoto={async (file) => {
        try {
          await upload.mutateAsync(file);
          return null;
        } catch (error) {
          return photoMessage(error);
        }
      }}
      onConnect={async (platform, handle) => {
        try {
          await connect.mutateAsync({ platform, handle });
          return null;
        } catch (error) {
          return error instanceof Error && error.message ? error.message : CONNECT_FAILED;
        }
      }}
    />
  );
}
