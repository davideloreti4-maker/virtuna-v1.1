"use client";

import { useEffect, useRef, useState } from "react";

import { CreatorScreen } from "@/components/discover-next/creator-screen";
import { PulledSheet } from "@/components/discover-next/pulled-sheet";
import { RemixSheet } from "@/components/discover-next/remix-sheet";
import type { CreatorPage } from "@/lib/discover-next/creator";
import type { PulledVideo } from "@/lib/discover-next/pull";

import {
  DEV_CREATOR,
  DEV_CREATOR_AUDIENCE,
  DEV_CREATOR_EMPTY,
  DEV_CREATOR_FRESH,
  DEV_CREATOR_HELD,
  DEV_CREATOR_LONG,
  readJustNow,
} from "./creator-fixtures";

/**
 * A followed creator's page on local state, for /dev/discover (`page.tsx`): the real screen, pulled sheet
 * and Remix sheet over made-up creators (`creator-fixtures.ts`, run through the real rule that builds the
 * page). Nothing here sends anything: Read again reads for 1.5 s, then the line says today and the button
 * is dimmed; Simulate waits 1.5 s and stops; Pull, Remove, Try again and Remix's question start nothing;
 * Save marks here only; Build their audience is the real link.
 *
 * - creator: @jay.makes as built: four figures, Build their audience, Pull, twelve videos
 * - creator-audience: with an audience of theirs: Simulate a video for their viewers, built 14 Nov
 * - creator-fresh: read this morning: Read again dimmed, and why
 * - creator-reading: a read out: Read again turning, "Reading…" in the line (it stays there)
 * - creator-held: their read failed: Couldn't be read and its sentence, nothing else
 * - creator-empty: no videos read: the sentence where the grid would be
 * - creator-long: the page at its worst: the longest name, bio, handle and captions a stranger can write
 * - creator-gone: not on the watchlist · creator-failed: the alert and Try again · creator-loading: the outline
 * - creator-sheet: the first video's sheet, open on arrival
 */

export type DevCreatorState =
  | "creator"
  | "creator-audience"
  | "creator-fresh"
  | "creator-reading"
  | "creator-held"
  | "creator-empty"
  | "creator-long"
  | "creator-gone"
  | "creator-failed"
  | "creator-loading"
  | "creator-sheet";

type ReadyState = Exclude<DevCreatorState, "creator-gone" | "creator-failed" | "creator-loading">;

const START: Record<ReadyState, CreatorPage> = {
  creator: DEV_CREATOR,
  "creator-audience": DEV_CREATOR_AUDIENCE,
  "creator-fresh": DEV_CREATOR_FRESH,
  "creator-reading": DEV_CREATOR,
  "creator-held": DEV_CREATOR_HELD,
  "creator-empty": DEV_CREATOR_EMPTY,
  "creator-long": DEV_CREATOR_LONG,
  "creator-sheet": DEV_CREATOR,
};

/** How long a made-up read or choice takes here. */
const WAIT_MS = 1500;

const noop = () => {};

/** The first card of the grid: what the sheet open on arrival hands the focus back to. */
const firstCard = () => document.querySelector<HTMLElement>('[data-part="videos"] li button');

function DevReady({ state }: { state: ReadyState }) {
  const [creator, setCreator] = useState<CreatorPage>(START[state]);
  const [reading, setReading] = useState(state === "creator-reading");
  const [simulating, setSimulating] = useState(false);
  const [opened, setOpened] = useState<PulledVideo | null>(state === "creator-sheet" ? (START[state].videos[0] ?? null) : null);
  const [sheetOpen, setSheetOpen] = useState(state === "creator-sheet");
  const [asking, setAsking] = useState(false);
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());
  const card = useRef<HTMLElement | null>(null);
  const toCard = () => card.current ?? firstCard();

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const later = (fn: () => void) => timers.current.push(setTimeout(fn, WAIT_MS));

  return (
    <>
      <CreatorScreen
        state="ready"
        creator={creator}
        reading={reading}
        onReadAgain={() => {
          // As the page: a creator read in the last day is not read again (the real one says why in a
          // toast, which this page has no host for).
          if (reading || !creator.canReadAgain) return;
          setReading(true);
          later(() => {
            setReading(false);
            setCreator(readJustNow);
          });
        }}
        simulating={simulating}
        onSimulate={() => {
          if (simulating) return;
          setSimulating(true);
          later(() => setSimulating(false));
        }}
        onPull={noop}
        onOpen={(video, from) => {
          card.current = from;
          setOpened(video);
          setSheetOpen(true);
        }}
        onRemove={noop}
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
          returnFocus={toCard}
        />
      )}
      <RemixSheet open={asking} onOpenChange={setAsking} onRemix={noop} returnFocus={toCard} />
    </>
  );
}

export function DevCreator({ state }: { state: DevCreatorState }) {
  if (state === "creator-loading") return <CreatorScreen state="loading" />;
  if (state === "creator-gone") return <CreatorScreen state="gone" />;
  if (state === "creator-failed") return <CreatorScreen state="failed" onRetry={noop} />;
  return <DevReady state={state} />;
}
