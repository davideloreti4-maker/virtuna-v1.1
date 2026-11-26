"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { SignOut } from "@phosphor-icons/react";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { Card } from "@/components/ui/card";
import { RowButton } from "@/components/you-next/row-parts";
import type { PaidPlanId } from "@/lib/pricing";
import type { ThemeChoice } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

import { AppearanceRow } from "./appearance-row";
import { DeleteSheet, type DeleteResult } from "./delete-sheet";
import { PasswordRow } from "./password-row";
import { PlanCard, type PlanRead } from "./plan-card";
import {
  ACCOUNT_LABEL,
  DELETE_ACCOUNT,
  DELETE_ROW_LINE,
  EMAIL,
  LICENCE,
  LOG_OUT,
  PASSWORD_FAILED,
  PLAN_LABEL,
  TITLE,
  emailLine,
} from "./settings-words";

/**
 * Settings under the new look (spec docs/superpowers/specs/2026-11-26-settings-design.md, section 2;
 * the drawing `.scratch/next-look/part9/settings/settings-drawing.png`), presentational: a lean page
 * of rows in You's style. Top to bottom: Plan (its card), Appearance, Account (email, password, log
 * out), Delete account set apart, and the licence credit. It sends nothing: the container's handlers
 * do, and say what happened. Which row is open, the password's save and the sheets are this screen's
 * own state.
 *
 * - One row open at a time (Appearance or Password), as on You: opening one closes the other; a row
 *   that closes hands the focus back to its button. A password on its way holds both.
 * - The page does not wait for the plan: while it loads, or when its read failed, only the Plan card
 *   says so. Delete account then opens on the confirm, and the server decides.
 * - Nothing is in colour.
 */
export type PasswordResult = "saved" | { error: string }; // the container maps errors to words
export type { DeleteResult, PlanRead };

export interface SettingsScreenProps {
  /** `{ state: "loading" } | { state: "error"; onRetry(): void } | { state: "ready"; view: PlanView }`. */
  plan: PlanRead;
  /** The account's email; null: none. `google`: the account signs in with Google. */
  account: { email: string | null; google: boolean };
  theme: ThemeChoice; // "light" | "dark" | "system"
  onTheme(choice: ThemeChoice): void;
  onPassword(password: string): Promise<PasswordResult>;
  onLogOut(): void;
  /** Opens Whop's checkout for a plan (the container mounts CheckoutModal). */
  onStartPlan(planId: PaidPlanId, trial: boolean): void;
  onDelete(): Promise<DeleteResult>;
  /** Called when the delete sheet asks the plan to be read again (page shown again). */
  onRecheckPlan(): void;
  manageHref: string; // "https://whop.com/hub/memberships"
}

type OpenRow = "appearance" | "password";
type RowId = OpenRow | "delete";

/** The global `h1` tracking is unlayered and beats a utility: inline (as You's heading). */
const HEADING_STYLE: React.CSSProperties = { letterSpacing: "-0.035em" };
/** You's section label: 15 at 640, 18 above, 8 below. */
const SECTION_HEADING = "mb-2 mt-[18px] px-1 text-ui font-[640] text-foreground";
/** You's card of rows: 24 radius, 18 at the sides, 4 above and below; rows split by hairlines. */
const LIST_CARD = "px-[18px] py-1";
const FOOT_LINK = "underline underline-offset-2";

export function SettingsScreen(props: SettingsScreenProps): React.JSX.Element {
  usePushedTitle(TITLE);
  const { plan, account, theme, manageHref } = props;
  const planId = useId();
  const accountId = useId();

  const [open, setOpen] = useState<OpenRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const buttons = useRef(new Map<RowId, HTMLButtonElement>());
  const returnTo = useRef<OpenRow | null>(null);
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

  // Opening a row closes the other; what the password row held (its fields, a refusal) goes with it.
  const openRow = (id: OpenRow) => {
    if (saving) return; // a save in flight holds the page
    setPasswordError(null);
    setOpen(id);
  };
  // A row saved, chosen or cancelled: it closes, and the focus goes back to its button.
  const close = (id: OpenRow) => {
    if (id === "password") setPasswordError(null);
    returnTo.current = id;
    setOpen(null);
  };
  const cancel = (id: OpenRow) => () => {
    if (!saving) close(id);
  };
  // A rejection (a dropped request) is a save that did not go through.
  const savePassword = async (password: string) => {
    if (saving) return;
    setSaving(true);
    setPasswordError(null);
    let result: PasswordResult;
    try {
      result = await props.onPassword(password);
    } catch {
      result = { error: PASSWORD_FAILED };
    } finally {
      setSaving(false);
    }
    if (result === "saved") {
      setPasswordSaved(true);
      close("password");
    } else {
      setPasswordError(result.error);
    }
  };

  return (
    <div data-testid="settings-next" className="flex w-full flex-1 flex-col">
      {/* The column, as You's: the phone's pushed header names the screen; from 768 the page's own heading does. */}
      <div className="mx-auto flex w-full max-w-[720px] flex-col px-4 pb-12 pt-1 md:pb-16 md:pt-11">
        <h1 className="hidden pb-2 text-3xl font-bold leading-[35px] text-foreground md:block" style={HEADING_STYLE}>
          {TITLE}
        </h1>

        <section aria-labelledby={planId}>
          {/* The first label: 18 under the heading from 768 (8 there, 10 here), as You's first block. */}
          <h2 id={planId} className={cn(SECTION_HEADING, "mt-2.5")}>
            {PLAN_LABEL}
          </h2>
          <PlanCard plan={plan} manageHref={manageHref} onStartPlan={props.onStartPlan} />
        </section>

        <Card className={cn("mt-[18px]", LIST_CARD)}>
          <AppearanceRow
            theme={theme}
            open={open === "appearance"}
            onOpen={() => openRow("appearance")}
            onPick={(choice) => {
              props.onTheme(choice);
              close("appearance");
            }}
            onCancel={cancel("appearance")}
            buttonRef={refFor("appearance")}
          />
        </Card>

        <section aria-labelledby={accountId}>
          <h2 id={accountId} className={SECTION_HEADING}>
            {ACCOUNT_LABEL}
          </h2>
          <Card className={LIST_CARD}>
            <ul className="divide-y divide-border">
              {account.email && (
                <li className="flex min-h-16 flex-col justify-center py-3.5">
                  <p className="text-title font-[640] text-foreground">{EMAIL}</p>
                  <p className="mt-0.5 text-ui text-foreground-secondary [overflow-wrap:anywhere]">{emailLine(account.email, account.google)}</p>
                </li>
              )}
              <li>
                <PasswordRow
                  open={open === "password"}
                  saved={passwordSaved}
                  busy={saving}
                  error={passwordError}
                  onOpen={() => openRow("password")}
                  onSave={(password) => void savePassword(password)}
                  onCancel={cancel("password")}
                  buttonRef={refFor("password")}
                />
              </li>
              <li>
                <button type="button" onClick={props.onLogOut} className="flex min-h-16 w-full items-center gap-3 py-3.5 text-left">
                  <span className="flex-1 text-title font-[640] text-foreground">{LOG_OUT}</span>
                  <SignOut size={18} aria-hidden className="shrink-0 text-foreground-muted" />
                </button>
              </li>
            </ul>
          </Card>
        </section>

        {/* Set apart: 28 above. */}
        <Card className={cn("mt-7", LIST_CARD)}>
          <RowButton label={DELETE_ACCOUNT} value={DELETE_ROW_LINE} onOpen={() => setDeleteOpen(true)} buttonRef={refFor("delete")} />
        </Card>

        <p className="mt-5 px-1.5 text-meta text-foreground-muted">
          {LICENCE.lead}
          <a href={LICENCE.work.href} target="_blank" rel="noopener noreferrer" className={FOOT_LINK}>
            {LICENCE.work.text}
          </a>
          {LICENCE.by}
          <a href={LICENCE.author.href} target="_blank" rel="noopener noreferrer" className={FOOT_LINK}>
            {LICENCE.author.text}
          </a>
          {LICENCE.under}
          <a href={LICENCE.licence.href} target="_blank" rel="noopener noreferrer" className={FOOT_LINK}>
            {LICENCE.licence.text}
          </a>
          {LICENCE.end}
        </p>
      </div>

      <DeleteSheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        view={plan.state === "ready" ? plan.view : null}
        email={account.email}
        manageHref={manageHref}
        onDelete={props.onDelete}
        onRecheckPlan={props.onRecheckPlan}
        returnFocus={() => buttons.current.get("delete") ?? null}
      />
    </div>
  );
}
