"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useVideoMeta } from "@/hooks/use-video-meta";
import { FPS, filmFrames, msOf, type Edit } from "@/lib/edit";
import { LIVE_JOB } from "@/lib/edit/edit-view";
import { findingKey, toCheck } from "@/lib/edit/kept";
import { lookName } from "@/lib/edit/said";
import { BeforeTheCut, Unshown } from "./before-the-cut";
import { CaptionsSheet } from "./captions-sheet";
import { chipsOf, lookKeyOfStyle, momentLabel, pausedMoment, playheadAfter, type NextChip } from "./edit-session";
import { EditorField, type FieldHandle } from "./editor-field";
import { EditorHeader } from "./editor-header";
import { EditorScrubber, type ScrubberProps } from "./editor-scrubber";
import { EditorStage, type StageHandle } from "./editor-stage";
import { CHECK_CHIP, EditorThread, type ThreadProps } from "./editor-thread";
import { EditorTools } from "./editor-tools";
import { ExportPanel } from "./export-panel";
import { FindingCard } from "./finding-card";
import { fixOf, sentenceOf, type Fix } from "./fixes";
import { LookSheet } from "./look-sheet";
import { filmFrameAt, plainEdit, plainFrameAt, takeMomentAt } from "./original";
import { clipOf, keepApp, postedLayout, readApp, type App } from "./posted";
import { PostedPreview } from "./posted-preview";
import type { Source } from "./read-style";
import { ReadySheet, madeFilm } from "./ready-sheet";
import { forgetUpload } from "./uploads";
import { useEdit, type EditApi } from "./use-edit";

/**
 * editor-screen.tsx — the editor page (spec 2026-11-24-editor-screens-design.md §3 screens 2-5 and 9-12, §5.1, §5.2, §5.4, E1,
 * E8, E19-E21; plan 2026-11-24-editor-screens-a, Task 15; rulings R17, R20, R23, R24, R27-R29): it picks the state
 * (`pageStateOf`, ten of them) and lays the page out, one tree for phone and desktop placed by CSS, so the video is never
 * mounted again on a resize.
 *
 * The page is as tall as the screen and does not scroll: the header (in the shell's band on a phone), the video (`--stage-h`:
 * 53 % of the screen's height, 254 × 452 on a 393 × 852 phone) with its scrubber directly under it, the tools, the conversation,
 * and the field docked at the bottom. The conversation is the one part that scrolls, and scrolls itself (R27). From lg up there
 * are two columns: the video and its scrubber on the left (348 × 619 in an 800-tall window), the tools, the conversation and
 * the field on the right (up to 500, 52 apart), the field's bottom a little under the scrubber's. Between a phone and that, the
 * phone's one column, centred. Only on a screen too short for it all does the page itself scroll.
 *
 * Every state has something happening or something to tap, and one problem at the most: the latest call that failed, else an
 * export that failed, else a video's style that could not be read; before the cut, the latest problem stands in the place of
 * the state's own sentence. Kept from the dev page: the playhead's place across a change, a first cut standing half a second
 * in and playing from its start, a request that failed back in the field, an export of the exact version asked for, and the
 * focus following the work (Task 17): to the field when the cut lands (the panel on a touch screen), back to the control a
 * sheet or a call took it from.
 *
 * Slice B (plan 2026-11-25-editor-screens-b): Original, in the tools row, shows the take as it was shot on the same Player at
 * the same moment, and turns off before anything that works on the film (E16, Task 5). The button beside it shows the video
 * as it will be posted (E17, Task 6, ruling S10): a phone drawn to scale and fitted whole in the window, the very stage promoted
 * by CSS to where that phone has its video, under our drawing of the app's buttons, while the rest of the page is inert.
 *
 * Slice B, Task 7 (E15): a request is about the moment the video is paused on. While it is paused inside the film, the field
 * shows that moment as a tag the creator can take away, and a request sent from the field goes out with it (`at`, the film
 * frame); with Original on, the film frame that shows the take's moment, where the film shows it. None while the video plays,
 * nor while it is seen as it will be posted; a chip's request and a look are about none.
 *
 * Slice B, Task 8 (§5.3): the chips follow from the change shown. A step's request goes out about the moment it names (a zoom's
 * piece), and "Put it back" is Undo; with the captions off, "Captions on" turns them on by hand, as the Captions sheet does, with
 * no model call. "N to check", the card and the scrubber's rings are what is left to check (`toCheck`): what was found less what
 * was put away. The line of a video's style being read, with its Stop, is the conversation's, in the chips' place.
 *
 * Slice B, Task 9 (E18): a problem arrives with its fix, one at a time, at its moment. "N to check" opens the card of the first
 * thing to check in the chips' place, and the video goes to its moment (paused there, Original off, the stage in view), as it
 * does at Next and when one put away gives its place to another. The fix is a request like any other, about the finding's frame;
 * "Keep it" puts the finding away (a call, `keep`), and the one now in its place is shown, or the card closes when none is left.
 */

/** How long a signed address is held before a newer one takes its place: the routes sign them for two hours. */
export const HOLD_MS = 90 * 60_000;

/**
 * One address a take (R23). Every read of the edit signs its take's addresses anew, and a new address makes the film, or the
 * take's own `<video>`, load it again from its start. So the first address a take is read with is held, and the page hands
 * that one on. After `HOLD_MS` the next address that arrives takes its place, never the one the page has at that moment, whose
 * age nobody knows. The page can say the same itself by counting `renewals` up: a device that slept ran no timer, and the
 * page then knows by the clock that the held one is old (R30). Null while the take has no address.
 */
export function useHeld(take: string | null, address: string | null, renewals = 0): string | null {
  const [held, setHeld] = useState<{ take: string; url: string; pass: string | null; renewals: number } | null>(null);
  if (take !== null && address !== null) {
    if (held === null || held.take !== take) setHeld({ take, url: address, pass: null, renewals });
    else if (held.pass !== null && address !== held.pass && address !== held.url) setHeld({ take, url: address, pass: null, renewals });
    else if (held.renewals !== renewals) setHeld({ ...held, renewals, pass: address });
  }
  const url = held?.url ?? null;
  const newest = useRef(address);
  useEffect(() => {
    newest.current = address;
  }, [address]);
  useEffect(() => {
    if (url === null) return;
    const timer = setTimeout(() => setHeld((now) => (now?.url === url ? { ...now, pass: newest.current ?? url } : now)), HOLD_MS);
    return () => clearTimeout(timer);
  }, [url]);
  return held !== null && held.take === take ? held.url : null;
}

/**
 * Where the video is, told at every frame it draws. Held outside the page's state and read by the scrubber alone, so the
 * conversation and the sheets are not drawn again thirty times a second while the film plays.
 */
function makePlayhead() {
  let frame = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => frame,
    set: (next: number) => {
      if (next === frame) return;
      frame = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

function Scrubber({ playhead, ...props }: Omit<ScrubberProps, "frame"> & { playhead: ReturnType<typeof makePlayhead> }) {
  const frame = useSyncExternalStore(playhead.subscribe, playhead.get, playhead.get);
  return <EditorScrubber frame={frame} {...props} />;
}

interface FieldProps {
  handle: React.Ref<FieldHandle>;
  text: string;
  onText(text: string): void;
  disabled: boolean;
  sending: boolean;
  playhead: ReturnType<typeof makePlayhead>;
  /** The video plays: no moment, and the playhead is not read. */
  playing: boolean;
  /** Whether a moment may be offered at all: a cut on the stage, the preview as it will be posted closed. */
  offered: boolean;
  /** The film's length in frames. */
  frames: number;
  /** The film frame the stage shows at the playhead's frame; null when it shows none of the film (see `filmAt`). */
  filmAt(frame: number): number | null;
  /** The moment of a request put back after it failed, held whatever the playhead does (`Draft.held`); null when none is held. */
  held: Held | null;
  /** The held moment is let go: its tag's x. */
  onLetGo(): void;
  onAsk(request: string, at: number | null): void;
}

/** The moment a request put back in the field was about: a film frame, or none at all. */
type Held = { at: number | null };
/**
 * The field's words, and, once a request that failed is put back in it, the moment that request was about, held (fix round 1
 * of Task 7): the field shows that moment whatever the playhead does, or none if it had none, and Send sends it. It is let go
 * when the field is sent (its words leave it), emptied, or its tag's x is pressed; the field then follows the playhead again.
 */
interface Draft {
  text: string;
  held: Held | null;
}
const NO_DRAFT: Draft = { text: "", held: null };

/**
 * The field, with the moment the request is about (E15): the film frame the video is paused on (`pausedMoment`), shown in it
 * as a tag the creator can take away; the moment taken away stays away on that frame and is offered again on another. A
 * request put back after it failed holds its own moment instead (`held`). The playhead is read here, not by the page, and
 * through a snapshot that is null while the video plays: neither the field nor the page is drawn again at each frame of a
 * film playing.
 */
function Field({ handle, playhead, playing, offered, frames, filmAt, held, onLetGo, onAsk, ...props }: FieldProps) {
  const frame = useSyncExternalStore(playhead.subscribe, () => (playing ? null : playhead.get()), () => null);
  /** The film frame whose moment was taken away. */
  const [dropped, setDropped] = useState<number | null>(null);
  const film = offered && frame !== null ? filmAt(frame) : null;
  /** The moment the playhead offers. */
  const live = film === null ? null : pausedMoment(film, frames, playing, dropped);
  const at = held === null ? live : offered ? held.at : null;
  const drop = () => {
    if (held === null) return setDropped(at);
    // The held moment goes, and is not replaced at once by the one the video stands on: that one is taken away with it.
    onLetGo();
    setDropped((was) => live ?? was);
  };
  return (
    <EditorField
      ref={handle} {...props} moment={at === null ? null : { frame: at, label: momentLabel(at) }}
      onDropMoment={drop} onSend={(request) => onAsk(request, at)}
    />
  );
}

/** The window's resizes, for the preview as it will be posted. */
function onResize(listener: () => void): () => void {
  window.addEventListener("resize", listener);
  return () => window.removeEventListener("resize", listener);
}
/**
 * The window's size while `on` (the preview is open), null while not: read as a string, so a resize while the preview is
 * closed changes nothing the page draws.
 */
function useWindowSize(on: boolean): { w: number; h: number } | null {
  const size = useSyncExternalStore(onResize, () => (on ? `${window.innerWidth}x${window.innerHeight}` : ""), () => "");
  if (size === "") return null;
  const [w = 0, h = 0] = size.split("x").map(Number);
  return { w, h };
}

/** Whether the device's main pointer is a finger: there the page focuses no text field, whose keyboard would cover the video. */
function touchScreen(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/** Focuses a control the creator had, when it can be had now: there, on, and no text field on a touch screen. Says if it was. */
function refocus(control: Element | null): boolean {
  if (!(control instanceof HTMLElement) || control === document.body || !control.isConnected || control.matches(":disabled")) return false;
  if (touchScreen() && control.matches("textarea, input")) return false;
  control.focus({ preventScroll: true });
  return document.activeElement === control;
}

/**
 * Runs `then` once no sheet is on the page. A closed sheet stays while it slides away, and the page under it is hidden from
 * assistive tech until it has gone (Radix): a focus given meanwhile would land in a part no screen reader reads. Answers its stop.
 */
function whenNoSheet(then: () => void): () => void {
  const open = () => document.querySelector("[data-slot=sheet-content]") !== null;
  if (!open()) {
    then();
    return () => {};
  }
  const watch = new MutationObserver(() => {
    if (open()) return;
    watch.disconnect();
    then();
  });
  watch.observe(document.body, { childList: true, subtree: true });
  return () => watch.disconnect();
}

/** What is said of a video's style that could not be read, when its read gave no sentence of its own. */
const STYLE_UNREAD = "The video's style could not be read.";

export function EditorScreen({ id, pollMs }: { id: string; pollMs?: number }) {
  const api = useEdit(id, pollMs === undefined ? {} : { pollMs });
  const { session, state, controls, upload, reading } = api;
  const { view, working, problem } = session;
  const take = view?.take ?? null;
  const takeId = take?.id ?? null;
  const turn = view?.shown ?? null;

  // The edit on the stage, kept per turn shown (R20): a read's fresh copy of the same turn is no other edit, to the Player or
  // to the playhead.
  const [onStage, setOnStage] = useState<{ turn: number; edit: Edit } | null>(null);
  if (view?.edit && turn !== null && onStage?.turn !== turn) setOnStage({ turn, edit: view.edit });
  if (view && turn === null && onStage !== null) setOnStage(null);
  const shown = onStage?.edit ?? null;

  // The take's addresses, one a take (R23): the film's, the take's own before the cut, and its picture's.
  const [renewals, setRenewals] = useState(0);
  const preview = useHeld(takeId, take?.previewUrl ?? null, renewals);
  const signedPoster = useHeld(takeId, take?.posterUrl ?? null, renewals);
  const urls = useMemo(() => (takeId !== null && preview !== null ? { [takeId]: preview } : {}), [takeId, preview]);

  // A tab left open and looked at again an hour and a half or more after the edit was last read reads it once (R30): the
  // addresses it holds have run out or soon will, and the fresh ones take their place, so the video plays. Not while a call
  // is out: its answer brings the edit afresh. The clock is read, not a timer waited on: a sleeping device runs none. And
  // the same when the connection comes back: a laptop opened again is seen before its network is there, so the read on the
  // look may not get through; the one that does puts the clock right, and nothing more is read.
  const readAt = useRef(0);
  useEffect(() => {
    readAt.current = Date.now();
  }, [view]);
  const idle = working === null;
  const readAgain = api.read;
  useEffect(() => {
    const looked = () => {
      if (document.visibilityState !== "visible" || !idle || Date.now() - readAt.current < HOLD_MS) return;
      setRenewals((n) => n + 1);
      readAgain();
    };
    document.addEventListener("visibilitychange", looked);
    window.addEventListener("online", looked);
    return () => {
      document.removeEventListener("visibilitychange", looked);
      window.removeEventListener("online", looked);
    };
  }, [idle, readAgain]);

  // What the browser reads of the device's copy: its length (the analysis's estimate) and a frame (the looks' pictures).
  const meta = useVideoMeta(upload?.file ?? null);
  const [takeFrames, setTakeFrames] = useState(0);
  const takeSeconds = meta.durationSec ?? (takeFrames > 0 ? takeFrames / FPS : null);
  const poster = signedPoster ?? meta.thumbnail;
  const words = take?.asset?.kind === "video" ? (take.asset.words ?? []).slice(0, 2).map((word) => word.text) : [];

  // The playhead: where the video is, and where it goes when another turn's edit is on the stage (`playheadAfter`).
  const stage = useRef<StageHandle>(null);
  const [playhead] = useState(makePlayhead);
  /** The frame a first cut stands on until it is played or moved; null once it has been. */
  const still = useRef<number | null>(null);
  const onFrame = useCallback((next: number) => {
    if (still.current !== null && next !== still.current) still.current = null;
    playhead.set(next);
  }, [playhead]);
  const onPlay = useCallback(() => {
    if (still.current === null) return;
    still.current = null;
    stage.current?.seek(0); // a cut standing half a second in is played from its start
  }, []);
  /** The video plays, as the stage's controls show it: a request is then about no moment (E15). */
  const [playing, setPlaying] = useState(false);

  // The take as it was shot (E16), on the same Player: the take with nothing on it, made once a take. While it is on, the stage
  // and the scrubber show it, and `original` holds the film frame it was turned on at and the take's frame it went to, so a
  // second tap with the video not moved comes back to the very frame it left. A toggle moves the video only once the edit it
  // puts on the stage is there (`goTo`, after the commit), and the video plays on if it played.
  const takeShown = shown?.shots[0]?.asset ?? null;
  const [plainOf, setPlainOf] = useState<{ take: string; edit: Edit | null } | null>(null);
  if (shown !== null && takeShown !== null && plainOf?.take !== takeShown) setPlainOf({ take: takeShown, edit: plainEdit(shown) });
  const plain = plainOf !== null && plainOf.take === takeShown ? plainOf.edit : null;
  const plainTake = plain?.shots[0]?.asset ?? null;
  const [original, setOriginal] = useState<{ film: number; plain: number } | null>(null);
  if (original !== null && shown === null) setOriginal(null);
  const onOriginal = original !== null && shown !== null && plain !== null;
  const onTheStage = onOriginal ? plain : shown;
  const goTo = useRef<{ frame: number; play: boolean } | null>(null);
  useLayoutEffect(() => {
    const to = goTo.current;
    if (to === null) return;
    goTo.current = null;
    stage.current?.seek(to.frame);
    if (to.play) stage.current?.play();
    else stage.current?.pause();
  }, [original]);
  /** The film frame Original comes back to on `film`: the very frame it left when the take was not moved, else the one that shows the take's moment. Null while it is off. */
  const backTo = (film: Edit): number | null => {
    if (original === null || plainTake === null) return null;
    const q = playhead.get();
    return q === original.plain ? original.film : filmFrameAt(film, plainTake, msOf(q, 1)).frame;
  };
  /**
   * The film frame the stage shows at the playhead's frame `q`, for the moment a request is about (E15): `q` itself while the
   * film is on the stage. While the take as it was shot is, the film frame that shows the take's moment `q` (`filmFrameAt`),
   * only where the film shows it (`exact`), else null; and on the very frame Original was turned on at while the take was not
   * moved, the one Original goes back to (`backTo`), so the moment is where the film lands when the request goes out.
   */
  const filmAt = (q: number): number | null => {
    if (!onOriginal) return q;
    if (shown === null || plainTake === null) return null;
    if (q === original.plain) return original.film;
    const film = filmFrameAt(shown, plainTake, msOf(q, 1));
    return film.exact ? film.frame : null;
  };
  /** Original off: the video goes to `to`, else by the rule above, playing on if it played. Nothing while it is off. */
  const leaveOriginal = (to?: { frame: number; play: boolean }) => {
    const back = shown === null ? null : backTo(shown);
    if (back === null) return;
    goTo.current = to ?? { frame: back, play: stage.current?.playing() ?? false };
    setOriginal(null);
  };
  const toggleOriginal = () => {
    if (shown === null || plain === null) return;
    still.current = null; // moved by the creator: a first cut standing still is no longer played from its start
    if (original !== null) return leaveOriginal();
    const f = playhead.get();
    const moment = takeMomentAt(shown, f);
    const p = moment !== null && moment.asset === plainTake ? plainFrameAt(plain, moment.ms) : 0;
    goTo.current = { frame: p, play: stage.current?.playing() ?? false };
    setOriginal({ film: f, plain: p });
  };
  /** Original off before a call that works on the film goes out: on the page, the video back on the film, before it is sent. */
  const offFirst = () => {
    if (original !== null) flushSync(() => leaveOriginal());
  };
  // As they are now, for the effects that turn Original off by themselves.
  const toOriginal = useRef({ backTo, leaveOriginal });
  useLayoutEffect(() => {
    toOriginal.current = { backTo, leaveOriginal };
  });

  const placed = useRef<{ turn: number | null; edit: Edit | null }>({ turn: null, edit: null });
  const moved = session.moved;
  useEffect(() => {
    const was = placed.current;
    if ((onStage?.turn ?? null) === was.turn) return;
    placed.current = { turn: onStage?.turn ?? null, edit: onStage?.edit ?? null };
    if (onStage === null) return;
    // Another turn shown turns Original off; the video goes where that turn puts it, from the frame of the film Original stood for.
    const left = was.edit === null ? null : toOriginal.current.backTo(was.edit);
    const plan = playheadAfter(was.edit, onStage.edit, left ?? playhead.get(), moved);
    still.current = plan.still ? plan.frame : null;
    if (left !== null) {
      toOriginal.current.leaveOriginal({ frame: plan.frame, play: plan.play });
      return;
    }
    stage.current?.seek(plan.frame);
    if (plan.play) stage.current?.play();
    else stage.current?.pause();
  }, [onStage, moved, playhead]);

  // The device's copy is let go once the cut plays from the take's preview.
  const cut = onStage !== null;
  const heldTake = upload?.takeId ?? null;
  useEffect(() => {
    if (cut && heldTake !== null) forgetUpload(heldTake);
  }, [cut, heldTake]);

  const [lookOpen, setLookOpen] = useState(false);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  /** The card of a thing to check: the turn whose things it shows, and which of them (its place in what is left to check). */
  const [card, setCard] = useState<{ turn: number; index: number } | null>(null);
  /** The finding a fix that failed was for, by its key: the card opens on it next time, once, while that turn is shown. */
  const [fixFailed, setFixFailed] = useState<{ turn: number; key: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(NO_DRAFT);
  /** The creator's typing: a field emptied lets its held moment go. */
  const onText = useCallback((text: string) => setDraft((now) => ({ text, held: text.trim() === "" ? null : now.held })), []);
  // A change whose answer was lost is put back in the field (below); when the read after it shows it made all the same, it
  // is taken out again (m5), unless something else has been typed there since.
  const [tookOut, setTookOut] = useState<string | null>(null);
  if (session.madeAfterAll !== tookOut) {
    const made = session.madeAfterAll;
    setTookOut(made);
    if (made !== null) setDraft((now) => (now.text.trim() === made ? NO_DRAFT : now));
  }
  /** The video whose style was asked for last, to read it again when that failed. */
  const [styleSource, setStyleSource] = useState<Source | null>(null);
  // The keyboard's focus follows the work (spec §5.2, kept from the dev page; Task 17). Where the work is: the field, or the
  // panel on a touch screen (no keyboard opens over the video) and while the field is off. When the cut lands it goes there.
  const field = useRef<FieldHandle>(null);
  const panel = useRef<HTMLElement>(null);
  const toWork = useCallback(() => {
    if (!touchScreen()) field.current?.focus();
    if (!field.current?.focused()) panel.current?.focus({ preventScroll: true });
  }, []);
  const hadCut = useRef(false);
  useEffect(() => {
    if (cut === hadCut.current) return;
    hadCut.current = cut;
    if (cut) toWork();
  }, [cut, toWork]);
  // A sheet closed gives it back to the control it was opened from, read before the sheet takes it (this layout effect runs
  // before Radix's): Radix gives it only to a trigger of the sheet's own, and the page opens these. An opener that is off (a
  // look was picked: its cut is out) has it back with the call's answer, below, the panel holding it till then.
  const sheet = lookOpen || captionsOpen || readyOpen;
  // Original is turned off before anything that works on the film (E16): a call going out (a finding put away is none: it
  // changes no film), a sheet opening. The page's own controls turn it off as they act; this is for what opens or goes out by
  // itself, as the Ready sheet of an export seen to its end. The stage shows the take until then, so the video comes back on
  // the film from the take's own frame.
  const onFilm = (working !== null && working.what !== "keep") || sheet;
  useLayoutEffect(() => {
    if (onFilm) toOriginal.current.leaveOriginal();
  }, [onFilm]);
  const opener = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (sheet) opener.current = document.activeElement ?? document.body;
  }, [sheet]);
  useEffect(() => {
    const was = opener.current;
    if (sheet || was === null) return;
    opener.current = null;
    return whenNoSheet(() => {
      if (was !== panel.current && refocus(was)) return;
      if (was.isConnected && was.matches(":disabled")) panel.current?.focus({ preventScroll: true });
      else toWork();
    });
  }, [sheet, toWork]);
  // Every control rests while a call is out (§5.2), and the one that had the focus loses it to the page's body. When the call
  // is answered it is given back to that control (`lastControl`: the last on the page to have it, the panel holding it is
  // none), or where the work is when that one is gone or still off; never when the creator has put it somewhere meanwhile.
  const lastControl = useRef<Element | null>(null);
  const wasOut = useRef(false);
  const out = working !== null;
  useEffect(() => {
    if (out === wasOut.current) return;
    wasOut.current = out;
    const at = document.activeElement;
    const adrift = at === null || at === document.body || at === panel.current || at.matches(":disabled");
    if (out || sheet || !adrift) return;
    if (!refocus(lastControl.current)) toWork();
  }, [out, sheet, toWork]);

  // The video as it will be posted (E17, S10): the app chosen and the turn it was opened on (null while it is closed), the
  // window's size while it is open, and where that puts the phone and the stage. It opens from its button, which takes the
  // focus back when it closes; it closes by itself only when its cut is gone (another turn shown, or none) or a sheet opens
  // (the Ready sheet of an export seen to its end), never for a read that failed meanwhile.
  const [posting, setPosting] = useState<{ app: App; turn: number } | null>(null);
  const win = useWindowSize(posting !== null);
  const posted = posting !== null && win !== null ? postedLayout(posting.app, win) : null;
  /** The stage has no sound, as it told: for the preview's own sound button. */
  const [muted, setMuted] = useState(false);
  const postedOpener = useRef<HTMLButtonElement>(null);
  const postedClose = useRef<HTMLButtonElement>(null);
  const wasPosted = useRef(false);
  useLayoutEffect(() => {
    const open = posting !== null;
    if (open === wasPosted.current) return;
    wasPosted.current = open;
    if (!open && !sheet && !refocus(postedOpener.current)) toWork();
  }, [posting, sheet, toWork]);

  // The export. Its Ready sheet is there as soon as the file is made (R28), and opens by itself, once, only for an export
  // this page saw at work (R30): one it watched to its end, or a Cancel answered with the file (R25). A file made before the
  // page was opened waits behind Export, which then shows the sheet and makes nothing. Closed, the sheet fetches no film (R31).
  const exported = view?.export ?? null;
  const film = madeFilm(exported);
  /** The export seen at work, until its file is seen. */
  const [watched, setWatched] = useState<string | null>(null);
  if (exported !== null && LIVE_JOB.has(exported.status) && exported.job !== watched) setWatched(exported.job);
  if (film !== null && film.job === watched) {
    setWatched(null);
    setReadyOpen(true);
  }
  if (film === null && readyOpen) setReadyOpen(false);

  /** A step of the creator's puts away what was said of a style that could not be read, as a call puts a problem away. */
  const pastStyle = () => {
    if (reading.status === "failed") api.stopReading();
  };
  /**
   * A change asked for, about the moment `at` when it has one (E15): a chip's request and a look's are about none. Its words
   * leave the field, and a moment held there with them. What was asked is not lost: one that failed is put back in the field
   * (when nothing else was typed there meanwhile) holding the moment it was about, or none, whatever the playhead did since.
   */
  const ask = async (request: string, at: number | null = null): Promise<boolean> => {
    offFirst();
    pastStyle();
    setDraft((now) => (now.text.trim() === request ? NO_DRAFT : now));
    const done = await api.ask(request, at);
    if (!done) setDraft((now) => (now.text === "" ? { text: request, held: { at } } : now));
    return done;
  };
  const move = (to: number | null) => {
    if (to === null) return;
    offFirst();
    pastStyle();
    void api.move(to);
  };
  const exportIt = () => {
    if (film !== null) {
      leaveOriginal();
      return setReadyOpen(true); // the file of the edit shown is made already
    }
    offFirst();
    pastStyle();
    void api.startExport();
  };
  const cancelExport = () => {
    offFirst();
    void api.cancelExport();
  };
  const openLook = () => {
    leaveOriginal();
    setLookOpen(true);
  };
  const openCaptions = () => {
    leaveOriginal();
    setCaptionsOpen(true);
  };
  /** The video as it will be posted, on the film: Original turned off first, the app chosen last on this device. */
  const openPosted = () => {
    if (onStage === null) return;
    leaveOriginal();
    setPosting({ app: readApp(), turn: onStage.turn });
  };
  const choosePosted = (app: App) => {
    setPosting((now) => now && { ...now, app });
    keepApp(app);
  };
  const readVideo = (source: Source) => {
    setStyleSource(source);
    api.readVideo(source);
  };
  /**
   * A change by hand. One that could not be made closes the Captions sheet, so its sentence in the conversation is read (R29).
   * The sheet stays on while its own change is out (a tap on the next word leaves the one being typed, which sends it, and
   * the tap itself must still land), so a second change can be made meanwhile: it waits for the first one's answer, calls
   * going one at a time, and is not sent when that one could not be made, whose sentence then stands.
   */
  const handOut = useRef<Promise<boolean> | null>(null);
  const byHand: EditApi["ops"] = async (list) => {
    pastStyle();
    const before = handOut.current;
    const mine = (async () => (before === null || (await before) ? api.ops(list) : false))();
    handOut.current = mine;
    const done = await mine;
    if (handOut.current === mine) handOut.current = null;
    if (!done) setCaptionsOpen(false);
    return done;
  };
  const onChip = (chip: NextChip) => {
    switch (chip.kind) {
      case "check": {
        // On the first thing to check, or on the one a fix that failed was for while it is still there: the video goes to its
        // moment as the card opens (below).
        if (turn === null) return;
        const again = fixFailed?.turn === turn ? findings.findIndex((each) => findingKey(each) === fixFailed.key) : -1;
        setFixFailed(null);
        return setCard({ turn, index: Math.max(again, 0) });
      }
      case "style":
        offFirst();
        return void api.applyVideoStyle();
      case "step":
        // A step that asks nothing puts the change back: Undo.
        return chip.step.request === null ? move(view?.undo ?? null) : void ask(chip.step.request, chip.step.at);
      case "hand":
        return void byHand(chip.ops);
      case "ask":
        return void ask(chip.text);
    }
  };
  /** A moment of the film shown, the video paused there: on the film, Original turned off first. */
  const show = (target: number) => {
    const frame = shown ? Math.min(target, filmFrames(shown) - 1) : target;
    if (onOriginal) leaveOriginal({ frame, play: false });
    else {
      stage.current?.pause();
      stage.current?.seek(frame);
    }
    document.getElementById("edit-stage")?.scrollIntoView({ block: "nearest" });
  };

  // What is left to check in the edit shown (R24; slice B, Task 8): what the review found there less what was put away, for
  // the card and the scrubber's rings, as the chip counts it.
  const shownTurnRow = view?.turns.find((each) => each.n === turn);
  const findings = toCheck(shownTurnRow?.findings ?? [], shownTurnRow?.kept ?? []);

  // The card of a thing to check (E18; slice B, Task 9). It closes when another turn is shown (as slice A's list did, R27), when
  // nothing is left to check, when a call other than a keep goes out (the fix sent from it among them), when a sheet or the
  // preview as it will be posted opens, and while the file is made (the conversation is not drawn then). When the one it showed
  // was put away, it shows the one now in that place, or the first when that was the last.
  if (card !== null && (card.turn !== turn || findings.length === 0 || (working !== null && working.what !== "keep") || sheet || posting !== null || controls.exporting)) {
    setCard(null);
  }
  const cardIndex = card !== null && card.index < findings.length ? card.index : 0;
  const cardFinding = card === null ? null : (findings[cardIndex] ?? null);
  // The video goes to the moment of the thing the card shows, whenever that is another: as the card opens, at Next, and when
  // the one put away gives its place to another. Not again for a read that brings the same.
  const cardShows = cardFinding === null || turn === null ? null : `${turn} ${findingKey(cardFinding)}`;
  const cardFrame = cardFinding?.where.frame ?? null;
  const toShow = useRef(show);
  useLayoutEffect(() => {
    toShow.current = show;
  });
  useEffect(() => {
    if (cardShows !== null && cardFrame !== null) toShow.current(cardFrame);
  }, [cardShows, cardFrame]);
  /** The fix, a request about the finding's frame, held inside the film. The card closes as it goes out. */
  const fixIt = async (fix: Fix) => {
    if (cardFinding === null || shown === null || turn === null) return;
    const was = { turn, key: findingKey(cardFinding) };
    if (!(await ask(fix.request, Math.min(cardFinding.where.frame, filmFrames(shown) - 1)))) setFixFailed(was);
  };
  const keepIt = () => {
    if (cardFinding === null) return;
    pastStyle();
    void api.keep(findingKey(cardFinding));
  };
  /** Closed by the creator: the focus back on "N to check", the chip it was opened from, else where the work is. */
  const closeCard = () => {
    flushSync(() => setCard(null));
    if (!refocus(document.getElementById(CHECK_CHIP))) toWork();
  };
  const filmSeconds = shown ? filmFrames(shown) / FPS : 0;
  const lastCut = view ? view.turns.map((each) => each.kind).lastIndexOf("cut") : -1;
  const changedSinceCut = !!view && view.turns.slice(lastCut + 1).some((each) => each.doc);
  // A look picked after the first cut reads as the request it becomes (R27); a change, with the moment it is about (E15).
  const pending: ThreadProps["pending"] =
    working?.what === "change" ? { request: working.request, at: working.at } : working?.what === "cut" ? { request: `Look: ${lookName(lookKeyOfStyle(working.look))}`, at: null } : null;
  // The one problem said in the conversation. A change's Try again is about the moment the change was about.
  const asked = problem?.request ?? null;
  const askedAt = problem?.at ?? null;
  const said: ThreadProps["problem"] = problem
    ? { text: problem.text, again: asked === null ? null : () => void ask(asked, askedAt) }
    : exported?.status === "failed"
      ? { text: "The video could not be made.", again: exportIt }
      : reading.status === "failed" && !lookOpen
        ? { text: reading.problem ?? STYLE_UNREAD, again: styleSource === null ? null : () => readVideo(styleSource) }
        : null;

  const unshown = state === "not read" || state === "not here" || state === "closed";
  const ready = (state === "ready" || state === "exporting") && view !== null;
  if (posting !== null && (unshown || onStage?.turn !== posting.turn || sheet)) setPosting(null);
  // The stage promoted to the preview: the video's whole frame placed on the window, cut to what the app shows of it.
  const frame: React.CSSProperties | null = posted && {
    position: "fixed", left: posted.video.left, top: posted.video.top, width: posted.video.width, height: posted.video.height,
    zIndex: "var(--z-modal)", clipPath: clipOf(posted),
  };
  return (
    <div
      data-part="editor" data-state={state}
      // The control given the focus last, on the page itself: a sheet's (in a portal, out of this element) and the panel are none.
      onFocus={(event) => {
        if (event.target !== panel.current && event.currentTarget.contains(event.target)) lastControl.current = event.target;
      }}
      className="flex h-[calc(100dvh-env(safe-area-inset-top)-var(--mobile-nav-band,46px))] flex-col overflow-x-hidden overflow-y-auto [--stage-h:min(53dvh,calc((100vw-32px)*16/9))] md:h-dvh lg:[--stage-h:clamp(360px,calc(100dvh-180px),720px)]"
    >
      <EditorHeader
        title={view?.title ?? ""} bare={unshown} canUndo={controls.undo} canRedo={controls.redo} inert={frame !== null}
        onUndo={() => move(view?.undo ?? null)} onRedo={() => move(view?.redo ?? null)}
        exportLabel={controls.exporting ? "Exporting" : "Export"} exportOn={controls.exportOn} onExport={exportIt}
      />
      {unshown ? (
        <Unshown state={state} gate={session.gate} onAgain={api.retry} />
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-[520px] flex-1 flex-col px-4 lg:grid lg:max-w-[1000px] lg:grid-cols-[auto_minmax(0,500px)] lg:items-start lg:justify-center lg:gap-x-[52px] lg:px-6 lg:pt-2.5">
          <section aria-label="Your video" className="flex shrink-0 flex-col items-center pt-1 lg:pt-0">
            <EditorStage
              ref={stage} edit={onTheStage} urls={urls} source={shown ? null : (upload?.localUrl ?? preview)} poster={poster}
              onFrame={onFrame} onFrames={setTakeFrames} onPlay={onPlay} onPlayingChange={setPlaying} onMutedChange={setMuted} badge={onOriginal ? "Original" : null} frame={frame}
              className="h-[var(--stage-h)]"
            />
            {/* The stage's place in the page while it is over the window, so nothing under the preview moves. */}
            {frame !== null && <div aria-hidden className="aspect-[9/16] h-[var(--stage-h)] shrink-0" />}
            {onTheStage && (
              // Directly under the video: the scrubber draws its own track 10 under its top (R23). The phone's is as wide as
              // the screen, the desktop's as the video, 16 under it. It is the scrubber of the edit on the stage; what was
              // found in the cut is not ringed on the take.
              <div inert={frame !== null} className="w-full lg:mt-1.5">
                <Scrubber
                  playhead={playhead} frames={filmFrames(onTheStage)} marks={onOriginal ? [] : findings.map((finding) => finding.where.frame)}
                  disabled={!controls.tools && !controls.exporting} onSeek={(target) => stage.current?.seek(target)}
                />
              </div>
            )}
          </section>
          <section ref={panel} tabIndex={-1} aria-label="Your edit" inert={frame !== null} className="flex min-h-52 min-w-0 flex-1 flex-col pt-1 outline-none lg:h-[calc(var(--stage-h)+77px)] lg:min-h-0 lg:flex-none">
            {ready ? (
              <>
                <EditorTools
                  disabled={!controls.tools} watching={plain !== null && working === null && (controls.tools || controls.exporting)} original={onOriginal}
                  onLook={openLook} onCaptions={openCaptions} onOriginal={toggleOriginal} onPreview={openPosted} previewRef={postedOpener}
                />
                {controls.exporting && exported ? (
                  <ExportPanel shown={exported} filmSeconds={filmSeconds} onCancel={cancelExport} cancelling={working?.what === "cancel"} />
                ) : (
                  <EditorThread
                    turns={view.turns} pending={pending} undoable={view.undo !== null} onUndo={() => move(view.undo)}
                    chips={chipsOf(view, reading.status === "ready")} onChip={onChip} problem={said} disabled={!controls.ask}
                    card={
                      cardFinding !== null && shown !== null ? (
                        <FindingCard
                          finding={cardFinding} sentence={sentenceOf(cardFinding, shown)} fix={fixOf(cardFinding, shown)} index={cardIndex} count={findings.length}
                          disabled={!controls.ask} onFix={(fix) => void fixIt(fix)} onKeep={keepIt} onShow={() => show(cardFinding.where.frame)}
                          onNext={() => setCard((now) => now && { ...now, index: (cardIndex + 1) % findings.length })} onClose={closeCard}
                        />
                      ) : null
                    }
                    status={
                      reading.status === "reading" ? (
                        <div className="flex shrink-0 items-center gap-3 px-0.5">
                          <p role="status" className="min-w-0 flex-1 text-meta text-foreground-secondary">{`Reading the video's style. ${reading.line ?? ""}`}</p>
                          <button type="button" onClick={api.stopReading} className="tap-44 shrink-0 text-meta font-[600] text-foreground">
                            Stop
                          </button>
                        </div>
                      ) : null
                    }
                  />
                )}
                <div className="mt-auto shrink-0 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:pb-0">
                  <Field
                    handle={field} text={draft.text} onText={onText} disabled={!controls.ask} sending={working?.what === "change"}
                    playhead={playhead} playing={playing} offered={shown !== null && posting === null} frames={shown ? filmFrames(shown) : 0} filmAt={filmAt}
                    held={draft.held} onLetGo={() => setDraft((now) => ({ ...now, held: null }))} onAsk={(request, at) => void ask(request, at)}
                  />
                </div>
              </>
            ) : state === "loading" ? (
              // The frame of the page and no spinner over it (§5.1): that it is opening is said to assistive tech alone.
              <p role="status" className="sr-only">
                Opening your edit…
              </p>
            ) : (
              <div className="pt-2">
                <BeforeTheCut api={api} poster={poster} words={words} takeSeconds={takeSeconds} />
              </div>
            )}
          </section>
        </div>
      )}
      {ready && (
        <LookSheet
          open={lookOpen} onOpenChange={setLookOpen} picked={view.look} poster={poster} words={words} changed={changedSinceCut} disabled={!controls.tools}
          onPick={(look) => void api.cut(look)} reading={reading} onReadVideo={readVideo} onStopReading={api.stopReading}
        />
      )}
      {ready && shown && takeId !== null && (
        <CaptionsSheet open={captionsOpen} onOpenChange={setCaptionsOpen} edit={shown} takeId={takeId} disabled={!controls.tools && working?.what !== "ops"} onOps={byHand} onSeek={(target) => stage.current?.seek(target)} />
      )}
      {posting !== null && posted !== null && shown !== null && (
        <PostedPreview
          app={posting.app} onApp={choosePosted} onClose={() => setPosting(null)} layout={posted} title={view?.title ?? ""} closeRef={postedClose}
          muted={muted} onMute={() => stage.current?.toggleMute()}
          // The film's own scrubber over the black: nothing found is ringed on the video as it will be posted.
          scrubber={
            <Scrubber
              playhead={playhead} frames={filmFrames(shown)} marks={[]} disabled={!controls.tools && !controls.exporting}
              onSeek={(target) => stage.current?.seek(target)} onFootage
            />
          }
        />
      )}
      {film !== null && exported !== null && (
        <ReadySheet
          open={readyOpen} onOpenChange={setReadyOpen} job={film.job} filmUrl={film.url} poster={poster}
          seconds={exported.ms === null ? filmSeconds : exported.ms / 1000} sound={take?.asset?.kind === "video" ? take.asset.sound : true}
        />
      )}
    </div>
  );
}
