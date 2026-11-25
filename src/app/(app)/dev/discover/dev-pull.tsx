"use client";

import { useEffect, useRef, useState } from "react";

import { PullScreen, type FollowState } from "@/components/discover-next/pull-screen";
import { PulledSheet } from "@/components/discover-next/pulled-sheet";
import { RemixSheet } from "@/components/discover-next/remix-sheet";
import { pullFailureOf, pulledCardsOf, type PullState, type PullSubject, type PullTile, type PulledVideo } from "@/lib/discover-next/pull";

import { DEV_VIDEOS } from "./fixtures";

/**
 * The pull page on local state, for /dev/discover (`page.tsx`): the real screen, pulled sheet and Remix
 * sheet over a made-up creator and made-up videos (built from `fixtures.ts`, run through the real rule
 * that turns an answer into cards). Nothing here sends anything: Pull and Try again read for 1.5 s and
 * then show the cards, Follow waits 1.5 s and then reads Following, Save marks here only, Remix asks its
 * question and starts nothing.
 *
 * - pull-offer: arrived by the address: the offer row and Follow
 * - pull-running: the sentence and the outlines (it stays there)
 * - pull-done: the cards (captions without their hashtags; one past 100, two not proven, one with no line)
 * - pull-empty: no standout videos · pull-limit: the daily limit · pull-failed: Couldn't read, Try again
 */

export type DevPullState = "pull-offer" | "pull-running" | "pull-done" | "pull-empty" | "pull-limit" | "pull-failed";

const SUBJECT: PullSubject = { kind: "handle", input: "@kai.wanders", handle: "kai.wanders", shown: "@kai.wanders" };

/** What the made-up answer's videos say, after their spoken lines: hashtags the cards leave out. */
const TAGS = ["#travel #fyp", "#trainlife", "", "#europe #budget #fyp", "#foryou"];
/** The multiples, in the server's order (its ranking): one past 100, two under 3 (not proven). */
const MULTIPLES = [412, 38, 27, 21, 16, 12.4, 9.1, 7.6, 5.2, 4.4, 2.8, 1.9];

const TILES: PullTile[] = MULTIPLES.map((multiplier, i) => {
  const from = DEV_VIDEOS[i]!;
  const line = i === 5 ? "" : (from.spokenHook ?? "");
  return {
    platformVideoId: `dev-p${String(i + 1).padStart(2, "0")}`,
    videoUrl: `https://videos.example/kai.wanders/${i + 1}`,
    caption: `${line} ${TAGS[i % TAGS.length]}`.trim(),
    views: Math.round(from.views * 0.8),
    likes: Math.round(from.views * 0.06),
    comments: Math.round(from.views * 0.0012),
    postedAt: from.postedAt ?? "2026-05-01T12:00:00Z",
    multiplier,
    baselineLabel: "vs their usual views",
    coverUrl: from.coverUrl ?? undefined,
    author: { handle: "kai.wanders" },
  };
});

const PULLED: PulledVideo[] = pulledCardsOf(TILES, SUBJECT) ?? [];

const START: Record<DevPullState, PullState> = {
  "pull-offer": { kind: "idle" },
  "pull-running": { kind: "running" },
  "pull-done": { kind: "done", videos: PULLED },
  "pull-empty": { kind: "done", videos: [] },
  "pull-limit": { kind: "failed", failure: pullFailureOf(429, { limit: 20 }, SUBJECT) },
  "pull-failed": { kind: "failed", failure: pullFailureOf(502, null, SUBJECT) },
};

/** How long a made-up read or follow takes here. */
const READ_MS = 1500;

const noop = () => {};

export function DevPull({ state }: { state: DevPullState }) {
  const [pull, setPull] = useState<PullState>(START[state]);
  const [follow, setFollow] = useState<FollowState>("idle");
  const [opened, setOpened] = useState<PulledVideo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());
  const card = useRef<HTMLElement | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const later = (fn: () => void) => timers.current.push(setTimeout(fn, READ_MS));

  return (
    <>
      <PullScreen
        target={SUBJECT}
        state={pull}
        onPull={() => {
          setPull({ kind: "running" });
          later(() => setPull({ kind: "done", videos: PULLED }));
        }}
        follow={follow}
        onFollow={() => {
          setFollow("running");
          later(() => setFollow("done"));
        }}
        onOpen={(video, from) => {
          card.current = from;
          setOpened(video);
          setSheetOpen(true);
        }}
      />
      {opened && (
        <PulledSheet
          key={opened.id}
          video={opened}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          saved={saved.has(opened.id)}
          saveReady
          onSave={() =>
            setSaved((now) => {
              const next = new Set(now);
              if (!next.delete(opened.id)) next.add(opened.id);
              return next;
            })
          }
          remixWaiting={false}
          onRemix={() => {
            setSheetOpen(false);
            setAsking(true);
          }}
          returnFocus={() => card.current}
        />
      )}
      <RemixSheet open={asking} onOpenChange={setAsking} onRemix={noop} returnFocus={() => card.current} />
    </>
  );
}
