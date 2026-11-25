"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useThreadActions } from "@/components/shell/use-thread-actions";
import { useToast } from "@/components/ui/toast";
import { useSetDefaultAudience } from "@/hooks/queries/use-audience-next";
import { useChannelReadOut, useReadChannel, type AddChannelError } from "@/hooks/queries/use-channels";
import { isSessionExpiredRefusal, raiseSessionExpired, reportSession401 } from "@/lib/auth/session-expired";
import type { CreatorPage, CreatorRead } from "@/lib/discover-next/creator";
import { WATCHLIST_HREF, creatorHandleOf, pullHref } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS, readFailed, removeRefused } from "@/lib/discover-next/discover-words";
import type { PulledVideo } from "@/lib/discover-next/pull";
import { armPull, dropPull, keepPullOnlyAt } from "@/lib/discover-next/pull-intent";
import { pullInput } from "@/lib/discover-next/watchlist";
import { buildThreadLaunchHref } from "@/lib/room-contract/thread-launch";

import { CreatorScreen } from "./creator-screen";
import { PulledVideoLayer } from "./pulled-video-next";
import { useRemoveCreator } from "./use-remove-creator";

/**
 * A followed creator's page with its data (spec 3.2 to 3.4): `/competitors/<handle>` under the new look.
 * The route reads the page on the server and hands it in (`read`); after a change the router reads it
 * again (`router.refresh()`).
 *
 * - Read again: the creator is read once more, without following (`useReadChannel`). While it is out,
 *   from this visit or one the creator left (`useChannelReadOut`), the button turns, the line says
 *   "Reading…" and a press sends nothing. Read: the page reads itself again. Read in the last day by the
 *   server's own gate: the sentence "Read today…", and the page reads itself again. Either way, until that
 *   page lands a press sends nothing (it would only be answered "Read today"); a page opened again while
 *   the read was out holds its press the same way, and asks for its page itself. Refused: a toast, and
 *   the page keeps what it showed; a lapsed session is the app's own dialog, with no toast under it.
 *   Read inside 24 hours by the page's read: a press says the sentence and reads the page again (the day
 *   may have passed since). The answer is awaited, not handed to the mutation's callbacks: the toast and
 *   the router stand above the page, so a read that ends after the creator has left is still said, and the
 *   page then on screen is read again.
 * - Simulate a video for their viewers: their audience becomes the one new chats use, then Home opens on a
 *   new chat with Simulate picked (`newThreadAt`, as the Audience page's button of that name). The button
 *   waits until the page goes; refused, a toast and it is pressable again. An answer that comes after the
 *   creator has left opens nothing over the page they went to.
 * - Build their audience: a link to the new-audience page with the handle filled in; nothing sent here.
 * - Pull their best videos: the intent is armed, then the pull page opens; only that press starts a pull
 *   there. A press left behind is dropped on arriving here again, and on leaving for anywhere but its
 *   pull page (the hub's rule).
 * - A video's card opens its sheet (`PulledVideoLayer`): Save, and Remix, which leaves the video for a new
 *   chat on Home. Nothing is sent from here. The focus comes back to the card.
 * - More: Open on TikTok (a new tab), and Remove, asked once more. Remove clears every record the creator
 *   rests on (`useRemoveCreator`). Done: the Watchlist opens in this page's place, read again, whenever the
 *   address is still this creator's (done after the creator went elsewhere: the page then on screen is read
 *   again, and they stay on it). Refused: a toast, and the page stays. The session lapsed: the app's own
 *   dialog, no toast, and the page stays.
 * - Another creator is another page: its sheet and its presses start again.
 */
export interface CreatorNextProps {
  read: CreatorRead;
}

const S = DISCOVER_STRINGS.creator;

/** Home on a new chat with Simulate picked, as the Audience page's "Simulate a video for them" opens it. */
const SIMULATE_HREF = buildThreadLaunchHref({ input: "", verb: "Test" });

const PAGE_PREFIX = "/competitors/";

/** Whether the address on screen is still `handle`'s page, read as the route reads its segment. */
function showsCreator(handle: string): boolean {
  const path = window.location.pathname;
  return path.startsWith(PAGE_PREFIX) && creatorHandleOf(path.slice(PAGE_PREFIX.length)) === handle;
}

function ReadyCreator({ creator }: { creator: CreatorPage }) {
  const router = useRouter();
  const { toast } = useToast();
  const { newThreadAt } = useThreadActions();
  const read = useReadChannel();
  // The read is sent and asked after under the same string (the bare handle), so a page opened again
  // while its read is out still says so.
  const readOut = useChannelReadOut(creator.handle);
  const setDefault = useSetDefaultAudience();
  const removeCreator = useRemoveCreator();

  // Whether the creator is still on this page, for an answer that comes after they left.
  const mounted = useRef(false);
  useEffect(() => {
    // Set on mount, not only cleared on unmount: a remount in development runs this again.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A Pull pressed here arms its pull page's intent. Arriving, any press left behind is dropped; leaving,
  // it is kept only for the page the press opened.
  useEffect(() => {
    dropPull();
    return () => keepPullOnlyAt(window.location.pathname + window.location.search);
  }, []);

  // Read again. Out as of the last press, not the last render: two presses can land before one. Answered,
  // it stays taken until the page the answer asked for lands (a new `creator`, as Remove keeps its own
  // once done): a press in between would send a read the server only answers "Read today". Refused, it is
  // free at once.
  const reading = useRef(false);
  // Whether the read out was sent from this visit of the page (its own answer then frees or holds it).
  const sentHere = useRef(false);
  useEffect(() => {
    reading.current = false;
  }, [creator]);
  // A read sent from another visit of this page ends while this one is open: the same hold until the page
  // it brings lands, and this page asks for that page itself (a refused read asks for none).
  const wasOut = useRef(readOut);
  useEffect(() => {
    const ended = wasOut.current && !readOut;
    wasOut.current = readOut;
    if (!ended) return;
    if (sentHere.current) {
      sentHere.current = false;
      return;
    }
    reading.current = true;
    router.refresh();
  }, [readOut, router]);
  const readAgain = async () => {
    // Dimmed: the sentence, and the page is read again, since the day may have passed since it was read
    // (a page left open, or put back by Back). The fresh page decides.
    if (!creator.canReadAgain) {
      toast({ variant: "default", title: S.readToday });
      router.refresh();
      return;
    }
    if (reading.current || readOut) return;
    reading.current = true;
    sentHere.current = true;
    try {
      if ((await read.mutateAsync(creator.handle)) === "cached") toast({ variant: "default", title: S.readToday });
      router.refresh();
    } catch (error) {
      reading.current = false;
      const refusal = error as Partial<AddChannelError>;
      if (typeof refusal.status === "number" && reportSession401(refusal.status)) return;
      toast({ variant: "error", title: readFailed(creator.handle) });
    }
  };

  // Simulate for their viewers. Chosen as of the last press; once chosen, the button waits until the page
  // goes, so a press meanwhile neither sends again nor opens a second chat.
  const [simulating, setSimulating] = useState(false);
  const choosing = useRef(false);
  const simulate = async () => {
    const audience = creator.audience;
    if (!audience || choosing.current) return;
    choosing.current = true;
    setSimulating(true);
    try {
      await setDefault.mutateAsync(audience.id);
    } catch (error) {
      choosing.current = false;
      if (mounted.current) setSimulating(false);
      if (!isSessionExpiredRefusal(error)) toast({ variant: "error", title: S.simulateFailed });
      return;
    }
    // The creator has left meanwhile: Home does not open over the page they went to.
    if (!mounted.current) return;
    newThreadAt(SIMULATE_HREF);
  };

  // Pull: armed, then its page.
  const pull = () => {
    const input = pullInput(creator.handle);
    if (!input) return;
    armPull(input);
    router.push(pullHref(input));
  };

  // Remove. Out as of the last press; once done the page is going, and nothing more is sent from it.
  const removing = useRef(false);
  const remove = async () => {
    const removal = creator.removal;
    if (!removal || removing.current) return;
    removing.current = true;
    const answer = await removeCreator(removal);
    if (answer !== "done") {
      removing.current = false;
      // A lapsed session is the app's own dialog, with no toast under it.
      if (answer === "session") raiseSessionExpired();
      else toast({ variant: "error", title: removeRefused(creator.handle) });
      return;
    }
    // Asked of the address, not of this page: the removal may already have read the page again and drawn
    // it as gone. The creator has gone elsewhere: the page now on screen reads itself again, and they stay.
    if (showsCreator(creator.handle)) router.replace(WATCHLIST_HREF);
    router.refresh();
  };

  // The video whose sheet is open (its layer asks before a remix), and the card they both go back to.
  const [opened, setOpened] = useState<PulledVideo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const card = useRef<HTMLElement | null>(null);
  const toCard = () => card.current;

  const open = (video: PulledVideo, from: HTMLElement) => {
    card.current = from;
    setOpened(video);
    setSheetOpen(true);
  };

  return (
    <>
      <CreatorScreen
        state="ready"
        creator={creator}
        reading={readOut}
        onReadAgain={() => void readAgain()}
        simulating={simulating}
        onSimulate={() => void simulate()}
        onPull={pull}
        onOpen={open}
        onRemove={() => void remove()}
      />
      <PulledVideoLayer video={opened} open={sheetOpen} onOpenChange={setSheetOpen} returnFocus={toCard} />
    </>
  );
}

export function CreatorNext({ read }: CreatorNextProps): React.JSX.Element {
  const router = useRouter();
  if (read.state === "failed") return <CreatorScreen state="failed" onRetry={() => router.refresh()} />;
  if (read.state === "gone") return <CreatorScreen state="gone" />;
  // Keyed by the creator: another creator starts with its own sheet and its own presses.
  return <ReadyCreator key={read.creator.handle} creator={read.creator} />;
}

/** The route's loading file under the new look: the page's outline, nothing sent. */
export function CreatorNextLoading(): React.JSX.Element {
  return <CreatorScreen state="loading" />;
}
