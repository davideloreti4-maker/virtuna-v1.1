"use client";

import { useCallback, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

import { STAGE } from "@/components/result/stage";
import { usePushedTitle } from "@/components/result/use-pushed-title";
import { MenuButton } from "@/components/shell/menu-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import type { AudiencePage } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS } from "@/lib/audience-next/audience-words";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { cn } from "@/lib/utils";

import { Figures } from "./figures";
import { GroupsCard } from "./groups-card";
import { PaleRing, RingCard } from "./ring-card";
import { SourceCard } from "./source-card";
import { TextsCard } from "./texts-card";
import { VideosCard } from "./videos-card";

/**
 * Audience (spec 2026-11-25-audience, sections 3.1 to 3.3, 3.7 and 3.9; the drawing's phone frames): one
 * page about the audience Maven simulates for. Presentational: the container reads nothing
 * here and the screen sends nothing; every action is a handler.
 *
 *   phone                                  (a desk, from a body 920 wide: the same blocks in two columns,
 *                                           ring, actions and groups on the right; see `COLUMN`)
 *   Audience ··········· [pill ▾] (···)    the header: the switcher and More are the containers' slots
 *   ( the ring of 1,000 )                  ring
 *   (N) @handle · TikTok · read …  (↻)     source
 *   Followers · Likes · Posts · Usual      figures (those known)
 *   [ Use for new chats ]                  actions (the quiet one only when not the default)
 *   [ Simulate a video for them  → ]
 *   Groups ········ share of your viewers  groups (four rows, then "All 10")
 *   What works with them / What falls flat texts
 *   Your videos Maven read                 videos (no count beside the heading)
 *
 * Every block is a direct child of the body with `data-block`, in the phone's order; a block with nothing to
 * show is not drawn. States: an audience, none yet (the pale ring and the invitation), loading (the outline),
 * failed (one card and Try again); `building` (a read running again) replaces the body under the same header.
 *
 * The title: on `/audience` the page's `h1`, the phone's band taken back as Library's. Pushed
 * (`/audience/[id]`, `/audience/general`), the shell's header names the audience and is the phone's `h1`;
 * the page's `h1` is then for a desk only.
 */

export type AudienceScreenState =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "none" }
  | { kind: "audience"; page: AudiencePage };

export interface AudienceScreenProps {
  state: AudienceScreenState;
  /** /audience/[id], /audience/general: the shell's Back and title. */
  pushed: boolean;
  /** The group whose sheet is open. */
  focus: Archetype | null;
  /** A group's row or wedge: its sheet. `from` is the row's button (a wedge has none). */
  onPickGroup(group: Archetype, from: HTMLElement | null): void;
  onSimulate(): void;
  onUseForNewChats(): void;
  onRetry(): void;
  /** The source card's round button, only when given and the audience can be read again. */
  onReadAgain?(from: HTMLElement): void;
  /** The button whose request is on its way: busy, and a press does nothing. */
  busy?: "simulate" | "default" | null;
  /** The header's slots (the container's switcher and More), for an audience only. */
  switcher?: ReactNode;
  menu?: ReactNode;
  /** The phone's way into the drawer (the creator's picture), before the heading, in every state; on
   *  `/audience` only: a pushed page has the shell's Back there. */
  opener?: ReactNode;
  /** Replaces the body while a read runs. */
  building?: ReactNode;
}

const S = AUDIENCE_STRINGS;

/** Where "Build my audience" and "Describe one instead" lead (`/audience/new` keeps choosing a row from these). */
const NEW_FROM_ACCOUNT_HREF = "/audience/new?door=connect";
const NEW_FROM_DESCRIPTION_HREF = "/audience/new?door=describe";

/** The global `h1` tracking is unlayered and beats a utility: set inline (Library's). */
const HEADING_STYLE: CSSProperties = { letterSpacing: "-0.035em" };

/** The ring's card: the text result's stage (`STAGE`), the ring centred, 24 above and below. */
const RING_STAGE = cn("flex justify-center overflow-hidden rounded-3xl py-6 shadow-[var(--shadow-rest)]", STAGE);

/** The ink buttons: full width (their corners are the button's own, radius 10). */
const WIDE = "w-full";

/**
 * A desk's two columns (spec 3.4), from a body 920 wide as the result page's, without changing the DOM's
 * order (a screen reader and the keyboard read the phone's order at every width). The right column's
 * blocks float right, 432 wide, each clearing the last; a float never sits higher than a block before it
 * (CSS 2, 9.5.1 rule 6), so the right column reads ring, actions, groups and the left source, figures,
 * texts, videos, with no gaps. The left blocks keep clear of it: 432 and the 20 between. The body holds its
 * floats (`flow-root`) and, being no longer a flex column there, takes margins for the phone's 12 gap: none
 * above the first block of each column.
 */
const RIGHT = "@min-[920px]:float-right @min-[920px]:clear-right @min-[920px]:w-[432px]";
const LEFT = "@min-[920px]:mr-[452px]";
const BELOW = "@min-[920px]:mt-3";
const COLUMN: Readonly<Record<string, string>> = {
  ring: RIGHT,
  source: LEFT,
  figures: cn(LEFT, BELOW),
  actions: cn(RIGHT, BELOW),
  groups: cn(RIGHT, BELOW),
  texts: cn(LEFT, BELOW),
  videos: cn(LEFT, BELOW),
  invite: LEFT,
};

function Block({ name, className, children }: { name: string; className?: string; children?: ReactNode }) {
  return (
    <div data-block={name} className={cn(COLUMN[name], className)}>
      {children}
    </div>
  );
}

/** The drawing's arrow (`I.arrow`, stroke 2.2), after the main button's words. */
function ArrowGlyph() {
  return (
    <svg aria-hidden width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}

function Actions({
  isDefault,
  busy,
  onSimulate,
  onUseForNewChats,
}: {
  isDefault: boolean;
  busy: AudienceScreenProps["busy"];
  onSimulate(): void;
  onUseForNewChats(): void;
}) {
  // A busy button stays in the tab order (`aria-disabled`, not `disabled`: that would drop the focus).
  const state = (name: "simulate" | "default") => ({
    "aria-busy": busy === name || undefined,
    "aria-disabled": busy === name || undefined,
  });
  const unlessBusy = (name: "simulate" | "default", run: () => void) => () => {
    if (busy !== name) run();
  };
  return (
    <div className="flex flex-col gap-2">
      {!isDefault && (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          {...state("default")}
          onClick={unlessBusy("default", onUseForNewChats)}
          className={cn(WIDE, "aria-busy:cursor-progress aria-busy:opacity-70")}
        >
          {S.useForNewChats}
        </Button>
      )}
      <Button
        type="button"
        variant="primary"
        size="lg"
        {...state("simulate")}
        onClick={unlessBusy("simulate", onSimulate)}
        className={cn(WIDE, "aria-busy:cursor-progress aria-busy:opacity-70")}
      >
        {S.simulate}
        <ArrowGlyph />
      </Button>
    </div>
  );
}

function AudienceBody({ page, props }: { page: AudiencePage; props: AudienceScreenProps }) {
  const { focus, onPickGroup } = props;
  const pickFromRing = useCallback((group: Archetype) => onPickGroup(group, null), [onPickGroup]);
  const grouped = page.groups.length > 0;
  const { works, flat } = page.texts;
  return (
    <>
      <Block name="ring" className={RING_STAGE}>
        {grouped ? <RingCard wedges={page.wedges} groups={page.groups} focus={focus} onPick={pickFromRing} /> : <PaleRing />}
      </Block>
      <Block name="source">
        <SourceCard page={page} onReadAgain={props.onReadAgain} />
      </Block>
      {page.figures.length > 0 && (
        <Block name="figures">
          <Figures figures={page.figures} />
        </Block>
      )}
      <Block name="actions">
        <Actions isDefault={page.isDefault} busy={props.busy} onSimulate={props.onSimulate} onUseForNewChats={props.onUseForNewChats} />
      </Block>
      {grouped && (
        <Block name="groups">
          <GroupsCard groups={page.groups} whose={page.whose} focus={focus} onPick={onPickGroup} />
        </Block>
      )}
      {(works || flat) && (
        <Block name="texts">
          <TextsCard texts={page.texts} />
        </Block>
      )}
      {page.videos && (
        <Block name="videos">
          <VideosCard videos={page.videos} whose={page.whose} />
        </Block>
      )}
    </>
  );
}

/** No audience of the creator's own (spec 3.7): the pale ring, what Maven simulates for now, the one step. */
function NoneBody() {
  return (
    <>
      <Block name="ring" className={RING_STAGE}>
        <PaleRing />
      </Block>
      <Block name="invite">
        <div className="px-1.5 pb-4 pt-2">
          <h2 className="text-[20px] font-[720] leading-[26px] tracking-[-0.02em] text-foreground">{S.noneTitle}</h2>
          <p className="mt-1.5 text-ui text-foreground-secondary">{S.noneText}</p>
        </div>
        <Button asChild variant="primary" size="lg" className={WIDE}>
          <Link href={NEW_FROM_ACCOUNT_HREF}>{S.buildMine}</Link>
        </Button>
        <Link href={NEW_FROM_DESCRIPTION_HREF} className="mt-1 flex h-11 items-center justify-center text-ui font-[620] text-foreground">
          {S.describeInstead}
        </Link>
      </Block>
    </>
  );
}

/** The screen's own outline (spec 3.9): quiet blocks where the ring, the source, the figures, the buttons
 *  and the groups will be, busy, with one line for screen readers. */
function LoadingBody() {
  const quiet = "rounded-3xl bg-surface shadow-[var(--shadow-rest)]";
  return (
    <>
      <p role="status" className="sr-only">
        {S.loading}
      </p>
      <Block name="ring" className={cn("h-[334px]", quiet)} />
      <Block name="source" className="h-16 rounded-[22px] bg-surface shadow-[var(--shadow-rest)]" />
      <Block name="figures" className="h-[62px] rounded-[18px] bg-surface-sunken" />
      <Block name="actions" className="h-[50px] rounded-xl bg-surface-sunken" />
      <Block name="groups" className={cn("h-[300px]", quiet)} />
    </>
  );
}

/** A read that failed (spec 3.9): one card, an alert and Try again (Earn's pattern). */
function FailedBody({ onRetry }: { onRetry(): void }) {
  return (
    <Card className="p-[18px]">
      <p role="alert" className="text-ui text-foreground">
        {S.loadFailed}
      </p>
      <Chip surface="card" onClick={onRetry} className="mt-3">
        {S.tryAgain}
      </Chip>
    </Card>
  );
}

export function AudienceScreen(props: AudienceScreenProps) {
  const { state, pushed, switcher, menu, opener, building } = props;
  const page = state.kind === "audience" ? state.page : null;
  usePushedTitle(pushed ? (page?.name ?? S.title) : "");

  // The header's slots are an audience's: never in none, loading or failed.
  const slots = page && (switcher || menu) ? { switcher, menu } : null;
  const loading = state.kind === "loading";

  let body: ReactNode;
  if (state.kind === "audience") body = <AudienceBody page={state.page} props={props} />;
  else if (state.kind === "none") body = <NoneBody />;
  else if (state.kind === "failed") body = <FailedBody onRetry={props.onRetry} />;
  else body = <LoadingBody />;

  return (
    <div data-testid="audience-next" className={cn("flex w-full flex-1 flex-col", !pushed && "max-md:-mt-[var(--mobile-nav-band)]")}>
      <div className="mx-auto flex w-full max-w-[1012px] flex-col px-4 pb-6 md:pb-12">
        {/* Phone: the header row sits where the band was, 44 tall, as Library's. Pushed with nothing at its
            right, the phone has no row at all: the shell's pushed header names the page. */}
        <header
          className={cn(
            "flex h-11 items-center gap-3 pl-1 max-md:mt-1.5 md:h-auto md:justify-between md:pb-[22px] md:pl-0 md:pt-11",
            pushed && !slots && "max-md:hidden",
          )}
        >
          {opener && !pushed && (
            <div data-part="opener" className="flex shrink-0 md:hidden">
              {opener}
            </div>
          )}
          <h1
            className={cn(
              // 24 on every phone: the row holds the opener, the title, the pill and More, so the title
              // steps down to leave the audience's name room in the pill (which cuts what still does
              // not fit); the title itself never shrinks.
              "shrink-0 text-3xl font-bold leading-[35px] text-foreground max-md:text-2xl",
              pushed && "max-md:hidden",
            )}
            style={HEADING_STYLE}
          >
            {S.title}
          </h1>
          {slots && (
            // The slots may shrink (the pill cuts its name), never the heading.
            <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
              {slots.switcher}
              {slots.menu}
            </div>
          )}
        </header>

        {/* `@container`: the body's own width decides its layout (the sidebar's width varies). From 920 the
            body is two columns (`COLUMN`). A read standing in for it keeps to the new audience page's 560. */}
        <div className="@container mt-3 md:mt-0">
          {building ? (
            <div className="max-w-[560px]">{building}</div>
          ) : (
            <div data-audience-body="" aria-busy={loading || undefined} className="flex flex-col gap-3 @min-[920px]:flow-root">
              {body}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const noop = () => {};

/** The loading state on its own, for the routes' `loading.tsx`: nothing to hand it but `pushed`. On
 *  `/audience` it draws the opener too, so the heading does not move when the page lands. */
export function AudienceNextLoading({ pushed }: { pushed: boolean }) {
  return (
    <AudienceScreen
      state={{ kind: "loading" }}
      pushed={pushed}
      opener={pushed ? undefined : <MenuButton variant="picture" />}
      focus={null}
      onPickGroup={noop}
      onSimulate={noop}
      onUseForNewChats={noop}
      onRetry={noop}
    />
  );
}
