"use client";

import Link from "next/link";
import * as React from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import type { Platform } from "@/lib/connected-accounts/connected-accounts-repo";
import type { YouFactKey } from "@/lib/you/facts";
import { cn } from "@/lib/utils";

import { ConnectRow } from "./connect-row";
import { FactRow } from "./fact-row";
import { GoalRow } from "./goal-row";
import { NicheRow } from "./niche-row";
import { PILL, SettingsRow } from "./row-parts";
import { WhoBlock } from "./who-block";
import {
  ACCOUNTS_FAILED,
  CONNECT_LINE,
  CONNECT_OFFLINE,
  FACTS,
  LOAD_FAILED,
  PLATFORM_MARKS,
  READ_HINT,
  SAVE_FAILED,
  SET_UP_AUDIENCE,
  type GoalValue,
  nicheLabel,
  notReadLine,
} from "./you-words";

/**
 * You (spec 2026-11-24 §3; the drawing `.scratch/next-look/part-you/drawing/you-drawing.png`),
 * presentational: who, what Maven read, seven rows in the creator's words, the accounts, Settings.
 * It sends nothing; the container's handlers save and say whether it went through. Which row is open,
 * the drafts and the busy/failed marks are this screen's own state.
 *
 * "From your account" has three states (rulings 5 and 11): a read → the read card, with the read's
 * own handle and time, whatever the accounts are; no read and no account → the card "Connect your
 * account" (no heading); no read and an account → "Maven hasn't read @{primary} yet…" with one link,
 * "Set up audience". While the accounts did not load, none of the last two is offered.
 *
 * The connect form (`ConnectRow`) opens in place, in one place at a time (the drawing's
 * middle phone): with an account, as the Accounts card's last row; with no account and nothing read,
 * inside the "Connect your account" card, and there is no Accounts section; with a read and no
 * account, in one quiet row under the cards, and no Accounts section either. While the accounts did
 * not load, the Accounts card holds the failure and nowhere offers a connect.
 */

export type RowId = "who" | "niche" | YouFactKey | "goal" | "connect";

export interface YouAccountRow {
  id: string;
  platform: Platform;
  handle: string;
  primary: boolean;
  /** "TikTok": the platform's name (`accountLine`, rulings 4 and 10). */
  line: string;
}

export interface YouScreenProps {
  state: "loading" | "ready" | "error";
  onRetry(): void;
  /**
   * `unnamed`: no saved name, so `name` is a stand-in (the email). The name field then opens empty,
   * with the stand-in as its placeholder, and an empty name is not sent.
   */
  who: { name: string; unnamed?: boolean; initials: string; avatar: string | null; line: string };
  /** null: nothing read. Then, with the accounts loaded: no account → the connect card; an account → the not-read card. */
  read: { what: string | null; how: string | null; foot: string | null } | null;
  facts: Record<YouFactKey, string | null>;
  niche: { primary: string | null; sub: string | null };
  goal: GoalValue | null;
  /** The one source of "has an account" (with `accountsState`): empty and "ready" is no account. */
  accounts: YouAccountRow[];
  accountsState: "ready" | "error";
  /** A refused Make primary or Disconnect, under the Accounts card. */
  accountsNotice: string | null;
  onRetryAccounts(): void;
  /**
   * Each resolves true when the save went through, false when it was refused. One may also reject (a
   * dropped request): the screen takes that as not gone through, the same as false. The page is let
   * go, and the row stays open with its text and "Couldn't save. Try again."
   */
  onSaveFact(key: YouFactKey, value: string | null): Promise<boolean>;
  onSaveNiche(primary: string, sub: string | null): Promise<boolean>;
  onSaveGoal(goal: GoalValue): Promise<boolean>;
  onSaveName(name: string): Promise<boolean>;
  /** null when the photo was taken, else the line to show. If it rejects, the line is "Couldn't save. Try again." and Change photo works again. */
  onPhoto(file: File): Promise<string | null>;
  /** null when the account connected, else the line to show. If it rejects, the line is `CONNECT_OFFLINE` and the form stays open with its handle. */
  onConnect(platform: Platform, handle: string): Promise<string | null>;
  /** The More of an account row; absent, the row has none. */
  renderAccountMenu?(account: YouAccountRow): React.ReactNode;
  /** /dev/you and tests: a row open on arrival, with a draft and, with `failed`, the failed save's line. */
  initial?: { open: RowId; draft?: string; failed?: boolean };
}

/** The global `h1` tracking is unlayered and beats a utility: inline. */
const HEADING_STYLE: React.CSSProperties = { letterSpacing: "-0.035em" };
/** The drawing's `.lab`: 15 at 650 (640 here), 18 above, 8 below. */
const SECTION_HEADING = "mb-2 mt-[18px] px-1 text-ui font-[640] text-foreground";
/** The drawing's `.card` of rows: 24 radius, 18 at the sides, 4 above and below; rows split by hairlines. */
const LIST_CARD = "px-[18px] py-1";
const PLACEHOLDER = "rounded-3xl bg-surface shadow-[var(--shadow-rest)]";

/** The focus fell to the page: the control that held it is gone. Only then does the screen move it. */
const focusDropped = () => {
  const active = document.activeElement;
  return !active || active === document.body;
};

/**
 * The column. The phone's pushed header (the shell) names the screen; from 768 the page's own
 * heading does, so one `h1` is shown at each width. Desktop: 44 above the heading, 18 under it to the
 * avatar (8 here, 10 in Who's button).
 */
function Frame({ busy, children }: { busy?: boolean; children: React.ReactNode }) {
  return (
    <div data-testid="you-next" className="flex w-full flex-1 flex-col">
      <div aria-busy={busy || undefined} className="mx-auto flex w-full max-w-[720px] flex-col px-4 pb-12 pt-1 md:pb-16 md:pt-11">
        <h1 className="hidden pb-2 text-3xl font-bold leading-[35px] text-foreground md:block" style={HEADING_STYLE}>
          You
        </h1>
        {children}
      </div>
    </div>
  );
}

function Placeholders() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading
      </p>
      <div aria-hidden className="mb-2 flex items-center gap-3.5 px-1 py-2.5">
        <span className="size-14 shrink-0 rounded-full bg-surface-sunken" />
        <span className="flex flex-col gap-2">
          <span className="h-5 w-40 rounded-full bg-surface-sunken" />
          <span className="h-4 w-52 rounded-full bg-surface-sunken" />
        </span>
      </div>
      <div aria-hidden className={cn("mt-[18px] h-36", PLACEHOLDER)} />
      <div aria-hidden className={cn("mt-[18px] h-[452px]", PLACEHOLDER)} />
      <div aria-hidden className={cn("mt-[18px] h-[150px]", PLACEHOLDER)} />
    </>
  );
}

export function YouScreen(props: YouScreenProps): React.JSX.Element {
  usePushedTitle("You");
  // "Try again" on a page that did not load: once it loads, the focus (gone with the button) goes to
  // its first control.
  const [retried, setRetried] = useState(false);
  if (props.state === "loading") {
    return (
      <Frame busy>
        <Placeholders />
      </Frame>
    );
  }
  if (props.state === "error") {
    return (
      <Frame>
        <Card className="p-[18px] md:mt-2.5">
          <p role="alert" className="text-ui text-foreground">
            {LOAD_FAILED}
          </p>
          <Chip
            surface="card"
            onClick={() => {
              setRetried(true);
              props.onRetry();
            }}
            className="mt-3"
          >
            Try again
          </Chip>
        </Card>
      </Frame>
    );
  }
  return <Ready {...props} retried={retried} />;
}

/** The drawing's account `.row`: the platform's tile, @handle (and Primary), the platform's name, More. */
function AccountRow({ account, menu }: { account: YouAccountRow; menu: React.ReactNode }) {
  return (
    <div className="flex min-h-16 items-center gap-3 py-3.5">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-meta font-bold text-foreground">
        {PLATFORM_MARKS[account.platform]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-title font-[640] text-foreground">@{account.handle}</span>
          {account.primary && <Badge className="shrink-0">Primary</Badge>}
        </span>
        <span className="block truncate text-ui text-foreground-secondary">{account.line}</span>
      </span>
      {menu}
    </div>
  );
}

/** A card of one line and one action: "Connect your account" and the not-read card (drawing `.connect`). */
function LineCard({ line, children }: { line: string; children: React.ReactNode }) {
  return (
    <Card className="p-[18px]">
      <p className="text-title font-[430] text-foreground">{line}</p>
      <div className="mt-3.5">{children}</div>
    </Card>
  );
}

function Ready(props: YouScreenProps & { retried: boolean }) {
  const { who, read, facts, niche, goal, accounts, accountsState, accountsNotice, initial, retried } = props;
  const readId = useId();
  const wordsId = useId();
  const accountsId = useId();

  const [open, setOpen] = useState<RowId | null>(initial?.open ?? null);
  const [drafts, setDrafts] = useState<Partial<Record<RowId, string>>>(() =>
    initial?.draft !== undefined ? ({ [initial.open]: initial.draft } as Partial<Record<RowId, string>>) : {},
  );
  const [busy, setBusy] = useState<RowId | null>(null);
  // A refused save's mark, per row, kept with its draft until that row saves, tries again or is cancelled.
  const [failed, setFailed] = useState<Partial<Record<RowId, true>>>(() => (initial?.failed ? { [initial.open]: true } : {}));
  const markFailed = (id: RowId, on: boolean) =>
    setFailed((f) => {
      const next = { ...f };
      if (on) next[id] = true;
      else delete next[id];
      return next;
    });
  const isFailed = (id: RowId) => failed[id] === true;
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [connectError, setConnectError] = useState<string | null>(null);
  // A connect in flight holds its own form only (the scrape can take minutes): the form's field and
  // buttons wait and no second connect starts, while every other row opens, saves and cancels.
  const [connecting, setConnecting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const buttons = useRef(new Map<RowId, HTMLButtonElement>());
  const returnTo = useRef<RowId | null>(null);
  // The open row as of the last render, for a connect that answers after another row was opened.
  const openNow = useRef(open);
  useLayoutEffect(() => {
    openNow.current = open;
  }, [open]);
  const refFor = (id: RowId) => (el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(id, el);
    else buttons.current.delete(id);
  };

  // A closed row's button is drawn again by the time this runs: the focus goes back to it.
  useLayoutEffect(() => {
    const id = returnTo.current;
    if (open !== null || id === null) return;
    returnTo.current = null;
    buttons.current.get(id)?.focus();
  }, [open]);

  // Arrived from "Try again" on a page that did not load: the focus went with that button.
  useLayoutEffect(() => {
    if (retried && focusDropped()) buttons.current.get("who")?.focus();
  }, [retried]);

  // The accounts changed under the focus: an account that left took its More with it, or the first
  // one arrived and the card whose Connect held the focus went. A focus fallen to the page goes to the
  // connect control the page now has ("Connect an account", or the card's Connect when none is left).
  const count = accounts.length;
  const lastCount = useRef(count);
  useLayoutEffect(() => {
    const changed = count !== lastCount.current;
    lastCount.current = count;
    if (changed && focusDropped()) buttons.current.get("connect")?.focus();
  }, [count]);

  // The accounts loaded on "Try again": the list took the button's place, and the focus with it.
  const lastAccountsState = useRef(accountsState);
  useLayoutEffect(() => {
    const was = lastAccountsState.current;
    lastAccountsState.current = accountsState;
    if (was === "error" && accountsState === "ready" && focusDropped()) buttons.current.get("connect")?.focus();
  }, [accountsState]);

  const savedText = (id: RowId): string =>
    id === "who" ? (who.unnamed ? "" : who.name) : id === "niche" || id === "goal" || id === "connect" ? "" : (facts[id] ?? "");
  const draftOf = (id: RowId) => drafts[id] ?? savedText(id);
  const setDraft = (id: RowId) => (text: string) => setDrafts((d) => ({ ...d, [id]: text }));

  // Opening a row keeps every other row's draft and failure: they come back with it.
  const openRow = (id: RowId) => {
    if (busy !== null) return; // a save in flight holds the page (a connect holds only its form)
    setOpen(id);
  };
  // A row's draft and failure go (for connect, the platform and the message; for Who, the photo's line).
  const forget = (id: RowId) => {
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    markFailed(id, false);
    if (id === "connect") {
      setPlatform("tiktok");
      setConnectError(null);
    }
    if (id === "who") setPhotoError(null);
  };
  // A row saved or cancelled: it forgets, closes, and the focus goes back to its button.
  const close = (id: RowId) => {
    forget(id);
    returnTo.current = id;
    setOpen(null);
  };
  const cancel = (id: RowId) => () => {
    if (busy !== null || (id === "connect" && connecting)) return;
    close(id);
  };
  // A rejection (a dropped request) is a save that did not go through: the page is let go either way.
  const run = async (id: RowId, send: () => Promise<boolean>) => {
    if (busy !== null) return;
    setBusy(id);
    markFailed(id, false);
    let ok = false;
    try {
      ok = await send();
    } catch {
      ok = false;
    } finally {
      setBusy(null);
    }
    if (ok) close(id);
    else markFailed(id, true);
  };

  const saveFact = (key: YouFactKey) => {
    const text = draftOf(key).trim();
    const next = text === "" ? null : text;
    if (next === (facts[key] ?? null)) {
      close(key);
      return;
    }
    void run(key, () => props.onSaveFact(key, next));
  };
  const saveName = () => {
    const name = draftOf("who").trim();
    if (!name) return;
    if (name === savedText("who")) {
      close("who");
      return;
    }
    void run("who", () => props.onSaveName(name));
  };
  const pickNiche = (primary: string, sub: string | null) => {
    if (primary === niche.primary && sub === (niche.sub ?? null)) {
      close("niche");
      return;
    }
    void run("niche", () => props.onSaveNiche(primary, sub));
  };
  const pickGoal = (value: GoalValue) => void run("goal", () => props.onSaveGoal(value));
  const takePhoto = async (file: File) => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    let error: string | null;
    try {
      error = await props.onPhoto(file);
    } catch {
      error = SAVE_FAILED;
    } finally {
      setPhotoBusy(false);
    }
    setPhotoError(error);
  };
  const connect = async () => {
    const handle = draftOf("connect").replace(/^@/, "").trim();
    if (!handle || connecting) return;
    setConnecting(true);
    setConnectError(null);
    let error: string | null;
    try {
      error = await props.onConnect(platform, handle);
    } catch {
      error = CONNECT_OFFLINE;
    } finally {
      setConnecting(false);
    }
    // A refusal stays with the form (open now, or when it opens again). A connect that went through
    // closes the form if it is still the open row; if another row was opened meanwhile, that row
    // stays as it is and the form only forgets its handle.
    if (error !== null) setConnectError(error);
    else if (openNow.current === "connect") close("connect");
    else forget("connect");
  };

  // "Has an account", in one place: the accounts list, once it loaded. Where the connect form lives
  // follows from it, one place at a time; without the list, nowhere: nothing is offered blind.
  const hasAccount = accountsState === "ready" && accounts.length > 0;
  const connectAt: "accounts" | "card" | "row" | null = accountsState !== "ready" ? null : hasAccount ? "accounts" : read ? "row" : "card";
  // "From your account" (rulings 5 and 11) under the read: the primary account not read yet.
  const unread = connectAt === "accounts" ? ((accounts.find((a) => a.primary) ?? accounts[0])?.handle ?? null) : null;
  const connectForm = (
    <ConnectRow
      open={open === "connect"}
      platform={platform}
      handle={draftOf("connect")}
      busy={connecting}
      error={connectError}
      onOpen={() => openRow("connect")}
      onPlatform={setPlatform}
      onHandle={setDraft("connect")}
      onConnect={() => void connect()}
      onCancel={cancel("connect")}
      buttonRef={refFor("connect")}
    />
  );

  return (
    <Frame>
      <WhoBlock
        name={who.name}
        initials={who.initials}
        avatar={who.avatar}
        line={who.line}
        open={open === "who"}
        draft={draftOf("who")}
        placeholder={who.unnamed && who.name ? who.name : undefined}
        busy={busy === "who"}
        failed={isFailed("who")}
        photoBusy={photoBusy}
        photoError={photoError}
        onOpen={() => openRow("who")}
        onDraft={setDraft("who")}
        onSave={saveName}
        onCancel={cancel("who")}
        onPhoto={(file) => void takePhoto(file)}
        buttonRef={refFor("who")}
      />

      {read && (
        <section aria-labelledby={readId}>
          <h2 id={readId} className={SECTION_HEADING}>
            From your account
          </h2>
          <Card className="px-[18px] py-4">
            {read.what && <p className="text-title font-[430] text-foreground">{read.what}</p>}
            {read.how && <p className={cn("text-ui text-foreground-secondary", read.what && "mt-2")}>{read.how}</p>}
            {read.foot && <p className="mt-3 text-meta text-foreground-secondary">{read.foot}</p>}
          </Card>
          <p className="mt-2.5 px-1 text-reading text-foreground-secondary">{READ_HINT}</p>
        </section>
      )}
      {!read && unread && (
        <section aria-labelledby={readId}>
          <h2 id={readId} className={SECTION_HEADING}>
            From your account
          </h2>
          <LineCard line={notReadLine(unread)}>
            <Button asChild variant="primary" className={PILL}>
              <Link href="/audience/new">{SET_UP_AUDIENCE}</Link>
            </Button>
          </LineCard>
        </section>
      )}
      {connectAt === "card" &&
        // The drawing's middle phone: straight under Who, no heading. Its Connect opens the form in
        // place, in this card; Cancel and Escape bring the line and Connect back, with the focus.
        (open === "connect" ? (
          <Card className={LIST_CARD}>{connectForm}</Card>
        ) : (
          <LineCard line={CONNECT_LINE}>
            <Button ref={refFor("connect")} type="button" variant="primary" onClick={() => openRow("connect")} className={PILL}>
              Connect
            </Button>
          </LineCard>
        ))}

      <section aria-labelledby={wordsId}>
        <h2 id={wordsId} className={SECTION_HEADING}>
          In your words
        </h2>
        <Card className={LIST_CARD}>
          <ul className="divide-y divide-border">
            <li>
              <NicheRow
                value={nicheLabel(niche.primary, niche.sub)}
                saved={niche}
                open={open === "niche"}
                query={drafts.niche ?? ""}
                busy={busy === "niche"}
                failed={isFailed("niche")}
                onOpen={() => openRow("niche")}
                onQuery={setDraft("niche")}
                onPick={pickNiche}
                onCancel={cancel("niche")}
                buttonRef={refFor("niche")}
              />
            </li>
            {FACTS.map((f) => (
              <li key={f.key}>
                <FactRow
                  label={f.label}
                  value={facts[f.key]}
                  open={open === f.key}
                  draft={draftOf(f.key)}
                  limit={f.limit}
                  placeholder={f.placeholder}
                  hint={f.hint}
                  busy={busy === f.key}
                  failed={isFailed(f.key)}
                  onOpen={() => openRow(f.key)}
                  onDraft={setDraft(f.key)}
                  onSave={() => saveFact(f.key)}
                  onCancel={cancel(f.key)}
                  buttonRef={refFor(f.key)}
                />
              </li>
            ))}
            <li>
              <GoalRow
                goal={goal}
                open={open === "goal"}
                busy={busy === "goal"}
                failed={isFailed("goal")}
                onOpen={() => openRow("goal")}
                onPick={pickGoal}
                onCancel={cancel("goal")}
                buttonRef={refFor("goal")}
              />
            </li>
          </ul>
        </Card>
      </section>

      {(connectAt === "accounts" || accountsState === "error") && (
        <section aria-labelledby={accountsId}>
          <h2 id={accountsId} className={SECTION_HEADING}>
            Accounts
          </h2>
          <Card className={LIST_CARD}>
            {accountsState === "error" ? (
              <div className="py-3.5">
                <p className="text-ui text-foreground">{ACCOUNTS_FAILED}</p>
                <Chip surface="card" onClick={props.onRetryAccounts} className="mt-3">
                  Try again
                </Chip>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <AccountRow account={a} menu={props.renderAccountMenu?.(a)} />
                  </li>
                ))}
                <li>{connectForm}</li>
              </ul>
            )}
          </Card>
        </section>
      )}
      {connectAt === "row" && (
        // A read and no account (every account disconnected): no Accounts section, one quiet row so
        // there is still a way back in.
        <Card className={cn("mt-[18px]", LIST_CARD)}>{connectForm}</Card>
      )}
      {/* Under the Accounts card. Kept in the page (and shown, empty) so a notice is announced when it comes. */}
      <p role="status" className={cn("px-1 text-meta font-[560] text-foreground", accountsNotice && "mt-2")}>
        {accountsNotice}
      </p>

      <SettingsRow earn />
    </Frame>
  );
}
