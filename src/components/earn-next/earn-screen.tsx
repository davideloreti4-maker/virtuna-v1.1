"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { useCopyText } from "@/components/thread-next/sheet-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EARN_RULE, type EarnPage, type EnrolRefusal } from "@/lib/earn/earn";
import { EARN_STRINGS, earnedAmount, goalWord, howItWorks, joinedLine, ratePct, rateSubtitle, whopTimingLine } from "@/lib/earn/earn-words";
import { cn } from "@/lib/utils";

import { GetPaid } from "./get-paid";
import { ShareCard, useSaveCardImage } from "./share-card";

/**
 * Earn (spec 2026-11-24-earn; plan steps A and B; rulings 10, 16, 17 and 23), modelled on Stanley's earnings
 * page: the title "Your Earnings"; the amount (Home's "Money made" rule) over a muted "/ $65k goal" and
 * how many creators joined; two equal cards (phone: stacked): "Get paid for every creator you bring" (the
 * link with Copy inside the field, Share where the browser has a share sheet, the share card with "Save
 * image") and, beside it, the payouts card (Whop enrolment) over "How it works"; then "EARNINGS", a card
 * with an empty state or three plain stats; then the fine print.
 *
 * The page's `h1` is visible at every width; the phone's pushed header names the screen too ("Earn").
 *
 * The screen sends no request: Copy is the clipboard, Share and Save image the browser's share sheet, and
 * enrolling is `onEnrol` (the container's).
 */
export interface EarnScreenProps {
  state: "loading" | "error" | "ready";
  page: Pick<EarnPage, "link" | "code" | "name" | "joined" | "whop"> | null;
  onRetry(): void;
  /** Enrol at Whop (a typed username, or undefined for the account the app knows): null when done, else the refusal. */
  onEnrol?(username: string | undefined): Promise<EnrolRefusal | null>;
}

/** Buttons: 48 tall, round, 15. */
const PILL = "h-12 px-5 text-ui next:rounded-full";
const COLUMNS = "mt-6 grid gap-3 md:grid-cols-2 md:items-start";
const PLACEHOLDER = "rounded-3xl bg-surface shadow-[var(--shadow-rest)]";
const LABEL = "text-caption font-semibold uppercase tracking-[0.08em] text-foreground-secondary";

/** Whether this browser has a share sheet. False on the server and in the first render, so the markup matches. */
const noSubscription = () => () => {};
function useHasShareSheet(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

function Frame({ busy, children }: { busy?: boolean; children: React.ReactNode }) {
  return (
    <div data-testid="earn-next" className="flex w-full flex-1 flex-col">
      <div aria-busy={busy || undefined} className="mx-auto flex w-full max-w-[1040px] flex-col px-4 pb-12 pt-1 md:px-8 md:pb-16 md:pt-11">
        <h1 className="text-heading font-semibold text-foreground">{EARN_STRINGS.pageTitle}</h1>
        {children}
      </div>
    </div>
  );
}

function Placeholders() {
  return (
    <>
      <p role="status" className="sr-only">
        {EARN_STRINGS.loading}
      </p>
      <div aria-hidden className="mt-3 flex flex-col gap-2.5">
        <span className="h-7 w-48 rounded-full bg-surface-sunken" />
        <span className="h-4 w-60 max-w-full rounded-full bg-surface-sunken" />
      </div>
      <div aria-hidden className={COLUMNS}>
        <div className={cn("h-[480px]", PLACEHOLDER)} />
        <div className="flex flex-col gap-3">
          <div className={cn("h-[180px]", PLACEHOLDER)} />
          <div className={cn("h-[200px]", PLACEHOLDER)} />
        </div>
      </div>
      <div aria-hidden className={cn("mt-8 h-[120px]", PLACEHOLDER)} />
    </>
  );
}

export function EarnScreen(props: EarnScreenProps): React.JSX.Element {
  usePushedTitle(EARN_STRINGS.title);
  // "Try again" on a page that did not load: once it loads, the focus (gone with the button) goes to Copy.
  const [retried, setRetried] = useState(false);
  if (props.state === "ready" && props.page) return <Ready page={props.page} retried={retried} onEnrol={props.onEnrol} />;
  if (props.state === "error") {
    return (
      <Frame>
        <Card className="p-[18px] md:mt-2.5">
          <p role="alert" className="text-ui text-foreground">
            {EARN_STRINGS.loadFailed}
          </p>
          <Chip
            surface="card"
            onClick={() => {
              setRetried(true);
              props.onRetry();
            }}
            className="mt-3"
          >
            {EARN_STRINGS.tryAgain}
          </Chip>
        </Card>
      </Frame>
    );
  }
  return (
    <Frame busy>
      <Placeholders />
    </Frame>
  );
}

/** Without a container's mutation (a test of the screen alone), enrolling is refused as a failure. */
const noEnrol = async (): Promise<EnrolRefusal> => "failed";

function Ready({ page, retried, onEnrol = noEnrol }: { page: NonNullable<EarnScreenProps["page"]>; retried: boolean; onEnrol?: EarnScreenProps["onEnrol"] }) {
  const linkId = useId();
  const howId = useId();
  const earningsId = useId();
  const copyRef = useRef<HTMLButtonElement>(null);
  const { copied, copy } = useCopyText(page.link);
  const hasShareSheet = useHasShareSheet();
  const card = { link: page.link, code: page.code, name: page.name, ratePct: ratePct() };
  const saveImage = useSaveCardImage(card);
  const { whop } = page;
  const amount = earnedAmount(whop);
  const nothingEarned = !whop?.earnedCents && page.joined === 0;

  useEffect(() => {
    const active = document.activeElement;
    if (retried && (!active || active === document.body)) copyRef.current?.focus();
  }, [retried]);

  const share = () => {
    // Closing the sheet rejects with AbortError: nothing to say.
    navigator.share({ text: EARN_STRINGS.shareText, url: page.link }).catch(() => {});
  };

  return (
    <Frame>
      <p className="mt-3 text-ui text-foreground-secondary">
        {amount !== null && <span className="text-stat font-bold tabular-nums text-foreground">{amount}</span>}
        <span>{amount !== null ? " / " : ""}{goalWord()}</span>
      </p>
      <p className="mt-1.5 text-ui tabular-nums text-foreground-secondary">{joinedLine(page.joined)}</p>

      <div className={COLUMNS}>
        <section aria-labelledby={linkId} className="min-w-0">
          <Card className="p-[18px]">
            <h2 id={linkId} className="text-title font-[640] text-foreground">
              {EARN_STRINGS.cardTitle}
            </h2>
            <p className="mt-1 text-ui text-foreground-secondary">{rateSubtitle()}</p>
            <div className="mt-4 flex h-14 items-center gap-1 rounded-xl bg-surface-sunken pl-4 pr-1.5 next:rounded-2xl">
              <input
                readOnly
                value={page.link}
                aria-label={EARN_STRINGS.yourLink}
                onFocus={(e) => e.currentTarget.select()}
                className="h-12 min-w-0 flex-1 text-ellipsis bg-transparent text-ui text-foreground"
              />
              <Button ref={copyRef} type="button" variant="secondary" onClick={copy} className="h-11 shrink-0 gap-1.5 px-3.5 text-ui next:rounded-xl">
                {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                {copied ? EARN_STRINGS.copied : EARN_STRINGS.copy}
              </Button>
            </div>
            <span role="status" className="sr-only">
              {copied ? EARN_STRINGS.copied : ""}
            </span>
            {hasShareSheet && (
              <Button type="button" variant="secondary" onClick={share} className={cn(PILL, "mt-2 w-full")}>
                {EARN_STRINGS.share}
              </Button>
            )}
            <hr className="my-5 border-0 border-t border-border" />
            <div data-earn-share className="mx-auto w-full max-w-[280px]">
              <ShareCard {...card} />
              <Button type="button" variant="secondary" onClick={() => void saveImage()} className={cn(PILL, "mt-3 w-full")}>
                {EARN_STRINGS.saveImage}
              </Button>
            </div>
          </Card>
        </section>

        <div className="flex min-w-0 flex-col gap-3">
          {whop && <GetPaid whop={whop} onEnrol={onEnrol} />}
          <section aria-labelledby={howId} className="min-w-0">
            <Card className="p-[18px]">
              <h2 id={howId} className="text-title font-[640] text-foreground">
                {EARN_STRINGS.howItWorks}
              </h2>
              <ol className="mt-1.5">
                {howItWorks(EARN_RULE, { paidByWhop: whop?.canEnrol === true }).map((line, i) => (
                  <li key={line} className="flex items-start gap-3 py-2">
                    <span aria-hidden className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-surface-sunken text-meta font-[640] tabular-nums text-foreground">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-ui text-foreground">{line}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </section>
        </div>
      </div>

      <section aria-labelledby={earningsId} className="mt-8">
        <h2 id={earningsId} className={LABEL}>
          {EARN_STRINGS.earningsLabel}
        </h2>
        <Card className="mt-3 p-[18px]">
          {nothingEarned ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <p className="text-title font-[640] text-foreground">{EARN_STRINGS.emptyTitle}</p>
              <p className="mt-1 text-ui text-foreground-secondary">{EARN_STRINGS.emptyHint}</p>
            </div>
          ) : (
            <dl className="grid gap-5 sm:grid-cols-3">
              <Stat label={EARN_STRINGS.statEarned} value={amount ?? "Not available"} />
              <Stat label={EARN_STRINGS.statJoined} value={String(page.joined)} />
              {whop && <Stat label={EARN_STRINGS.statPaidBy} value={whop.username ? `@${whop.username}` : EARN_STRINGS.notSetUp} />}
            </dl>
          )}
        </Card>
      </section>

      {/* The fine print: when Whop pays. "Not credited" is the payouts card's to say (ruling 43), once. */}
      {whop?.canEnrol && <p className="mt-5 text-meta text-foreground-secondary">{whopTimingLine()}</p>}
    </Frame>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-foreground-secondary">{label}</dt>
      <dd className="mt-1 break-words text-title font-[640] tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
