"use client";

/**
 * uploads.ts — the uploads in flight, held outside any page (spec §5.2, E21; plan 2026-11-24-editor-screens-a, Task 9), so the
 * take sent from Home keeps uploading while the app moves to its editor (`router.push`). The file goes straight into R2 at the
 * address the take was signed for, then its finish is told (`POST /api/edit/takes/[id]/uploaded`), which starts its analysis.
 * Each upload says how far it is, the time left from what it has measured (`uploadSecondsLeft`), and the address of the
 * device's own copy, so the take plays at once. A failed one says whether trying again can work (`again`, ruling R17), and is
 * then tried again from where it failed: the PUT, or only the finish. One whose finish is refused because another analysis
 * of the creator's runs (one at a time, A1) is no failure: every byte is in storage, so it waits, its finish told again every
 * `WAIT_EVERY_MS` for `MOST_WAIT_MS` (R31), and only then fails, in the route's words, to be tried again. One that is
 * forgotten (its take replaced or given up) has its PUT in flight stopped, and tells nothing more: no step, no finish, so no
 * analysis is started for it, and no error, since a PUT stopped on purpose is no failure. A reload loses them all, and the
 * page then says the upload stopped.
 */
import { useSyncExternalStore } from "react";
import { RATE_WINDOW_MS, uploadSecondsLeft, type Sample } from "@/lib/edit/waits";
import { Refused, call, problemOf, put } from "./net";

/** `waiting`: every byte is in storage, and its finish waits for another analysis of the creator's to end (R31). */
export type UploadStatus = "sending" | "finishing" | "waiting" | "sent" | "failed";

export interface Upload {
  takeId: string;
  file: File;
  /** The device's own copy, played before the take is ready. */
  localUrl: string;
  status: UploadStatus;
  sent: number;
  total: number;
  /** The time left as measured, for the upload's line. Null whenever there is none to say: until a second of it is measured, once every byte has gone, and when it stopped. */
  secondsLeft: number | null;
  error: string | null;
  /**
   * Whether trying again can work, so whether the page offers "Try again" (it always offers "Pick the video again"). True only
   * for one that failed and may pass another time: its PUT got no answer, or its finish was not taken yet. False for one the
   * address refused or whose take is no longer waiting for its upload, and while nothing has failed.
   */
  again: boolean;
  /**
   * Whether it failed because its finish was refused for another analysis of the creator's all the time it waited: its
   * `error` is then the route's own sentence, which the page says (R31). False otherwise.
   */
  waitedOut: boolean;
}

/** What an upload reaches: the PUT, the clock, the device's copies. The holder is the same with or without them. */
export interface UploadDeps {
  put?: typeof put;
  now?: () => number;
  objectUrl?: (file: File) => string;
  revoke?: (url: string) => void;
}

interface Held {
  upload: Upload;
  url: string;
  type: string;
  samples: Sample[];
  /** The file is in R2: a retry tells only the finish. */
  putDone: boolean;
  /** What stops the PUT that is going; each try has its own. Null until the first one starts. */
  going: AbortController | null;
  /** How many times its finish was told again while it waited, this try. */
  waits: number;
  /** The next telling of its finish while it waits; null when none is armed. */
  later: ReturnType<typeof setTimeout> | null;
  deps: Required<UploadDeps>;
}

export const NOT_SENT = "The upload stopped. Check your connection and try again.";
/** For an upload that trying again cannot help: the connection is not blamed, and the way on is named. */
export const NOT_ACCEPTED = "The upload was not accepted. Pick the video again.";
/**
 * How long the finish may take to be answered: just over the minute its route may run (`maxDuration`), which waits up to half
 * of one on the worker's start. At a call's usual half minute (`CALL_MS`) the page would give up a moment before the route
 * answers, and a Try again made then could cross the first telling.
 */
const FINISH_MS = 65_000;
/** How often the finish of an upload that waits for another analysis of the creator's is told again (R31). */
export const WAIT_EVERY_MS = 10_000;
/** How long it is told again for, every `WAIT_EVERY_MS`: then the route's sentence is said, with Try again (R31). */
export const MOST_WAIT_MS = 5 * 60_000;
/** The route's refusal of a finish while another analysis of the creator's runs (`finishUpload`, A1). */
const BEHIND = /^an analysis of yours is already running/;
/** The least time between two tellings of a PUT's progress: a browser tells every 50 ms at the most. */
const TOLD_EVERY_MS = 50;
/** The most measures kept: the window the rate is measured over (`RATE_WINDOW_MS`) at the fastest telling, twice over. */
const MOST_SAMPLES = (2 * RATE_WINDOW_MS) / TOLD_EVERY_MS;

const held = new Map<string, Held>();
const listeners = new Set<() => void>();
const tell = () => {
  for (const listener of listeners) listener();
};
/** Whether this upload is still the one held for its take: not once it is forgotten, or its take was started again. */
const isHeld = (entry: Held) => held.get(entry.upload.takeId) === entry;
/** A step of an upload, told to whoever listens. A forgotten upload has no more steps. */
const update = (entry: Held, more: Partial<Upload>) => {
  if (!isHeld(entry)) return;
  entry.upload = { ...entry.upload, ...more };
  tell();
};

async function finish(entry: Held): Promise<void> {
  // One that waits is seen waiting while its finish is told again, not finishing every ten seconds.
  if (entry.upload.status !== "waiting") update(entry, { status: "finishing", sent: entry.upload.total, secondsLeft: null, error: null, again: false, waitedOut: false });
  const told = await call<unknown>(`/api/edit/takes/${entry.upload.takeId}/uploaded`, {}, "POST", FINISH_MS);
  const said = told.body.error ?? "";
  // Told already (an answer lost and then a retry, or another finish that got there first): the take is analysing or ready,
  // and goes on. The route says it in two sentences (`finishUpload` in `src/app/api/edit/upload.ts`); the test reads both there.
  const already = told.status === 409 && /is (analysing|ready): it is not waiting for its upload|is no longer waiting for its upload/.test(said);
  if (told.ok || already) return update(entry, { status: "sent" });
  // Another analysis of the creator's runs: nothing is wrong with this one, which starts when that one ends. Its finish is told
  // again every ten seconds, five minutes long; then the route's sentence is said, and Try again waits as long again.
  if (told.status === 409 && BEHIND.test(said)) {
    if (!isHeld(entry)) return;
    if (entry.waits < MOST_WAIT_MS / WAIT_EVERY_MS) {
      if (entry.upload.status !== "waiting") update(entry, { status: "waiting" });
      entry.later = setTimeout(() => {
        entry.later = null;
        entry.waits += 1;
        if (isHeld(entry)) void finish(entry);
      }, WAIT_EVERY_MS);
      return;
    }
    return update(entry, { status: "failed", error: problemOf(told), again: true, waitedOut: true });
  }
  // The take is not there, or is past its upload another way (a failed one): its finish cannot be told another time.
  const over = told.status === 404 || (told.status === 409 && /not waiting for its upload/.test(said));
  update(entry, over ? { status: "failed", error: NOT_ACCEPTED, again: false } : { status: "failed", error: problemOf(told), again: true });
}

async function send(entry: Held): Promise<void> {
  const { deps } = entry;
  if (entry.putDone) return finish(entry);
  entry.samples = [{ at: deps.now(), sent: 0 }];
  const going = new AbortController();
  entry.going = going;
  update(entry, { status: "sending", sent: 0, secondsLeft: null, error: null, again: false, waitedOut: false });
  try {
    await deps.put(entry.url, entry.upload.file, (sent) => {
      entry.samples = [...entry.samples, { at: deps.now(), sent }].slice(-MOST_SAMPLES);
      const left = uploadSecondsLeft(entry.samples, entry.upload.total);
      // Every byte gone is 0 s left by the measure, and no time left to say: the wait is then R2's answer and the finish.
      update(entry, { sent, secondsLeft: left === 0 ? null : left });
    }, entry.type, going.signal);
  } catch (cause) {
    if (!isHeld(entry)) return; // stopped by a forget: a PUT stopped on purpose is no failure, and nothing is told of it
    // The address refused the file (its hour has run out): putting it there again cannot work. Anything else may.
    const refused = cause instanceof Refused;
    return update(entry, { status: "failed", secondsLeft: null, error: refused ? NOT_ACCEPTED : NOT_SENT, again: !refused });
  }
  if (!isHeld(entry)) return; // forgotten while it went: its finish is not told, so no analysis is started for it
  entry.putDone = true;
  return finish(entry);
}

/** Starts the upload of a take just signed for: its file to `uploadUrl`, as `type`. An upload already held for the take is forgotten first, its PUT stopped. */
export function startUpload(take: { id: string; uploadUrl: string; type: string }, file: File, deps: UploadDeps = {}): Upload {
  forgetUpload(take.id);
  const full: Required<UploadDeps> = {
    put: deps.put ?? put,
    now: deps.now ?? Date.now,
    objectUrl: deps.objectUrl ?? ((each) => URL.createObjectURL(each)),
    revoke: deps.revoke ?? ((url) => URL.revokeObjectURL(url)),
  };
  const entry: Held = {
    upload: { takeId: take.id, file, localUrl: full.objectUrl(file), status: "sending", sent: 0, total: file.size, secondsLeft: null, error: null, again: false, waitedOut: false },
    url: take.uploadUrl, type: take.type, samples: [], putDone: false, going: null, waits: 0, later: null, deps: full,
  };
  held.set(take.id, entry);
  tell();
  void send(entry);
  return entry.upload;
}

/** Tries a failed upload again, from where it failed; nothing for one that trying again cannot help (`again`). A finish refused for another analysis waits as long again. */
export function retryUpload(takeId: string): void {
  const entry = held.get(takeId);
  if (entry?.upload.status !== "failed" || !entry.upload.again) return;
  entry.waits = 0;
  void send(entry);
}

export function uploadOf(takeId: string): Upload | null {
  return held.get(takeId)?.upload ?? null;
}

/**
 * Lets an upload go: its PUT in flight is stopped (no more bytes go), from here on it tells nothing more (no step, no finish,
 * no error), and the address of the device's copy is given back. A picked file stays on the device's disk; what the holder
 * kept of it is a handle and that address, not its bytes.
 */
export function forgetUpload(takeId: string): void {
  const entry = held.get(takeId);
  if (!entry) return;
  held.delete(takeId);
  entry.going?.abort();
  if (entry.later !== null) clearTimeout(entry.later);
  entry.deps.revoke(entry.upload.localUrl);
  tell();
}

export function subscribeUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The upload of a take, as it goes; null when none is held (a reload, another device). */
export function useUpload(takeId: string | null): Upload | null {
  return useSyncExternalStore(subscribeUploads, () => (takeId === null ? null : uploadOf(takeId)), () => null);
}
