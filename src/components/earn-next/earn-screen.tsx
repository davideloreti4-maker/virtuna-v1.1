"use client";

import * as React from "react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { useCopyText } from "@/components/thread-next/sheet-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EARN_RULE, type EarnPage, type EnrolRefusal } from "@/lib/earn/earn";
import { EARN_STRINGS, earnedLine, headline, howItWorks, joinedLine, ratePct, rateLine } from "@/lib/earn/earn-words";
import { cn } from "@/lib/utils";

import { GetPaid } from "./get-paid";
import { ShareCard, useSaveCardImage } from "./share-card";

/**
 * Earn (spec 2026-11-24-earn; plan steps A and B; rulings 10, 16, 17 and 23; the drawing
 * `.scratch/next-look/part7/earn/drawing/earn-drawing.png`), presentational: the top (a big "Earn 50%", or
 * "$24.50 earned" once Whop reports a number; the first month; how many creators joined), the card "Your
 * link" (the link in a field, Copy, and Share where the browser has a share sheet), the card "Get paid"
 * (enrolling at Whop, when the payment side is known), the share card with "Save image", and "How it works".
 *
 * Phone: one column, in that order. From 1024 (the sidebar takes 248): the cards left, the share card
 * right, 300 wide, as drawn. The left column packs at the grid's gap (ruling 23): the share card spans
 * every row and the last row takes whatever height it needs beyond them. The phone's pushed header names
 * the screen ("Earn", Back to You); from 768 the page's own `h1` does, for assistive technology only.
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

/** The global `h1` tracking is unlayered and beats a utility; the figure's own tracking, inline. */
const FIGURE_STYLE: React.CSSProperties = { letterSpacing: "-0.055em" };
/** The drawing's buttons and field: 48 tall, round, 15. */
const PILL = "h-12 px-5 text-ui next:rounded-full";
const GRID = "mt-[18px] grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start";
/**
 * Ruling 23: the left column's cards sit in auto rows, so the gap between them is the grid's; the share
 * card spans every row, and its extra height (it is taller than the cards beside it) goes to the last, a
 * flexible row, never between the cards. Two layouts: with the card "Get paid" (three rows) and without.
 */
const ROWS = {
  three: { grid: "lg:grid-rows-[auto_auto_1fr]", share: "lg:row-span-3", how: "lg:row-start-3" },
  two: { grid: "lg:grid-rows-[auto_1fr]", share: "lg:row-span-2", how: "lg:row-start-2" },
} as const;
const PLACEHOLDER = "rounded-3xl bg-surface shadow-[var(--shadow-rest)]";

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
      <div aria-busy={busy || undefined} className="mx-auto flex w-full max-w-[720px] flex-col px-4 pb-12 pt-1 md:pb-16 md:pt-11">
        <h1 className="sr-only hidden md:block">{EARN_STRINGS.title}</h1>
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
      <div aria-hidden className="flex flex-col gap-2.5 px-1 pt-2">
        <span className="h-[58px] w-56 rounded-full bg-surface-sunken" />
        <span className="h-5 w-72 max-w-full rounded-full bg-surface-sunken" />
        <span className="h-4 w-60 max-w-full rounded-full bg-surface-sunken" />
      </div>
      <div aria-hidden className={cn(GRID, ROWS.three.grid)}>
        <div className={cn("h-[168px] lg:col-start-1 lg:row-start-1", PLACEHOLDER)} />
        <div className={cn("h-[150px] lg:col-start-1 lg:row-start-2", PLACEHOLDER)} />
        <div className={cn("h-[468px] lg:col-start-2 lg:row-start-1", ROWS.three.share, PLACEHOLDER)} />
        <div className={cn("h-[204px] lg:col-start-1", ROWS.three.how, PLACEHOLDER)} />
      </div>
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
  const copyRef = useRef<HTMLButtonElement>(null);
  const { copied, copy } = useCopyText(page.link);
  const hasShareSheet = useHasShareSheet();
  const card = { link: page.link, code: page.code, name: page.name, ratePct: ratePct() };
  const saveImage = useSaveCardImage(card);
  const { whop } = page;
  const rows = whop ? ROWS.three : ROWS.two;
  // Ruling 17: a number Whop reported takes the big words' place; the line under them stays.
  const top = whop?.earnedCents != null ? earnedLine(whop.earnedCents) : headline();

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
      <div className="px-1 pt-2">
        <p className="text-figure font-bold text-foreground" style={FIGURE_STYLE}>
          {top}
        </p>
        <p className="mt-2.5 text-title font-[560] text-foreground">{rateLine()}</p>
        <p className="mt-1 text-ui tabular-nums text-foreground-secondary">{joinedLine(page.joined)}</p>
      </div>

      <div className={cn(GRID, rows.grid)}>
        <section aria-labelledby={linkId} className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Card className="p-[18px]">
            <h2 id={linkId} className="text-title font-[640] text-foreground">
              {EARN_STRINGS.yourLink}
            </h2>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={page.link}
                aria-labelledby={linkId}
                onFocus={(e) => e.currentTarget.select()}
                className="h-12 min-w-0 flex-1 text-ellipsis rounded-full bg-surface-sunken px-4 text-ui text-foreground"
              />
              <Button ref={copyRef} type="button" variant="primary" onClick={copy} className={cn(PILL, "min-w-[92px] shrink-0")}>
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
          </Card>
        </section>

        {whop && <GetPaid whop={whop} onEnrol={onEnrol} className="lg:col-start-1 lg:row-start-2" />}

        <div data-earn-share className={cn("min-w-0 lg:col-start-2 lg:row-start-1", rows.share)}>
          <Card className="p-[18px] lg:p-3">
            <ShareCard {...card} />
            <Button type="button" variant="secondary" onClick={() => void saveImage()} className={cn(PILL, "mt-3 w-full")}>
              {EARN_STRINGS.saveImage}
            </Button>
          </Card>
        </div>

        <section aria-labelledby={howId} className={cn("min-w-0 lg:col-start-1", rows.how)}>
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
    </Frame>
  );
}
