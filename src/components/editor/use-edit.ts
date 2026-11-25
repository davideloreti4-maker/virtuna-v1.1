"use client";

/**
 * use-edit.ts — the editor page's calls around its reducer (spec 2026-11-24-editor-screens-design.md §5.2, §7, E2, E22; plan
 * 2026-11-24-editor-screens-a, Task 10; rulings R17, R20). The edit is read, and read again every `pollMs` while its take is
 * analysed and while its export runs. The first cut is asked for by the page itself whenever it holds a ready take with no
 * turn, nothing out and nothing wrong, in the look picked meanwhile. The creator's calls (a cut, a change, a word or the
 * captions, a finding put away, Undo and Redo, the export and giving it up, another take) go one at a time; each answer replaces the view, each
 * refusal is one sentence. A video's style is read in the background ("Like a video") while the edit stays usable, offered
 * when it is ready, stopped when the creator closes it, and given up when it takes too long.
 *
 * What keeps the page true to the server:
 * - a waiting edit is read on after a read that failed or was not taken: the next read is armed by each read that comes back,
 *   not by a view; it waits twice as long after each read running that failed, up to half a minute (`readWait`);
 * - an edit that could not be read at all is said ("not read"), read on the same way, and at once on Try again;
 * - an edit that waits on nothing is read once more when the page asks (`read`): it was away long enough for its signed
 *   addresses to run out (ruling R30);
 * - no edit is read once the gate refuses (not signed in, not open to them), nor once the page is left, nor while the take's
 *   bytes are sending or its finish waits for another analysis of the creator's (nothing changes on the server until the
 *   finish is taken; the holder tells when it is, R31);
 * - after a call that was not answered ok the edit is read again, since it may be other than the page shows it (a second
 *   writer's turn came first, a write stopped midway, the edit is gone). The problem stays, and a change's request with it,
 *   unless that read shows the change was made;
 * - a read that a call went out or came back during is not taken: what it read may be older than the call's own answer;
 * - an answer that is ok and is no edit is a failed call; so is a cut answered with an edit that has no cut;
 * - a call that is never answered is given up just after its route's own limit (`call`'s deadline), so the controls come back;
 * - the holder keeps no upload of a take nobody shows (R17): the take replaced, and one the edit did not take.
 *
 * What keeps the page from waiting on an analysis nobody runs: when the holder says the upload is sent and the edit, read,
 * still shows its take uploading `FINISH_MS` later, the page tells the finish once more itself; and when it still does
 * `FINISH_MS` after that, the holder lets the upload go, so the page says the upload stopped and the video is picked again.
 *
 * What keeps the page from waiting on a cut nobody makes: the first cut is asked for whenever the session wants it
 * (`wantsFirstCut`), not once a mount, so a new take, a problem put away and Try again all lead to it; a first cut the editor
 * was too busy for (a 409) is asked again by the page every three seconds, the edit read first, `MOST_HELD_ASKS` times; one
 * that failed another way waits for Try again and is not read on.
 *
 * One edit a mount: the page that shows another edit mounts this anew (a `key` of the edit's id).
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Op } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { START, controlsOf, isView, pageStateOf, readWait, reduce, styleBody, wantsFirstCut, type Controls, type CutStyle, type PageState, type Session, type Working } from "./edit-session";
import { WENT_WRONG, call, problemOf } from "./net";
import { readStyle, type Source } from "./read-style";
import { sendTake } from "./take-file";
import { forgetUpload, retryUpload, useUpload, type Upload } from "./uploads";

/** How often a waiting edit is read again. */
const POLL_MS = 1500;
/**
 * How long a call may take before it is given up: just over the time its route may run (`maxDuration`), so the route's own
 * answer or refusal always comes first. A cut's route runs up to 180 s; a change's and the export's up to 60 s. Every other
 * call gets `call`'s own half minute.
 */
const CUT_MS = 185_000;
const CHANGE_MS = 65_000;
const EXPORT_MS = 65_000;
/** The same for the upload's finish, whose route may run a minute. Also how long the page waits on a take it was told is sent. */
const FINISH_MS = 65_000;
/** How long the page waits before it asks again for a first cut the editor was too busy for. */
const HELD_MS = 3000;
/** How long a video's style may take to read: a link is fetched in up to 95 s and read in one to three minutes today. */
const STYLE_MS = 10 * 60_000;
/** What is said of a style not read in that time. */
export const STYLE_LATE = "The video's style could not be read. Try it again, or another video.";

export interface StyleRead {
  status: "idle" | "reading" | "ready" | "failed";
  line: string | null;
  share: number | null;
  problem: string | null;
  style: unknown;
}
const NO_READ: StyleRead = { status: "idle", line: null, share: null, problem: null, style: null };

export interface EditApi {
  session: Session;
  state: PageState;
  controls: Controls;
  upload: Upload | null;
  reading: StyleRead;
  setWaitLook(look: CutStyle): void;
  cut(look: CutStyle): Promise<boolean>;
  /**
   * A change asked for, about the moment `at` (E15: the film frame the video is paused on) when it has one: the body is
   * `{request, at}`, and `{request}` with no `at` at all when `at` is null or left out.
   */
  ask(request: string, at?: number | null): Promise<boolean>;
  ops(list: Op[]): Promise<boolean>;
  /**
   * A finding of the turn shown put away, by its key (`findingKey`; slice B, Task 9): `POST …/kept {finding}`, a call like the
   * others, one at a time and with a deadline, the view it answers taken.
   */
  keep(key: string): Promise<boolean>;
  move(n: number): Promise<boolean>;
  startExport(): Promise<boolean>;
  cancelExport(): Promise<boolean>;
  replaceTake(file: File): Promise<void>;
  /** Try again: the read of an edit that could not be read, the upload, the first cut, or the change that failed. */
  retry(): void;
  /**
   * Reads the edit again now, though nothing waits: the page asks when it is looked at again after so long away that the
   * addresses it holds have run out (ruling R30). As any read, it is not taken when a call went out or came back meanwhile.
   */
  read(): void;
  readVideo(source: Source): void;
  /** Stops the read of a video's style and puts what it said away: the creator closed it, or picked another look. */
  stopReading(): void;
  applyVideoStyle(): Promise<void>;
  /** Puts the problem away. While the first cut is owed, the page then asks for it again. */
  dismiss(): void;
}

/** How a call ended: the edit as its route answered it, or one sentence of why not, with the status a route answered. */
type Ended = { ok: true; view: EditView } | { ok: false; problem: string; status?: number };
const endOf = (answer: Awaited<ReturnType<typeof call<EditView>>>): Ended => {
  if (!answer.ok) return { ok: false, problem: problemOf(answer), status: answer.status };
  return isView(answer.body) ? { ok: true, view: answer.body } : { ok: false, problem: WENT_WRONG, status: answer.status };
};

export function useEdit(id: string, { pollMs = POLL_MS, styleMs = STYLE_MS }: { pollMs?: number; styleMs?: number } = {}): EditApi {
  const [session, dispatch] = useReducer(reduce, START);
  const [reads, setReads] = useState(0);
  /** The reads that came back, taken or not; and how many of them running brought no edit. */
  const [back, setBack] = useState({ n: 0, missed: 0 });
  const [reading, setReading] = useState<StyleRead>(NO_READ);
  const takeId = session.view?.take.id ?? null;
  const upload = useUpload(takeId);
  const state = pageStateOf(session, upload);
  const base = `/api/edit/edits/${id}`;

  // One call at a time: the reducer refuses a second `start`, and `out` refuses to send it. `calls` counts each call going
  // out and each coming back, so a read knows whether one did while it was asked.
  const out = useRef(false);
  const calls = useRef(0);

  // The edit, read when the page opens and again each time `reads` is counted up. A read that a call went out or came back
  // during is not taken: the call's own answer is the later one. Taken or not, a read that comes back is counted.
  useEffect(() => {
    let stopped = false;
    const asked = calls.current;
    void call<EditView>(base).then((answer) => {
      if (stopped) return;
      const read = answer.ok && isView(answer.body);
      // An answer that is ok and is no edit is no answer (status 0).
      if (calls.current === asked) dispatch(read ? { type: "read", view: answer.body } : { type: "unread", status: answer.ok ? 0 : answer.status, text: problemOf(answer) });
      setBack((was) => ({ n: was.n + 1, missed: read ? 0 : was.missed + 1 }));
    });
    return () => {
      stopped = true;
    };
  }, [base, reads]);

  // Read again while it waits and no call is out (no read is taken while one is): armed anew by each read that came back,
  // so a read that failed does not end the waiting, only makes the next wait longer. While the take's bytes are sending
  // nothing changes on the server, nor while its finish waits for another analysis of the creator's to end (R31). Once they
  // are sent the finish is told, and from then on it does, whether or not that call's answer comes back: the edit is read.
  const sending = session.view?.take.status === "uploading" && (upload?.status === "sending" || upload?.status === "waiting");
  const waiting = (state === "getting ready" && !sending) || state === "exporting" || state === "not read";
  const polling = waiting && session.working === null;
  useEffect(() => {
    if (!polling) return;
    const timer = setTimeout(() => setReads((n) => n + 1), readWait(pollMs, back.missed));
    return () => clearTimeout(timer);
  }, [polling, pollMs, back]);

  // The holder says the upload is sent, and the edit still reads its take as uploading. For a moment that is the order of
  // things (the next read shows it analysed). When it lasts, no analysis was started: a finish told twice can be taken as
  // told by the second while the first, which then fails, puts the take back. So after `FINISH_MS` of it the page tells the
  // finish once more (answered "not waiting", harmlessly, where a job does exist; what comes of it the reads show), and
  // after `FINISH_MS` more the upload is let go: the page then says the upload stopped, with the video to pick again. Only
  // while the edit is read: reads that fail say nothing of the take.
  const unstarted = session.view?.take.status === "uploading" && upload?.status === "sent" && session.unread === null;
  /** The take whose finish the page has told once more. */
  const [toldAgain, setToldAgain] = useState<string | null>(null);
  useEffect(() => {
    if (!unstarted || takeId === null) return;
    const timer = setTimeout(() => {
      if (toldAgain === takeId) return forgetUpload(takeId);
      setToldAgain(takeId);
      void call<unknown>(`/api/edit/takes/${takeId}/uploaded`, {}, "POST", FINISH_MS);
    }, FINISH_MS);
    return () => clearTimeout(timer);
  }, [unstarted, takeId, toldAgain]);

  // A call of the creator's or the page's: marked out, made, and ended by its answer. After one that was not answered ok the
  // edit is read again, since it may be other than the page shows it. What makes the call does not throw; if it does all the
  // same, the call has failed and the controls come back.
  const run = useCallback(async (working: Working, made: () => Promise<Ended>): Promise<boolean> => {
    if (out.current) return false;
    out.current = true;
    calls.current += 1;
    dispatch({ type: "start", working });
    const end = await made().catch((error: unknown): Ended => {
      console.error("a call of the editor's threw", error);
      return { ok: false, problem: WENT_WRONG };
    });
    out.current = false;
    calls.current += 1;
    if (end.ok) dispatch({ type: "answered", view: end.view });
    else {
      dispatch({ type: "failed", text: end.problem, status: end.status });
      setReads((n) => n + 1);
    }
    return end.ok;
  }, []);
  const send = useCallback(
    (working: Working, path: string, body: unknown, method?: "POST" | "DELETE", deadlineMs?: number) =>
      run(working, async () => endOf(await call<EditView>(`${base}${path}`, body, method, deadlineMs))),
    [run, base],
  );

  // A cut as its route makes it. One answered with an edit that has no cut has failed: taken as made, the page would ask for
  // the first cut again without end. No cut by its head (what `wantsFirstCut` reads) or by the turn shown (what the page's
  // state reads): the server keeps the two together, and this does not lean on it.
  const cutOf = useCallback(async (look: CutStyle): Promise<Ended> => {
    const end = endOf(await call<EditView>(`${base}/cut`, styleBody(look), "POST", CUT_MS));
    return end.ok && (end.view.head === null || end.view.shown === null) ? { ok: false, problem: WENT_WRONG } : end;
  }, [base]);
  const cut = useCallback((look: CutStyle) => run({ what: "cut", look }, () => cutOf(look)), [run, cutOf]);
  const ask = useCallback(
    (request: string, at: number | null = null) => send({ what: "change", request, at }, "/change", at === null ? { request } : { request, at }, "POST", CHANGE_MS),
    [send],
  );
  const ops = useCallback((list: Op[]) => send({ what: "ops" }, "/ops", { ops: list }), [send]);
  const keep = useCallback((key: string) => send({ what: "keep" }, "/kept", { finding: key }), [send]);
  const move = useCallback((n: number) => send({ what: "move", to: n }, "/head", { n }), [send]);
  const startExport = useCallback(() => send({ what: "export" }, "/export", {}, "POST", EXPORT_MS), [send]);
  const cancelExport = useCallback(() => send({ what: "cancel" }, "/export", undefined, "DELETE", EXPORT_MS), [send]);

  // The first cut, asked for by the page itself (E2) whenever it is owed and nothing stands in its way. A cut that failed
  // stands in its way until its problem is put away (Try again); one the editor was too busy for, until the wait below.
  useEffect(() => {
    if (!wantsFirstCut(session)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- asking for the cut IS the effect: a call, which marks itself out
    void cut(session.waitLook);
  }, [session, cut]);

  // Whether the page has been left. Nothing is asked for an edit nobody is looking at (§7).
  const left = useRef(false);
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
    };
  }, []);

  // A first cut the editor was too busy for is asked again after three seconds. The edit is read first: the call that holds
  // the editor may be making this very cut, and asking then would make a second one. A page left during that read asks for
  // no cut. Each refusal arms the next asking (`busy` counts them), whether or not a render came between the asking and its
  // refusal.
  const { busy, waitLook } = session;
  const held = state === "cutting" && session.working === null && busy > 0;
  useEffect(() => {
    if (!held) return;
    const again = () =>
      run({ what: "cut", look: waitLook }, async () => {
        const read = endOf(await call<EditView>(base));
        if (read.ok && read.view.shown !== null) return read;
        return left.current ? { ok: false, problem: WENT_WRONG } : cutOf(waitLook);
      });
    const timer = setTimeout(() => void again(), HELD_MS);
    return () => clearTimeout(timer);
  }, [held, busy, waitLook, run, cutOf, base]);

  // Another take for an edit with no cut: signed for and its upload started, then put to the edit. A put that got no answer
  // may have been taken all the same: the edit says which take it has. The holder keeps no upload of a take nobody shows
  // (R17): the new one is forgotten when the edit did not take it, the one it replaces when it did.
  const replaceTake = useCallback(async (file: File) => {
    await run({ what: "take" }, async () => {
      const sent = await sendTake(file);
      if (!sent.ok) return { ok: false, problem: sent.problem };
      const put = await call<EditView>(`${base}/take`, { take: sent.takeId });
      let end = endOf(put);
      if (put.status === 0) {
        const read = endOf(await call<EditView>(base));
        if (read.ok && read.view.take.id === sent.takeId) end = read;
      }
      if (!end.ok) forgetUpload(sent.takeId);
      else if (takeId !== null && takeId !== sent.takeId) forgetUpload(takeId);
      return end;
    });
  }, [run, base, takeId]);

  const setWaitLook = useCallback((look: CutStyle) => dispatch({ type: "wait look", look }), []);
  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);
  const read = useCallback(() => setReads((n) => n + 1), []);

  const retry = useCallback(() => {
    if (state === "not read") return setReads((n) => n + 1);
    // A problem shown is put away with any new try: it was about the try before. For a first cut that is the whole of
    // Try again: the page asks for the cut once nothing stands in its way.
    dispatch({ type: "dismiss" });
    if (state === "upload stopped" && upload?.status === "failed") return retryUpload(upload.takeId);
    if (session.problem && session.problem.request !== null) void ask(session.problem.request, session.problem.at ?? null);
  }, [state, upload, session.problem, ask]);

  // "Like a video": read in the background, stopped by another read, by the creator, by leaving the page, and by its
  // deadline (a reference can stay "analysing" without end); nothing read late is applied. Stopping drops the reference.
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => stop.current?.abort(), []);
  const readVideo = useCallback((source: Source) => {
    stop.current?.abort();
    const control = new AbortController();
    stop.current = control;
    const late = setTimeout(() => {
      control.abort();
      setReading({ ...NO_READ, status: "failed", problem: STYLE_LATE });
    }, styleMs);
    control.signal.addEventListener("abort", () => clearTimeout(late), { once: true });
    setReading({ ...NO_READ, status: "reading", line: "Getting the video…" });
    void readStyle(source, (progress) => {
      if (!control.signal.aborted) setReading((now) => ({ ...now, line: progress.stage, share: progress.share }));
    }, { signal: control.signal }).then((read) => {
      if (control.signal.aborted || "stopped" in read) return;
      clearTimeout(late);
      setReading(read.ok ? { ...NO_READ, status: "ready", style: read.style } : { ...NO_READ, status: "failed", problem: read.problem });
    });
  }, [styleMs]);
  const stopReading = useCallback(() => {
    stop.current?.abort();
    setReading(NO_READ);
  }, []);
  const applyVideoStyle = useCallback(async () => {
    if (reading.status !== "ready") return;
    if (await cut({ kind: "video", style: reading.style })) setReading(NO_READ);
  }, [reading, cut]);

  return {
    session, state, controls: controlsOf(session), upload, reading,
    setWaitLook, cut, ask, ops, keep, move, startExport, cancelExport, replaceTake, retry, read, readVideo, stopReading, applyVideoStyle, dismiss,
  };
}
