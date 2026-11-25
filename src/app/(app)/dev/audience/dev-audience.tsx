"use client";

import { useEffect, useRef, useState } from "react";

import { AudienceMenu } from "@/components/audience-next/audience-menu";
import { withName } from "@/components/audience-next/audience-next";
import { AudienceScreen, type AudienceScreenState } from "@/components/audience-next/audience-screen";
import { AudienceSwitcher } from "@/components/audience-next/audience-switcher";
import { BuildingView } from "@/components/audience-next/building-view";
import { GroupSheet, useGroupSheet } from "@/components/audience-next/group-sheet";
import { ReadAgainSheet } from "@/components/audience-next/read-again-sheet";
import type { SwitcherChoice } from "@/lib/audience-next/audience-model";
import { readAgainRequestOf } from "@/lib/audience-next/build-request";
import { applyEvent, startBuild, type BuildState } from "@/lib/audience-next/build-state";
import type { BuildEvent } from "@/lib/audience-next/build-stream";

import { COVERS, DevNewAudience, type DevNewAudienceState } from "./dev-new-audience";
import { DEV_PAGES, type DevPageName } from "./fixtures";

/**
 * Audience on local state, for /dev/audience (`page.tsx`). The pages are the real model's, made from the
 * made-up rows in `fixtures.ts`. Nothing here sends: a row or a wedge opens its group's sheet; More renames
 * on the page only, and its remove does nothing; Simulate and Use for new chats show their busy state for a
 * moment; Try again does nothing. Read again (the source's button or More's item) asks its question, and
 * confirming only closes it. The pill opens the switcher on the page's rows; a pick and New audience only
 * close it. A read again in place of the page (`reading…`) is made by the real reducer from made-up events;
 * its Close goes back to the page.
 */

/** A read again of the own page: running, too little to read, failed. */
type ReadingDevState = "reading" | "reading-thin" | "reading-failed";
/** The states the page can open in (`page.tsx` checks the name). `group`, `menu`, `switcher` and `read-again`
 *  are the own page with the third group's sheet open, with More open, with the switcher open, and with
 *  Read again's question open. */
type ScreenDevState = DevPageName | "group" | "menu" | "switcher" | "read-again" | ReadingDevState | "none" | "loading" | "failed";
/** And a new audience's states (`dev-new-audience.tsx`): the form and the read. */
export type DevAudienceState = ScreenDevState | DevNewAudienceState;

const NEW_AUDIENCE_STATES: readonly string[] = ["new", "new-describe", "building", "slow", "thin", "build-failed"] satisfies DevNewAudienceState[];
const isNewAudience = (state: DevAudienceState): state is DevNewAudienceState => NEW_AUDIENCE_STATES.includes(state);

const BUSY_FOR_MS = 1200;
const noop = () => {};

const READING_STATES: readonly string[] = ["reading", "reading-thin", "reading-failed"] satisfies ReadingDevState[];
const isReading = (state: ScreenDevState): state is ReadingDevState => READING_STATES.includes(state);
/** The states that show the own page with something open on it, or a read again in its place. */
const ON_OWN: readonly string[] = ["group", "menu", "switcher", "read-again", ...READING_STATES];

/** A read again of the own page at the state's moment: the second step running with the covers in, or an
 *  outcome. The real reducer, on made-up events in the server's own step names. */
function readingOf(state: ReadingDevState): BuildState {
  const start = startBuild(readAgainRequestOf(DEV_PAGES.own.page.readAgain!));
  const [read, watch] = start.plan as [string, string, string];
  const stage = (name: string, status: "active" | "done"): BuildEvent => ({ type: "stage", name, status });
  const evidence: BuildEvent = { type: "evidence", handle: "nia.tests", picture: null, covers: COVERS, count: COVERS.length };
  const events: BuildEvent[] =
    state === "reading"
      ? [stage(read, "active"), evidence, stage(read, "done"), stage(watch, "active")]
      : [stage(read, "active"), state === "reading-thin" ? { type: "fallback" } : { type: "error", message: null }];
  return events.reduce(applyEvent, start);
}

function screenStateOf(state: ScreenDevState): { state: AudienceScreenState; pushed: boolean; choices: SwitcherChoice[] } {
  if (state === "none" || state === "loading" || state === "failed") return { state: { kind: state }, pushed: false, choices: [] };
  const { page, pushed, choices } = DEV_PAGES[ON_OWN.includes(state) ? "own" : (state as DevPageName)];
  return { state: { kind: "audience", page }, pushed, choices };
}

export function DevAudience({ state }: { state: DevAudienceState }) {
  return isNewAudience(state) ? <DevNewAudience state={state} /> : <DevAudienceScreen state={state} />;
}

function DevAudienceScreen({ state }: { state: ScreenDevState }) {
  const shown = screenStateOf(state);
  const served = shown.state.kind === "audience" ? shown.state.page : null;
  const [name, setName] = useState<string | null>(null);
  const page = served && name ? withName(served, name) : served;
  const groupSheet = useGroupSheet(page?.groups ?? [], state === "group" ? (served?.groups[2]?.group ?? null) : null);
  const [busy, setBusy] = useState<"simulate" | "default" | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(state === "switcher");
  const [question, setQuestion] = useState<{ open: boolean; from: HTMLElement | null }>({ open: state === "read-again", from: null });
  const [reading, setReading] = useState<BuildState | null>(() => (isReading(state) ? readingOf(state) : null));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const busyFor = (name: "simulate" | "default") => {
    setBusy(name);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBusy(null), BUSY_FOR_MS);
  };

  const askReadAgain = (from: HTMLElement | null) => setQuestion({ open: true, from });
  // A read again stands in for the page under the title alone, as on the real page.
  const building =
    page && reading ? (
      <BuildingView
        state={reading}
        slow={false}
        mode="again"
        whose={page.whose}
        initial={page.face.initial}
        onTryAgain={noop}
        onClose={() => setReading(null)}
      />
    ) : undefined;
  const slotted = building ? null : page;

  return (
    <>
      <AudienceScreen
        state={page ? { kind: "audience", page } : shown.state}
        pushed={shown.pushed}
        focus={groupSheet.focus}
        onPickGroup={groupSheet.onPickGroup}
        onSimulate={() => busyFor("simulate")}
        onUseForNewChats={() => busyFor("default")}
        onRetry={noop}
        onReadAgain={askReadAgain}
        busy={busy}
        building={building}
        switcher={
          slotted ? (
            <AudienceSwitcher
              name={slotted.name}
              choices={shown.choices}
              open={switcherOpen}
              onOpenChange={setSwitcherOpen}
              onPick={() => setSwitcherOpen(false)}
              onNew={() => setSwitcherOpen(false)}
            />
          ) : undefined
        }
        menu={
          slotted ? (
            <AudienceMenu
              name={slotted.name}
              removal={slotted.removal}
              onRename={setName}
              onRemove={noop}
              onReadAgain={slotted.readAgain ? askReadAgain : undefined}
              defaultOpen={state === "menu"}
            />
          ) : undefined
        }
      />
      {page && <GroupSheet {...groupSheet.sheet} whose={page.whose} />}
      {page?.readAgain && (
        <ReadAgainSheet
          open={question.open}
          onOpenChange={(open) => setQuestion((now) => ({ ...now, open }))}
          handle={page.readAgain.handle}
          onConfirm={() => setQuestion((now) => ({ ...now, open: false }))}
          returnFocus={question.from}
        />
      )}
    </>
  );
}
