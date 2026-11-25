"use client";

/**
 * agent.tsx — the page where a creator tries the edit agent (Task 13b): its state and its calls. On the left the phone, the
 * Player with the take and then the cut; on the right the panel, in two states: "How should it look?" (`StylePicker`), and,
 * once the first cut is made, what was done, how close it is to the style, the conversation and the field to ask for a change.
 *
 * The state is the page's own (`session.ts`): a reload starts over. Every control is off while a call of the agent's is out;
 * a video being made for download turns off only Download, and one that cannot be followed is given up on, so a creator can
 * always get back to their cut (`download.ts`, which also says which controls are on). A video's style being read is
 * stopped when the creator picks another row or leaves the page, and nothing read late is applied.
 *
 * The Player keeps its place in the film across a change when that frame is still there; a first cut stands half a second
 * in, where its title and first captions are seen, and plays from its start. The keyboard's focus follows the work: to the
 * request field when the cut lands (on a touch screen to the cut's panel, so no keyboard opens over the video), back to the
 * chosen row after starting over.
 */
import type { PlayerRef } from "@remotion/player";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { applyOps, filmFrames, newEdit, type Asset, type Edit } from "@/lib/edit";
import { call, useJob } from "../shared";
import { Details } from "./Details";
import { MOST_UNREAD, controlsOf, downloadOf, type Film } from "./download";
import { Findings } from "./Findings";
import { MatchRow } from "./MatchRow";
import { Phone, Takes, type Listed } from "./Phone";
import { CUTTING, FIRST, problemOf, ready, styleOf } from "./picking";
import { readStyle } from "./reference";
import { RequestField, Suggestions, type FieldHandle } from "./RequestField";
import { START, editOf, findingsOf, reduce, type Answer } from "./session";
import { HEADLINE, StylePicker, type Picked } from "./StylePicker";
import { Say, Thread } from "./Thread";
import { UnderPhone } from "./UnderPhone";

declare global {
  interface Window {
    /** The dev page's player, for a test or a person at the console to seek and play. */
    __editPlayer?: PlayerRef | null;
  }
}

/**
 * The page's own measures (no tokens): how tall the phone is, and the two columns from 900 px.
 * - Narrow: the phone takes `--phone-share` of the screen's height (less before the first cut, when the choice matters more
 *   than the take), and never more than the screen is wide. Once there is a cut, the video and the row under it stay on
 *   screen while the conversation moves under them (`edit-agent-held`), so a change is seen as its answer is read; not on a
 *   screen too short for both.
 * - Wide: the phone is as tall as fits, 420 to 720 px, less the takes' row above it when that shows; its column keeps the
 *   width of the tallest phone, so the panel does not move when the takes' row goes.
 * - The Player's own time label: the Player gives it a width and an ellipsis but lets it wrap, so on a small phone it stood
 *   on two lines. It is held to one, and left out where the phone is too narrow for it at all.
 * And the run of the bar that has no share (`Bar.tsx`).
 */
const STYLES = `
.edit-agent { --above: 0px; --phone-h: min(var(--phone-share), calc((100vw - 32px) * 16 / 9)); }
.edit-agent[data-takes] { --above: 76px; }
@media (max-width: 899px) and (min-height: 600px) {
  .edit-agent-held { position: sticky; top: 0; z-index: 20; margin-inline: -16px; padding-inline: 16px; background: var(--color-background); border-bottom: 1px solid var(--color-border); }
}
@media (min-width: 900px) {
  .edit-agent { --room: clamp(420px, calc(100dvh - 132px), 720px); --phone-h: calc(var(--room) - var(--above)); }
  .edit-agent-columns { grid-template-columns: calc(var(--room) * 9 / 16) minmax(400px, 440px); justify-content: center; align-items: start; }
}
.edit-agent-stage { container-type: inline-size; }
.edit-agent-stage div[style*="text-overflow"] { white-space: nowrap; }
@container (max-width: 214px) { .edit-agent-stage div[style*="text-overflow"] { display: none; } }
@keyframes edit-agent-run { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
`;

/**
 * Where a first cut stands until it is played: half a second in. At its very first frame a cut looks like the take it was
 * made from (the title is still coming in, the first word is not yet said); here its title and its first captions are on.
 */
const STILL = 15;

interface Take {
  id: string;
  asset: Asset;
  previewUrl: string;
}

/** The take as it was shot: all of it, with nothing on it. What the phone shows before the first cut. */
function plainEdit(asset: Asset): Edit | null {
  try {
    const made = applyOps(newEdit(asset), [{ op: "captions.set", on: false }], [asset]);
    return made.ok ? made.edit : null;
  } catch {
    return null; // a file no edit starts from
  }
}

export function AgentPage() {
  /** The creator's ready takes (null until they are read), the one chosen, and it as the Player needs it. */
  const [takes, setTakes] = useState<Listed[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [read, setRead] = useState<Take | null>(null);
  /** The take the Player has: the one read, while it is the one chosen. */
  const take = read?.id === chosen ? read : null;
  /** Why the takes, or the take, could not be read; `reads` is counted up to read them again. */
  const [unread, setUnread] = useState<string | null>(null);
  const [reads, setReads] = useState(0);

  const [picking, setPicking] = useState<Picked>({ ...FIRST, file: null });
  const [session, dispatch] = useReducer(reduce, START);
  const [text, setText] = useState("");
  /** The video asked to be made for download, and its job as the reader has it: given up on after `MOST_UNREAD` failed reads. */
  const [film, setFilm] = useState<Film | null>(null);
  const job = useJob(film?.job ?? null, { most: MOST_UNREAD, again: film?.tries ?? 0 });
  const [approximate, setApproximate] = useState(false);
  const onApproximateColour = useCallback(() => setApproximate(true), []);
  /** A video's style as it was read, kept so that a cut tried again does not read the video again; and whether it was judged. */
  const style = useRef<{ of: string | File; style: unknown; judged: boolean } | null>(null);
  const [unjudged, setUnjudged] = useState(false);
  /** The read of a video's style that is under way: stopped when the creator picks another row, or leaves the page. */
  const reading = useRef<AbortController | null>(null);
  useEffect(() => () => reading.current?.abort(), []);

  const player = useRef<PlayerRef>(null);
  const field = useRef<FieldHandle>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    let stopped = false;
    void call<{ takes: (Listed & { status: string })[] }>("/api/edit/takes").then((answer) => {
      if (stopped) return;
      if (!answer.ok) return setUnread(problemOf(answer));
      const listed = answer.body.takes.filter((one) => one.status === "ready");
      setTakes(listed);
      setChosen((now) => now ?? listed[0]?.id ?? null);
    });
    return () => {
      stopped = true;
    };
  }, [reads]);

  useEffect(() => {
    if (!chosen) return;
    let stopped = false;
    void call<{ asset: Asset | null; previewUrl: string | null }>(`/api/edit/takes/${chosen}`).then((answer) => {
      if (stopped) return;
      if (!answer.ok) return setUnread(problemOf(answer));
      if (!answer.body.asset || !answer.body.previewUrl) return setUnread("That take is not ready yet.");
      setRead({ id: chosen, asset: answer.body.asset, previewUrl: answer.body.previewUrl });
    });
    return () => {
      stopped = true;
    };
  }, [chosen, reads]);

  const plain = useMemo(() => (take ? plainEdit(take.asset) : null), [take]);
  const urls = useMemo(() => (take ? { [take.asset.id]: take.previewUrl } : {}), [take]);
  const cut = editOf(session);
  const shown = cut ?? plain;
  const download = downloadOf(film, cut, job);
  const on = controlsOf(session, download);

  // The Player, as it is mounted: where it is in the film is kept, and it is on the window for a test or the console.
  const at = useRef(0);
  /** The frame a first cut stands at until it is played or moved (`STILL`); null once it has been. */
  const still = useRef<number | null>(null);
  const mounted = shown !== null;
  useEffect(() => {
    const now = player.current;
    if (!now) return;
    window.__editPlayer = now;
    const moved = (event: { detail: { frame: number } }) => {
      at.current = event.detail.frame;
      if (still.current !== null && event.detail.frame !== still.current) still.current = null;
    };
    const played = () => {
      if (still.current === null) return;
      still.current = null;
      now.seekTo(0); // a cut that was standing is played from its start
    };
    now.addEventListener("frameupdate", moved);
    now.addEventListener("play", played);
    return () => {
      now.removeEventListener("frameupdate", moved);
      now.removeEventListener("play", played);
      window.__editPlayer = null;
    };
  }, [mounted, take?.id]);

  // A new edit on the phone. A first cut stands where its work is seen (`STILL`) and plays from its start; a change keeps
  // the place when that frame is still there; the take, after starting over, is at its start.
  const before = useRef<{ edit: Edit | null; cut: boolean }>({ edit: null, cut: false });
  useEffect(() => {
    const now = player.current;
    const was = before.current;
    before.current = { edit: shown, cut: cut !== null };
    if (!now || !shown || !was.edit || was.edit === shown) return;
    const first = cut !== null && !was.cut;
    const frame = first ? Math.min(STILL, filmFrames(shown) - 1) : cut === null || at.current >= filmFrames(shown) ? 0 : at.current;
    if (first) now.pause();
    // A cut still standing where it was parked goes on standing through a change: it has yet to be played from its start.
    if (first) still.current = frame;
    else if (frame !== still.current) still.current = null;
    if (now.getCurrentFrame() !== frame) now.seekTo(frame);
  }, [shown, cut]);

  // The keyboard's focus follows the work. When the cut lands it goes to the request field: the next thing to do. On a
  // touch screen it goes to the cut's panel instead, so that no keyboard opens over the video that has just arrived. After
  // starting over it goes back to the row that is chosen.
  const hasCut = session.cut !== null;
  const hadCut = useRef(hasCut);
  useEffect(() => {
    if (hasCut === hadCut.current) return;
    hadCut.current = hasCut;
    if (!hasCut) return document.querySelector<HTMLInputElement>('.edit-agent input[name="look"]:checked')?.focus({ preventScroll: true });
    if (window.matchMedia("(pointer: coarse)").matches) panel.current?.focus({ preventScroll: true });
    else field.current?.focus();
  }, [hasCut]);

  // The field takes the keyboard back when the change it sent has been answered.
  const refocus = useRef(false);
  const out = session.working?.what === "change";
  useEffect(() => {
    if (!out && refocus.current) {
      refocus.current = false;
      field.current?.focus();
    }
  }, [out]);

  /** What the creator picked changes: a video's style being read for what they had picked is stopped, and a problem shown goes. */
  const pick = (next: Picked) => {
    if (session.working?.what === "read") {
      reading.current?.abort();
      reading.current = null;
      dispatch({ type: "stopped" });
    }
    if (session.problem) dispatch({ type: "moved on" });
    setPicking(next);
  };

  const make = async () => {
    if (!take || session.working || !ready(picking)) return;
    let asked: unknown = styleOf(picking);
    if (picking.choice === "video") {
      const of = picking.file ?? picking.link.trim();
      if (style.current?.of !== of) {
        const stop = new AbortController();
        reading.current = stop;
        dispatch({ type: "reading", stage: "Getting the video…", share: picking.file ? 0 : null });
        const got = await readStyle(picking.file ? { file: picking.file } : { link: picking.link }, (progress) => (stop.signal.aborted ? undefined : dispatch({ type: "reading", ...progress })), { signal: stop.signal });
        if (stop.signal.aborted || "stopped" in got) return; // the creator moved on: nothing read late is applied
        reading.current = null;
        if (!got.ok) return dispatch({ type: "failed", text: got.problem });
        style.current = { of, style: got.style, judged: got.judged };
      }
      asked = style.current.style;
    }
    dispatch({ type: "cutting", stage: CUTTING, share: picking.choice === "video" ? 0.9 : null });
    const answer = await call<Answer>("/api/edit/agent", { takes: [take.id], firstCut: true, ...(asked === undefined ? {} : { style: asked }) });
    if (!answer.ok) return dispatch({ type: "failed", text: problemOf(answer) });
    setUnjudged(picking.choice === "video" && style.current?.judged === false);
    dispatch({ type: "cut", answer: answer.body });
  };

  const send = async (request: string) => {
    if (!take || !cut || !on.ask) return;
    refocus.current = field.current?.focused() ?? false;
    dispatch({ type: "asking", request });
    setText("");
    const answer = await call<Answer>("/api/edit/agent", { takes: [take.id], edit: cut, request });
    if (answer.ok) return dispatch({ type: "answered", answer: answer.body });
    dispatch({ type: "failed", text: problemOf(answer) });
    setText((now) => (now === "" ? request : now)); // what was asked is not lost
  };

  /** Download: the video of the edit on the phone is asked for. Its answer is kept only while that asking still stands. */
  const makeFilm = async () => {
    if (!cut || !on.download) return;
    const asked: Film = { edit: cut, job: null, problem: null, tries: 0 };
    setFilm(asked);
    const started = await call<{ job?: { id: string } }>("/api/edit/renders", { edit: cut });
    setFilm((now) => (now !== asked ? now : started.ok && started.body.job ? { ...asked, job: started.body.job.id } : { ...asked, problem: problemOf(started) }));
  };
  /** "Try again" under the phone: a video that was not made is asked for anew; one that could not be followed is read again. */
  const again = () => {
    if (download.at === "failed" && download.again === "read") setFilm((now) => (now ? { ...now, tries: now.tries + 1 } : now));
    else void makeFilm();
  };

  const show = (frame: number) => {
    if (!shown) return;
    player.current?.pause();
    player.current?.seekTo(Math.min(frame, filmFrames(shown) - 1));
    document.getElementById("edit-stage")?.scrollIntoView({ block: "nearest" });
  };

  const state = unread && !take ? "unread" : takes === null ? "loading" : takes.length === 0 ? "empty" : session.cut ? "cut" : "picking";
  // The takes to choose from stay while a take could not be read: another one can be picked.
  const choosing = !session.cut && takes !== null && takes.length > 1;
  const failed = session.problem;
  const working = session.working;

  return (
    // The page scrolls here, not in the body: the app's body is no scrollport a field or the video could stick to.
    <main
      className="edit-agent h-dvh overflow-y-auto bg-background text-foreground"
      data-state={state} data-busy={working !== null} data-takes={choosing ? "" : undefined} data-colour={approximate ? "approximate" : "exact"}
      style={{ "--phone-share": session.cut ? "50dvh" : "36dvh" } as CSSProperties}
    >
      <style>{STYLES}</style>
      <div className="edit-agent-columns mx-auto grid w-full max-w-[1040px] gap-5 px-4 pb-4 min-[900px]:gap-8 min-[900px]:px-6 min-[900px]:py-8">
        <section aria-label="Your video" className={`grid min-w-0 justify-items-center gap-3 pt-4 min-[900px]:pt-0 ${session.cut ? "edit-agent-held" : ""}`}>
          {choosing ? (
            <Takes
              takes={takes} chosen={chosen} disabled={working !== null}
              onChoose={(id) => {
                setUnread(null);
                setChosen(id);
              }}
            />
          ) : null}
          <Phone key={take?.id ?? "none"} ref={player} edit={take ? shown : null} urls={urls} poster={takes?.find((one) => one.id === chosen)?.posterUrl ?? null} onApproximateColour={onApproximateColour} />
          {session.cut ? (
            <div className="w-[calc(var(--phone-h)*9/16)] max-w-full">
              <UnderPhone
                canUndo={on.undo} canStartOver={on.startOver} canDownload={on.download} download={download}
                onUndo={() => dispatch({ type: "undo" })}
                onStartOver={() => {
                  dispatch({ type: "start over" });
                  setText("");
                  setFilm(null);
                }}
                onDownload={again}
              />
            </div>
          ) : null}
        </section>

        {state === "unread" ? (
          <section className="grid content-start justify-items-start gap-3">
            <h1 className={HEADLINE}>Your take is not here yet</h1>
            <p role="alert" className="text-[15px] leading-[22px] text-foreground-secondary">{unread}</p>
            <button
              type="button"
              onClick={() => {
                setUnread(null);
                setReads(reads + 1);
              }}
              className="h-11 rounded-md bg-action px-4 text-[15px] font-medium text-action-foreground"
            >
              Try again
            </button>
          </section>
        ) : state === "empty" ? (
          <section className="grid content-start justify-items-start gap-3">
            <h1 className={HEADLINE}>No take to cut yet</h1>
            <p className="text-[15px] leading-[22px] text-foreground-secondary">Upload a take, wait until it is ready, then come back here.</p>
            <Link href="/dev-edit/worker" className="grid h-11 place-items-center rounded-md bg-action px-4 text-[15px] font-medium text-action-foreground">
              Upload a take
            </Link>
          </section>
        ) : session.cut ? (
          <section ref={panel} tabIndex={-1} aria-label="Your cut" className="flex min-w-0 flex-col outline-none min-[900px]:max-h-[calc(var(--room)+68px)]">
            <h1 className="sr-only">Your cut</h1>
            <div className="grid flex-initial content-start gap-5 min-[900px]:min-h-0 min-[900px]:overflow-y-auto">
              <Say text={session.cut.first.say} lead={session.cut.first.styleSay} />
              {session.cut.first.match ? <MatchRow match={session.cut.first.match} /> : null}
              <Thread turns={session.cut.turns} pending={working?.what === "change" ? working.request : null} disabled={!on.ask} onUndo={(turn) => dispatch({ type: "undo", turn })} />
            </div>
            <div className="sticky bottom-0 z-10 -mx-4 flex-none bg-background px-4 pb-3 pt-4 min-[900px]:static min-[900px]:mx-0 min-[900px]:px-0 min-[900px]:pb-0">
              <RequestField
                ref={field} text={text} onText={setText} onSend={(request) => void send(request)} disabled={!on.ask}
                problem={failed ? { text: failed.text, again: failed.request === null ? null : () => void send(failed.request!) } : null}
              />
            </div>
            <div className="grid flex-none gap-3 min-[900px]:pt-3">
              <Suggestions
                disabled={!on.ask}
                onPick={(suggestion) => {
                  setText(suggestion);
                  field.current?.focus();
                }}
              />
              <div className="border-t border-border pt-1">
                <Findings findings={findingsOf(session)} onShow={show} />
                <Details spent={session.spent} approximate={approximate} unjudged={unjudged} />
              </div>
            </div>
          </section>
        ) : (
          <section className="min-w-0">
            <StylePicker
              picking={picking} onPick={pick} waiting={take === null}
              working={working && working.what !== "change" ? { stage: working.stage, share: working.share, reading: working.what === "read" } : null}
              problem={failed?.text ?? null}
              onMake={() => void make()}
            />
          </section>
        )}
      </div>
    </main>
  );
}
