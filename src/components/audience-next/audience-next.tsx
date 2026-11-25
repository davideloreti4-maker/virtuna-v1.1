"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

import { MenuButton } from "@/components/shell/menu-button";
import { useThreadActions } from "@/components/shell/use-thread-actions";
import { useToast } from "@/components/ui/toast";
import {
  readOnItsWay,
  useAudienceBuild,
  useAudienceChangedElsewhere,
  useRemoveAudience,
  useRenameAudience,
  useSetDefaultAudience,
} from "@/hooks/queries/use-audience-next";
import { initialOf, type AudiencePage, type AudienceRead, type SwitcherChoice } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, disconnectFailed, newChatsUse, stillReading } from "@/lib/audience-next/audience-words";
import { readAgainRequestOf } from "@/lib/audience-next/build-request";
import { isSessionExpiredRefusal } from "@/lib/auth/session-expired";
import { buildThreadLaunchHref } from "@/lib/room-contract/thread-launch";

import { AudienceMenu } from "./audience-menu";
import { AudienceScreen, type AudienceScreenState } from "./audience-screen";
import { AudienceSwitcher } from "./audience-switcher";
import { BuildingView } from "./building-view";
import { GroupSheet, useGroupSheet } from "./group-sheet";
import { ReadAgainSheet } from "./read-again-sheet";

/**
 * Audience with its data (spec 2026-11-25-audience, 3.2 to 3.3 and 3.8): the screen, a
 * group's sheet, More, and what they send. The page is read on the server and handed in (`read`); after a
 * change the router reads it again (`router.refresh()`).
 *
 * - A group: a row or a wedge looks at it (the ring dims the other nine) and opens its sheet; closing
 *   lights the ring again and gives the focus back to the row (`useGroupSheet`).
 * - Simulate a video for them: a new chat on Home with Simulate picked (`newThreadAt`: never the last chat,
 *   which the active-chat pointer still names). An audience that is not the one new chats use is
 *   made that first, and Home opens only once the server said yes (the page then counts it as the default,
 *   so a press after a navigation that never landed only opens Home again); a refusal stays here and says so.
 * - Use for new chats: the same request; the toast names the audience, the page shows it as the default at
 *   once (the quiet button leaves, and the focus moves to the main button), and the page is read again.
 * - The switcher (the pill in the title): the layer closes before anything is sent. Another audience is made
 *   the one new chats use, then `/audience` shows it, read again, and the toast names it; a refusal stays
 *   here and says so. While it is out the pill says so; once answered, this page sends nothing more until
 *   the next read lands (or `NEXT_READ_MAX_MS` passed without one: the refresh was dropped, so the page is
 *   asked for once more and answers again rather than staying dead), and the pill of the screen it lands on
 *   takes the focus. The checked one sends nothing: a pushed
 *   page goes to `/audience`, which shows it; on `/audience` it is this page, or (when `/audience` shows
 *   another, as for a default with no groups) its own page. New audience opens `/audience/new`. Its rows
 *   follow this page until it is read again (a name given here, the check moved by Use for new chats).
 * - Rename: the new name shows at once and until the page read again carries it; a refusal puts the old
 *   one back and says so.
 * - Remove (delete, or disconnect with the account): to `/audience` once done; a refusal says so and the
 *   page is read again (an account's audience may be gone even when its account stayed: the audience is
 *   deleted first, as the old screen did, and the account's own disconnect is on You). While it is out,
 *   and once that audience is gone, the two main buttons do nothing for it.
 * - An answer that comes after the creator has left this screen (a switch, Simulate, Use for new chats, a
 *   remove) only says so in its toast: nothing navigates, reads again or takes the focus.
 * - Read again (an account's audience: the source card's round button, or More's item): asked first
 *   (`ReadAgainSheet`); then the same audience is read once more (`useAudienceBuild`, its id in the request)
 *   and the building view stands in for the page, under the title alone (no pill, no More: nothing else
 *   should start meanwhile), the page held open by the read itself. A read of this audience still on its way
 *   from a visit the creator left is not started twice: a toast says so; when it ends, the page reads itself
 *   again (`useAudienceChangedElsewhere`). Done: the page is read
 *   again, and the view stays until that read arrives (or `NEXT_READ_MAX_MS`, then it is asked for once
 *   more), so the old groups never show again and Read again cannot start twice. Too little to read keeps
 *   the groups as they were; a failure offers Try again. Either way Close goes back to the page. An expired
 *   session (a 401) is the session dialog's alone: the read goes back to idle and the page shows as it was.
 *   Back on the page, the focus is on the source card's Read again. Which audience new
 *   chats use does not change.
 * - An expired session (a 401): the app's session dialog says so, and no refusal toast is added.
 * - A failed read: Try again reads the page again.
 */

const S = AUDIENCE_STRINGS;

/** Home with Simulate picked: no seed, never `run`, no `aud` (the composer does not read it). */
export const SIMULATE_HREF = buildThreadLaunchHref({ input: "", verb: "Test" });

/** Where a removed audience leaves to: the audience new chats use, or the invitation. */
const AFTER_REMOVE_HREF = "/audience";
/** Where a switch leaves to: the page of the audience new chats use. */
const AFTER_SWITCH_HREF = "/audience";
const NEW_AUDIENCE_HREF = "/audience/new";
const audienceHref = (id: string) => `/audience/${id}`;

/**
 * The focus owed to the pill of the screen a switch lands on (the old screen's pill left with it): the
 * audience switched to, until when. Kept outside the screen because the landing is a new screen.
 */
const PILL_FOCUS_WITHIN_MS = 10_000;
const owedPillFocus: { to: { id: string; until: number } | null } = { to: null };

/**
 * How long this page waits for its next read after asking for it: after a switch (the page held, the pill
 * busy) and after a read again (the building view kept). A navigation and its read land well within this;
 * if none has come by then, the refresh was dropped (a network blip): the page is asked for once more, and
 * the wait ends so the page answers again instead of staying held until the creator leaves.
 */
const NEXT_READ_MAX_MS = 8_000;

/** What the server hands the page (a redirect is the route's, never the screen's). */
export type AudienceNextRead = Exclude<AudienceRead, { kind: "redirect" }>;

type Busy = "simulate" | "default";

/** The page with a name given here: the pill, the pushed title, More; and the source's title and the face's
 *  initial when the name is what the source shows (an audience with no handle). */
export function withName(page: AudiencePage, name: string): AudiencePage {
  const label = page.handle === null ? name : page.label;
  const title = page.kind === "described" ? name : label;
  const face = label === page.label ? page.face : { ...page.face, initial: initialOf(label) };
  // Read again writes its name back into the audience: it carries the name given here, not the old one.
  const readAgain = page.readAgain && { ...page.readAgain, name };
  return { ...page, name, label, face, source: { ...page.source, title }, readAgain };
}

/** The switcher's rows as this page shows them until it is read again: a name given here in its own row
 *  (with its face), and the check on an audience made the one new chats use here. */
function choicesShown(choices: readonly SwitcherChoice[], page: AudiencePage, madeDefault: string | null): SwitcherChoice[] {
  return choices.map((c) => ({
    ...c,
    ...(c.id === page.id ? { name: page.name, label: page.label, face: page.face } : {}),
    selected: madeDefault === null ? c.selected : c.id === madeDefault,
  }));
}

/** The main button, once the quiet one above it has left. */
const mainButton = () => document.querySelector<HTMLElement>('[data-block="actions"] button');
/** The source card's Read again: where the focus goes once a read again is over. */
const readAgainButton = () => document.querySelector<HTMLElement>(`[data-block="source"] button[aria-label="${S.readAgain}"]`);

export function AudienceNext({ read }: { read: AudienceNextRead }) {
  const router = useRouter();
  const { toast } = useToast();
  const setDefault = useSetDefaultAudience();
  const rename = useRenameAudience();
  const remove = useRemoveAudience();
  // Simulate opens a NEW chat at the launch address: a bare push would land in the last chat, which the
  // active-chat pointer still names.
  const { newThreadAt } = useThreadActions();

  const served = read.kind === "audience" ? read.page : null;
  // A name given here, until the page read again carries it.
  const [named, setNamed] = useState<{ id: string; name: string } | null>(null);
  // An audience made the one new chats use here, until the page is read again (whatever that read says).
  const [madeDefault, setMadeDefault] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState(read);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // A switch on its way ("out"), or answered with its navigation not landed yet ("landed"): the pill says so.
  const [switching, setSwitching] = useState<"out" | "landed" | null>(null);
  // The request on its way as of the last press, not the last render: two presses can land before one. A
  // switch holds it too, from its press until the next read lands (`landedOn`).
  const sending = useRef<Busy | "switch" | null>(null);
  // The read on screen when a switch was answered: the hold lasts until another read replaces it.
  const landedOn = useRef<AudienceNextRead | null>(null);
  // The latest read and whether this screen is still on the page, for an answer that comes later.
  const latestRead = useRef(read);
  const mounted = useRef(false);
  // The audience whose remove is out, or done: nothing more is sent for it from here. Another audience
  // shown on this same screen afterwards is free.
  const removing = useRef<string | null>(null);
  // The end of a wait for the next read (`NEXT_READ_MAX_MS`): a switch's hold, or a read again's view.
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read again: the question (open, and the button it gives the focus back to), and the read itself.
  const [question, setQuestion] = useState<{ open: boolean; from: HTMLElement | null }>({ open: false, from: null });
  const { state: reading, slow, start: startRead, reset: resetRead } = useAudienceBuild();
  // Set when the read is over: the next render without it gives the focus to the source card's Read again.
  const backToPage = useRef(false);
  // The read on screen when a read again was done: its view stays until another read replaces this one.
  const doneOn = useRef<AudienceNextRead | null>(null);

  if (named && (!served || served.id !== named.id || served.name === named.name)) setNamed(null);
  if (read !== lastRead) {
    setLastRead(read);
    if (madeDefault) setMadeDefault(null);
    if (switching === "landed") setSwitching(null);
  }

  let page = served;
  if (page && named) page = withName(page, named.name);
  if (page && madeDefault) page = { ...page, isDefault: true };

  const groupSheet = useGroupSheet(page?.groups ?? []);
  const choices = page && read.kind === "audience" ? choicesShown(read.choices, page, madeDefault) : [];

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    latestRead.current = read;
  }, [read]);
  const dropWaitTimer = useCallback(() => {
    if (waitTimer.current !== null) clearTimeout(waitTimer.current);
    waitTimer.current = null;
  }, []);
  useEffect(() => dropWaitTimer, [dropWaitTimer]);

  /** Back to the page from a read again: its view leaves, and the focus goes to the source card's button. */
  const leaveReading = useCallback(() => {
    dropWaitTimer();
    doneOn.current = null;
    backToPage.current = true;
    resetRead();
  }, [dropWaitTimer, resetRead]);

  // Done (the stream closed, or the wait for it ran out): the page is read again. The view stays until that
  // read arrives, so the old groups never show again and Read again cannot start a second read meanwhile;
  // if none has come within `NEXT_READ_MAX_MS`, the page is asked for once more and the view gives way.
  const finished = reading?.phase === "done" ? reading : null;
  useEffect(() => {
    if (!finished) return;
    doneOn.current = latestRead.current;
    router.refresh();
    dropWaitTimer();
    waitTimer.current = setTimeout(() => {
      waitTimer.current = null;
      router.refresh();
      leaveReading();
    }, NEXT_READ_MAX_MS);
  }, [finished, router, dropWaitTimer, leaveReading]);
  // The next read has landed (a refresh, or the server's own): what waited for it lets go, its timer with it.
  // A switch answered here frees the page; a finished read again leaves for the page that read brought.
  useEffect(() => {
    if (sending.current === "switch" && landedOn.current !== null && landedOn.current !== read) {
      sending.current = null;
      landedOn.current = null;
      dropWaitTimer();
    }
    if (doneOn.current !== null && doneOn.current !== read) leaveReading();
  }, [read, dropWaitTimer, leaveReading]);

  // A read started on a visit the creator left has ended: this page reads itself again.
  useAudienceChangedElsewhere(() => router.refresh());
  // Back on the page (done, or Close): the focus on the button that reads it again, not lost to the body.
  useEffect(() => {
    if (reading !== null || !backToPage.current) return;
    backToPage.current = false;
    readAgainButton()?.focus();
  }, [reading]);

  // The screen a switch lands on: its pill takes the focus, unless something already has it.
  const shownId = served?.id ?? null;
  useEffect(() => {
    const owed = owedPillFocus.to;
    if (!owed || owed.id !== shownId) return;
    owedPillFocus.to = null;
    if (Date.now() > owed.until) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    document.querySelector<HTMLElement>("[data-audience-pill]")?.focus();
  }, [shownId]);

  /** Whether a request from here is on its way, or a switch answered here has not landed yet. */
  const held = () => sending.current !== null;

  const holdBusy = (name: Busy | null) => {
    sending.current = name;
    setBusy(name);
  };
  /** The audience new chats use becomes this one; false when refused (said here). */
  const makeDefault = async (id: string): Promise<boolean> => {
    try {
      await setDefault.mutateAsync(id);
      return true;
    } catch (error) {
      if (!isSessionExpiredRefusal(error)) toast({ variant: "error", title: S.switchFailed });
      return false;
    }
  };

  const onSimulate = async () => {
    if (!page || held() || removing.current === page.id) return;
    if (page.isDefault) {
      newThreadAt(SIMULATE_HREF);
      return;
    }
    const { id } = page;
    holdBusy("simulate");
    const made = await makeDefault(id);
    holdBusy(null);
    if (!made || !mounted.current) return;
    // Now the default: should Home not open (another tap took the navigation), a press opens it again with
    // no second request, and the page answers meanwhile.
    setMadeDefault(id);
    newThreadAt(SIMULATE_HREF);
  };

  const onUseForNewChats = async () => {
    if (!page || held() || removing.current === page.id) return;
    const { id, label } = page;
    holdBusy("default");
    const made = await makeDefault(id);
    holdBusy(null);
    if (!made) return;
    toast({ variant: "default", title: newChatsUse(label) });
    // The creator has left this screen meanwhile: it is said, and nothing else here acts.
    if (!mounted.current) return;
    // The quiet button leaves now: the focus it had goes to the main button, not to the page.
    flushSync(() => setMadeDefault(id));
    if (document.activeElement === document.body) mainButton()?.focus();
    router.refresh();
  };

  const onPick = async (choice: SwitcherChoice) => {
    // The layer leaves before anything is sent, and hands the focus back to the pill.
    flushSync(() => setSwitcherOpen(false));
    if (!page || held() || removing.current === page.id) return;
    if (choice.selected) {
      // `/audience` shows the one new chats use: from a pushed page one step away; on `/audience` this page,
      // or, when it shows another (the default has no groups), the checked one's own page.
      if (read.pushed) router.push(AFTER_SWITCH_HREF);
      else if (choice.id !== page.id) router.push(audienceHref(choice.id));
      return;
    }
    sending.current = "switch";
    setSwitching("out");
    const made = await makeDefault(choice.id);
    if (!made) {
      sending.current = null;
      if (mounted.current) setSwitching(null);
      return;
    }
    const said = () => toast({ variant: "default", title: newChatsUse(choice.label) });
    // The creator has left this screen meanwhile: it is said, and they are not pulled back.
    if (!mounted.current) {
      sending.current = null;
      said();
      return;
    }
    // Held until the navigation lands (the next read): this page sends nothing more meanwhile.
    const landed = latestRead.current;
    landedOn.current = landed;
    setSwitching("landed");
    dropWaitTimer();
    waitTimer.current = setTimeout(() => {
      waitTimer.current = null;
      // No read came since: the refresh was dropped. The page is asked for once more, and answers again.
      if (!mounted.current || sending.current !== "switch" || landedOn.current !== landed) return;
      sending.current = null;
      landedOn.current = null;
      setSwitching(null);
      router.refresh();
    }, NEXT_READ_MAX_MS);
    owedPillFocus.to = { id: choice.id, until: Date.now() + PILL_FOCUS_WITHIN_MS };
    router.push(AFTER_SWITCH_HREF);
    router.refresh();
    said();
  };

  const onNew = () => {
    setSwitcherOpen(false);
    router.push(NEW_AUDIENCE_HREF);
  };

  const onRename = async (name: string) => {
    if (!page) return;
    const { id } = page;
    setNamed({ id, name });
    try {
      await rename.mutateAsync({ id, name });
      router.refresh();
    } catch (error) {
      // Only this rename's name goes: a newer one may have taken its place.
      setNamed((now) => (now && now.id === id && now.name === name ? null : now));
      if (!isSessionExpiredRefusal(error)) toast({ variant: "error", title: S.renameFailed });
    }
  };

  const onRemove = async () => {
    if (!page || removing.current === page.id) return;
    const { id, removal } = page;
    removing.current = id;
    try {
      await remove.mutateAsync({ id, accountId: removal.kind === "disconnect" ? removal.accountId : null });
      // The creator has left this screen meanwhile: they are not pulled back.
      if (!mounted.current) return;
      router.push(AFTER_REMOVE_HREF);
      router.refresh();
    } catch (error) {
      if (removing.current === id) removing.current = null;
      if (!isSessionExpiredRefusal(error)) {
        toast({ variant: "error", title: removal.kind === "disconnect" ? disconnectFailed(removal.handle) : S.deleteFailed });
      }
      if (mounted.current) router.refresh();
    }
  };

  /** Read again, from the source card's button or More's item (`from`, where the focus goes back). */
  const onReadAgain = (from: HTMLElement | null) => {
    if (!page?.readAgain || held() || removing.current === page.id) return;
    // Still on its way from a visit the creator left: a second paid read is not started; the toast says so.
    if (readOnItsWay(readAgainRequestOf(page.readAgain))) {
      toast({ variant: "default", title: stillReading(page.readAgain.handle) });
      return;
    }
    setQuestion({ open: true, from });
  };
  const onConfirmReadAgain = () => {
    if (!page?.readAgain) return;
    const started = startRead(readAgainRequestOf(page.readAgain));
    // Started: the question leaves with nowhere to give the focus back to (the building view takes it), and
    // once no read stands in for the page the focus comes back to Read again. Not started (on its way from
    // elsewhere since the question opened): back to where it was opened from, and the toast says so.
    if (started) backToPage.current = true;
    setQuestion((now) => ({ open: false, from: started ? null : now.from }));
    if (!started) toast({ variant: "default", title: stillReading(page.readAgain.handle) });
  };

  const state: AudienceScreenState = page ? { kind: "audience", page } : { kind: read.kind === "failed" ? "failed" : "none" };
  // While a read runs (and while its outcome shows) it stands in for the page, and nothing else starts:
  // the header keeps its title alone.
  const building =
    page && reading ? (
      <BuildingView
        state={reading}
        slow={slow}
        mode="again"
        whose={page.whose}
        initial={page.face.initial}
        onTryAgain={() => startRead(reading.request)}
        onClose={leaveReading}
      />
    ) : undefined;
  // The header's pill and More: an audience's, and not while a read stands in for the page.
  const slotted = building ? null : page;

  return (
    <>
      <AudienceScreen
        state={state}
        pushed={read.pushed}
        focus={groupSheet.focus}
        onPickGroup={groupSheet.onPickGroup}
        onSimulate={() => void onSimulate()}
        onUseForNewChats={() => void onUseForNewChats()}
        onRetry={() => router.refresh()}
        onReadAgain={page?.readAgain ? onReadAgain : undefined}
        busy={busy}
        building={building}
        // A place's way into the drawer; a pushed page has the shell's Back there instead.
        opener={read.pushed ? undefined : <MenuButton variant="picture" />}
        switcher={
          slotted ? (
            <AudienceSwitcher
              name={slotted.name}
              choices={choices}
              open={switcherOpen}
              onOpenChange={setSwitcherOpen}
              onPick={(choice) => void onPick(choice)}
              onNew={onNew}
              busy={switching !== null}
            />
          ) : undefined
        }
        menu={
          slotted ? (
            <AudienceMenu
              name={slotted.name}
              removal={slotted.removal}
              onRename={(name) => void onRename(name)}
              onRemove={() => void onRemove()}
              onReadAgain={slotted.readAgain ? onReadAgain : undefined}
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
          onConfirm={onConfirmReadAgain}
          returnFocus={question.from}
        />
      )}
    </>
  );
}
