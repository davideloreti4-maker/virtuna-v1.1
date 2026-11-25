"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useThreadActions } from "@/components/shell/use-thread-actions";
import { useToast } from "@/components/ui/toast";
import { useAddChannel, type AddChannelError } from "@/hooks/queries/use-channels";
import { reportSession401 } from "@/lib/auth/session-expired";
import { followRefused } from "@/lib/discover-next/discover-words";
import type { PullTarget, PulledVideo } from "@/lib/discover-next/pull";
import { keepPullOnlyAt, takePull } from "@/lib/discover-next/pull-intent";
import { pulledVideoSaveOf } from "@/lib/discover-next/saved-ref";
import { leaveRemixFrom } from "@/lib/thread-next/remix-from";

import { PullScreen, PullScreenLoading, type FollowState } from "./pull-screen";
import { PulledSheet, type PulledSheetProps } from "./pulled-sheet";
import { RemixSheet } from "./remix-sheet";
import { usePull } from "./use-pull";
import { useVideoSave } from "./use-video-save";

/**
 * The pull page with its data (spec 3.6): `/feed/discover?input=…` under the new look. The route reads
 * what the input asks for and whether that creator is followed, and hands both in.
 *
 * - An address never starts a pull: a pull costs credits, and a link, a reload or Back must never spend
 *   them. On arrival the page takes the intent a Pull button armed just before it opened this page
 *   (`takePull`, once, for this input, within 15 seconds); only then does it start at once. Else it
 *   shows the offer, and only the offer's Pull starts. The take is kept in a ref, so React's second
 *   development-mode run of the effect neither loses it nor takes again.
 * - Follow (a creator): the app's own add (read the account, then follow it). Done: Following, and the
 *   page is read again so the hub's watchlist knows. Refused: a toast, and Follow again; a lapsed session
 *   is the app's own dialog, with no toast under it.
 * - A pulled card opens its sheet: Save (under the video's TikTok id, so Library opens its original) and
 *   Remix, which closes the sheet and asks what to make, then leaves the video for a new chat
 *   (`leaveRemixFrom`) and opens one (the shell's `newThreadAt`): Home's composer runs its own Remix on
 *   the link (its turn, its walls, one billed run). Nothing is sent from here. The focus comes back to the
 *   card when the question is closed without a remix.
 * - A pull is held by its input (`usePull`): a page left while it reads, or after, shows it reading or its
 *   cards when it opens again, and offers nothing to pay for twice.
 * - Another input is another page: its Follow and its sheet start again.
 */
export interface PullNextProps {
  /** What the address asks to pull (or a link that cannot be read). */
  subject: PullTarget;
  /** The creator is on the watchlist already (the server's read; a failed read says no). */
  followed: boolean;
}

/** The open video's sheet, with its own Save (keyed by the video: each starts with its own mark). */
function OpenedSheet({ video, ...rest }: Omit<PulledSheetProps, "saved" | "saveReady" | "onSave">) {
  const row = useMemo(() => pulledVideoSaveOf(video), [video]);
  const save = useVideoSave(row);
  // A list that could not be read is still a choice: a press asks for it again.
  return <PulledSheet video={video} saved={save.saved} saveReady={save.ready || save.unread} onSave={save.toggle} {...rest} />;
}

function PullPage({ subject, followed }: PullNextProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { state, start } = usePull(subject.kind === "not-tiktok" ? null : subject);
  const add = useAddChannel();
  const { newThreadAt } = useThreadActions();

  // Arrival: the intent a Pull button armed, taken once and kept.
  const taken = useRef<boolean | null>(null);
  useEffect(() => {
    if (taken.current !== null) return;
    taken.current = takePull(subject.input);
    if (taken.current) start();
  }, [subject, start]);

  const pull = () => start();

  // Follow. Out as of the last press, not the last render: two presses can land before one.
  const [follow, setFollow] = useState<FollowState>("idle");
  const following = useRef(false);
  const followState: FollowState | null = subject.kind === "handle" ? (followed ? "done" : follow) : null;
  const onFollow = async () => {
    if (subject.kind !== "handle" || followState !== "idle" || following.current) return;
    following.current = true;
    setFollow("running");
    try {
      await add.mutateAsync(subject.handle);
      setFollow("done");
      router.refresh();
    } catch (error) {
      setFollow("idle");
      const refusal = error as Partial<AddChannelError>;
      if (typeof refusal.status === "number" && reportSession401(refusal.status)) return;
      toast({ variant: "error", title: followRefused(subject.handle) });
    } finally {
      following.current = false;
    }
  };

  // The pulled video's sheet, the question before a remix, and the card they both go back to.
  const [opened, setOpened] = useState<PulledVideo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const card = useRef<HTMLElement | null>(null);
  const toCard = () => card.current;

  const open = (video: PulledVideo, from: HTMLElement) => {
    card.current = from;
    setOpened(video);
    setSheetOpen(true);
  };

  // A remix left for Home, from this card or another: every card's Remix waits until the page goes. A remix
  // is paid, and one is all a creator asked for. Left as of the last press, not the last render.
  const [waiting, setWaiting] = useState(false);
  const starting = useRef(false);
  const startRemix = (brief: string | null) => {
    const video = opened;
    if (!video || starting.current || waiting) return;
    if (!leaveRemixFrom({ url: video.videoUrl ?? "", platform: video.platform, brief })) return;
    starting.current = true;
    setWaiting(true);
    newThreadAt("/home");
  };

  return (
    <>
      <PullScreen target={subject} state={state} onPull={pull} follow={followState} onFollow={() => void onFollow()} onOpen={open} />
      {opened && (
        <OpenedSheet
          key={opened.id}
          video={opened}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          remixWaiting={waiting}
          onRemix={() => {
            setSheetOpen(false);
            setAsking(true);
          }}
          returnFocus={toCard}
        />
      )}
      <RemixSheet open={asking} onOpenChange={setAsking} onRemix={startRemix} returnFocus={toCard} />
    </>
  );
}

export function PullNext(props: PullNextProps): React.JSX.Element {
  return <PullPage key={`${props.subject.kind}:${props.subject.input}`} {...props} />;
}

/**
 * The route's loading file under the new look: the offer row's outline, nothing sent. It keeps the hub's
 * rule for a Pull press's intent: giving way to its pull page (the same address) keeps it; giving way to
 * anything else (the creator left before the page came) drops it, so Back to the address cannot start a
 * pull without a press.
 */
export function PullNextLoading(): React.JSX.Element {
  useEffect(() => () => keepPullOnlyAt(window.location.pathname + window.location.search), []);
  return <PullScreenLoading />;
}
