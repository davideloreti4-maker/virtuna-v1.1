"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import type { PaidPlanId } from "@/lib/pricing";
import type { PlanView } from "@/lib/settings/plan-view";
import { cn } from "@/lib/utils";

import { PlansSheet } from "./plans-sheet";
import {
  MANAGE,
  MANAGE_LINE,
  METER_LABEL,
  NO_PLAN,
  PLAN_FAILED,
  PLAN_PILL,
  SEE_PLANS,
  TRY_AGAIN,
  UPDATE_ON_WHOP,
  creditsLine,
  creditsNote,
  opensWhop,
  planLine,
} from "./settings-words";

/**
 * The Plan card (spec 2026-11-26-settings-design 2.1; drawing frames 1 to 4 and 6), presentational:
 * the plan's name with its quiet pill, one line, the credits with their meter, and the one way on.
 *
 *   a plan that runs        Creator [Active] · the line · credits, meter · Manage on Whop (a link, new tab)
 *   payment failed          the line in ink, "Update on Whop" (the ink button, a link), the credits' words
 *   no plan                 "No plan" · the line · See plans (opens the sheet of plans)
 *   loading                 the card's outline, busy, no words: "No plan" and a way to buy never flash
 *   the read failed         "Couldn't load your plan." and Try again
 *
 * Nothing is in colour: the meter is ink on a quiet track at any level, and payment failed is said in
 * ink and weight. A running plan is changed, paid and cancelled on Whop; See plans exists only with no
 * plan (a second checkout would bill twice).
 */
export type PlanRead = { state: "loading" } | { state: "error"; onRetry(): void } | { state: "ready"; view: PlanView };

export interface PlanCardProps {
  plan: PlanRead;
  /** Whop's page of the visitor's memberships. */
  manageHref: string;
  onStartPlan(planId: PaidPlanId, trial: boolean): void;
}

/** You's card of rows: 18 at the sides, 4 above and below; rows split by hairlines. */
const LIST_CARD = "px-[18px] py-1";
/** The plan's name: 20 at 720 (spec 2.1). */
const NAME = "text-xl font-[720] leading-7 tracking-[-0.02em] text-foreground";
const LINE = "mt-1 text-ui text-foreground-secondary";
/** Payment failed: the one urgent line, said in ink at 600 (spec 2.1), never in colour. */
const URGENT = "mt-1 text-ui font-semibold text-foreground";
const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

const focusDropped = () => {
  const active = document.activeElement;
  return !active || active === document.body;
};

/** "312 of 500 credits left" and, at the right, when they reset or end. */
function CreditsWords({ line, note, className }: { line: string; note: string | null; className: string }) {
  return (
    <p className={cn("flex flex-wrap items-baseline justify-between gap-x-3 text-ui text-foreground", className)}>
      <span className="font-[560]">{line}</span>
      {note && <span className="text-foreground-secondary">{note}</span>}
    </p>
  );
}

function Ready({ view, manageHref, onStartPlan }: { view: PlanView; manageHref: string; onStartPlan: PlanCardProps["onStartPlan"] }) {
  const lineId = useId();
  const [plansOpen, setPlansOpen] = useState(false);
  const seePlansRef = useRef<HTMLButtonElement>(null);

  if (view.kind === "none") {
    return (
      <>
        <div className="py-3.5">
          <p className={NAME}>{NO_PLAN}</p>
          <p className={LINE}>{planLine(view)}</p>
          <Button
            ref={seePlansRef}
            type="button"
            variant="primary"
            size="lg"
            aria-haspopup="dialog"
            onClick={() => setPlansOpen(true)}
            className="mt-3.5 w-full next:rounded-full"
          >
            {SEE_PLANS}
          </Button>
        </div>
        <PlansSheet
          open={plansOpen}
          onOpenChange={setPlansOpen}
          trialAvailable={view.trialAvailable}
          onStartPlan={onStartPlan}
          returnFocus={() => seePlansRef.current}
        />
      </>
    );
  }

  const pastDue = view.state === "pastDue";
  const credits = creditsLine(view);
  const note = creditsNote(view);
  const pool = typeof view.credits === "object" ? view.credits : null;
  const left = pool ? Math.min(Math.max(pool.left, 0), pool.limit) : 0;

  return (
    <div className="divide-y divide-border">
      <div className="py-3.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={NAME}>{view.name}</span>
          <Badge className="shrink-0">{PLAN_PILL[view.state]}</Badge>
        </p>
        <p className={pastDue ? URGENT : LINE}>{planLine(view)}</p>
        {pastDue ? (
          <Button asChild variant="primary" size="lg" className="mt-3 w-full gap-2 next:rounded-full">
            <a href={manageHref} {...NEW_TAB} aria-label={opensWhop(UPDATE_ON_WHOP)}>
              {UPDATE_ON_WHOP}
              <ArrowSquareOut size={18} aria-hidden />
            </a>
          </Button>
        ) : (
          credits && (
            <>
              <CreditsWords line={credits} note={note} className="mt-3.5" />
              {pool && (
                <div
                  role="meter"
                  aria-label={METER_LABEL}
                  aria-valuemin={0}
                  aria-valuemax={pool.limit}
                  aria-valuenow={left}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                >
                  <div className="h-full rounded-full bg-foreground" style={{ width: `${pool.limit > 0 ? (left / pool.limit) * 100 : 0}%` }} />
                </div>
              )}
            </>
          )
        )}
      </div>
      {/* Payment failed: the button above is the way, so no row; the credits stay in words, with no meter. */}
      {pastDue && credits && <CreditsWords line={credits} note={note} className="py-3.5" />}
      {!pastDue && (
        <a href={manageHref} {...NEW_TAB} aria-label={opensWhop(MANAGE)} aria-describedby={lineId} className="flex min-h-16 items-center gap-3 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-title font-[640] text-foreground">{MANAGE}</span>
            <span id={lineId} className="mt-0.5 block text-ui text-foreground-secondary">
              {MANAGE_LINE}
            </span>
          </span>
          <ArrowSquareOut size={18} aria-hidden className="shrink-0 text-foreground-muted" />
        </a>
      )}
    </div>
  );
}

export function PlanCard({ plan, manageHref, onStartPlan }: PlanCardProps): React.JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null);
  // "Try again" goes with the failure it stood in: once the card has a control again (the plan's, or
  // Try again after a second failure), a focus fallen to the page goes to it.
  const retried = useRef(false);
  useLayoutEffect(() => {
    if (!retried.current) return;
    if (!focusDropped()) {
      retried.current = false;
      return;
    }
    const control = cardRef.current?.querySelector<HTMLElement>("a[href], button");
    if (!control) return;
    retried.current = false;
    control.focus();
  }, [plan.state]);

  if (plan.state === "loading") {
    return <Card ref={cardRef} aria-busy="true" data-plan="loading" className="h-[152px]" />;
  }
  if (plan.state === "error") {
    return (
      <Card ref={cardRef} data-plan="error" className="p-[18px]">
        <p role="alert" className="text-ui text-foreground">
          {PLAN_FAILED}
        </p>
        <Chip
          surface="card"
          onClick={() => {
            retried.current = true;
            plan.onRetry();
          }}
          className="mt-3"
        >
          {TRY_AGAIN}
        </Chip>
      </Card>
    );
  }
  return (
    <Card ref={cardRef} data-plan="ready" className={LIST_CARD}>
      <Ready view={plan.view} manageHref={manageHref} onStartPlan={onStartPlan} />
    </Card>
  );
}
