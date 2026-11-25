"use client";

import { useState } from "react";

import { initialsOf } from "@/components/home-next/greeting";
import { AccountMenu } from "@/components/you-next/account-menu";
import { YouScreen, type RowId, type YouAccountRow } from "@/components/you-next/you-screen";
import { YouSignUp } from "@/components/you-next/you-sign-up";
import { SAVE_FAILED, accountLine, readFoot, whoLine, type GoalValue } from "@/components/you-next/you-words";
import { withAccountAction, type AccountAction } from "@/hooks/queries/use-you";
import type { YouFactKey } from "@/lib/you/facts";
import type { YouAccount } from "@/lib/you/you-read";

/**
 * You on local state, for /dev/you (`page.tsx`). A made-up creator; saves answer after 400 ms, and
 * nothing is sent. An account carries no sync time (rulings 4 and 10): its row's line is the
 * platform's name. An account's More changes the local accounts at once, by the server's rules
 * (`withAccountAction`); in `failed` the change is refused after 400 ms and goes back, with the line.
 */
export type DevYouState =
  | "loading"
  | "empty"
  | "full"
  | "no-account"
  | "read"
  | "not-read"
  | "read-no-account"
  | "open"
  | "failed"
  | "signup";

const NONE: Record<YouFactKey, string | null> = { about: null, sells: null, writing_voice_description: null, can_film: null, never_do: null };
const TOLD: Record<YouFactKey, string | null> = {
  about: "Nursing student, cook for four flatmates on $40 a week.",
  sells: "A 12-week meal plan, $19. Affiliate for one blender brand.",
  writing_voice_description: 'Dry, short sentences, a bit of swearing. Never say "guys".',
  can_film: "Phone only, my kitchen, on camera. Cuts, no effects.",
  never_do: "No before/after bodies. No giveaways. No naming other creators.",
};
const DAY = 86_400_000;

const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 400));

export function DevYou({ state }: { state: DevYouState }) {
  if (state === "signup") return <YouSignUp />;
  return <DevYouScreen state={state} />;
}

function DevYouScreen({ state }: { state: Exclude<DevYouState, "signup"> }) {
  const told = state === "full" || state === "no-account" || state === "read-no-account" || state === "failed";
  const accountsFor = (): YouAccount[] => {
    if (state === "full" || state === "failed") {
      return [
        { id: "dev-a1", platform: "tiktok", handle: "nia.tests", primary: true },
        { id: "dev-a2", platform: "instagram", handle: "nia.tests.kitchen", primary: false },
      ];
    }
    if (state === "read" || state === "not-read") return [{ id: "dev-a1", platform: "tiktok", handle: "nia.tests", primary: true }];
    return [];
  };
  // read-no-account: the read of an account since disconnected (ruling 11).
  const hasRead = state === "full" || state === "failed" || state === "read" || state === "read-no-account";

  const [now] = useState(() => Date.now());
  const [facts, setFacts] = useState(told ? TOLD : NONE);
  const [niche, setNiche] = useState<{ primary: string | null; sub: string | null }>(
    told ? { primary: "food-cooking", sub: "meal-prep" } : { primary: null, sub: null },
  );
  const [goal, setGoal] = useState<GoalValue | null>(told ? "conversion" : null);
  const [name, setName] = useState("Nia Test");
  const [accounts, setAccounts] = useState<YouAccount[]>(accountsFor);
  const [notice, setNotice] = useState<string | null>(null);
  const refuse = state === "failed";
  const accountAction = (action: AccountAction) => {
    setNotice(null);
    const before = accounts;
    setAccounts((list) => withAccountAction({ accounts: list, followers: null, read: null }, action).accounts);
    if (!refuse) return;
    void wait(null).then(() => {
      setAccounts(before);
      setNotice(SAVE_FAILED);
    });
  };
  const primary = accounts.find((a) => a.primary) ?? null;
  const rows: YouAccountRow[] = accounts.map((a) => ({ id: a.id, platform: a.platform, handle: a.handle, primary: a.primary, line: accountLine(a.platform) }));
  const initial: { open: RowId; draft?: string; failed?: boolean } | undefined =
    state === "open"
      ? { open: "writing_voice_description", draft: 'Dry, short sentences, a bit of swearing. Never say "guys".' }
      : state === "failed"
        ? { open: "sells", draft: "A 12-week meal plan, $19. Two blender brands.", failed: true }
        : undefined;

  return (
    <YouScreen
      state={state === "loading" ? "loading" : "ready"}
      onRetry={() => {}}
      who={{ name, initials: initialsOf(name), avatar: null, line: whoLine(primary, primary ? 12_400 : null) }}
      read={
        hasRead
          ? {
              what: "Budget meal prep for students, filmed in a dorm kitchen.",
              how: "Fast, friendly, talks straight to camera. Quick cuts, price on screen. Avoids long intros and anything that needs an oven.",
              foot: readFoot("nia.tests", new Date(now - 3 * DAY).toISOString()),
            }
          : null
      }
      facts={facts}
      niche={niche}
      goal={goal}
      accounts={rows}
      accountsState="ready"
      accountsNotice={notice}
      onRetryAccounts={() => {}}
      renderAccountMenu={(a) => (
        <AccountMenu
          handle={a.handle}
          primary={a.primary}
          onMakePrimary={() => accountAction({ kind: "primary", id: a.id })}
          onDisconnect={() => accountAction({ kind: "disconnect", id: a.id })}
        />
      )}
      onSaveFact={async (key, value) => {
        if (!(await wait(!refuse))) return false;
        setFacts((f) => ({ ...f, [key]: value }));
        return true;
      }}
      onSaveNiche={async (p, s) => {
        if (!(await wait(!refuse))) return false;
        setNiche({ primary: p, sub: s });
        return true;
      }}
      onSaveGoal={async (g) => {
        if (!(await wait(!refuse))) return false;
        setGoal(g);
        return true;
      }}
      onSaveName={async (n) => {
        if (!(await wait(!refuse))) return false;
        setName(n);
        return true;
      }}
      onPhoto={() => wait("File too large. Maximum size is 2MB.")}
      onConnect={async (platform, handle) => {
        await wait(null);
        setAccounts((list) => [...list, { id: `dev-${platform}-${handle}`, platform, handle: handle.toLowerCase(), primary: list.length === 0 }]);
        return null;
      }}
      initial={initial}
    />
  );
}
