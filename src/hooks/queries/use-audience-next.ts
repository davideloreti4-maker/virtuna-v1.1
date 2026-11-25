"use client";

/**
 * use-audience-next — the new Audience page's requests (spec 2026-11-25-audience): which audience new
 * chats use, a rename, and a remove. Mutations only, with no cache key: the page is read on the server,
 * and the container asks the router for a fresh read once a request is answered.
 *
 * A refused request throws. A 401 first raises the app's session dialog (`reportSession401`) and throws
 * the session's refusal, so a caller can tell it apart (`isSessionExpiredRefusal`). None of them retries
 * (a mutation's default).
 *
 * And a read (`useAudienceBuild`): an audience built from an account or a description, or read again, as
 * the server streams it. A read on its way is remembered across pages (`readOnItsWay`): each one is a paid
 * read, and leaving a page inside the app does not stop it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { SessionExpiredRefusal, reportSession401 } from "@/lib/auth/session-expired";
import { NAME_MAX, SETTLE_MAX_MS, SLOW_AFTER_MS } from "@/lib/audience-next/audience-model";
import type { BuildRequest } from "@/lib/audience-next/build-request";
import { applyEvent, endOfStream, startBuild, type BuildState } from "@/lib/audience-next/build-state";
import { readBuildStream, type BuildEvent } from "@/lib/audience-next/build-stream";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** A refused answer: the session dialog when the session is gone, and a throw either way. */
function refused(res: Response, what: string): never {
  if (reportSession401(res.status)) throw new SessionExpiredRefusal();
  throw new Error(`${what} refused (${res.status})`);
}

/** PUT /api/settings/last-audience `{ audienceId }`: the audience new chats use. */
export function useSetDefaultAudience(): UseMutationResult<void, Error, string> {
  return useMutation<void, Error, string>({
    mutationFn: async (audienceId) => {
      const res = await fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ audienceId }),
      });
      if (!res.ok) refused(res, "Setting the audience for new chats");
    },
  });
}

/** PATCH /api/audiences/:id `{ name }`, the name trimmed. A name the route would refuse (empty, over 80)
 *  is refused here, without a request. */
export function useRenameAudience(): UseMutationResult<void, Error, { id: string; name: string }> {
  return useMutation<void, Error, { id: string; name: string }>({
    mutationFn: async ({ id, name }) => {
      const next = name.trim();
      if (next.length === 0 || next.length > NAME_MAX) throw new Error(`An audience's name is 1 to ${NAME_MAX} characters`);
      const res = await fetch(`/api/audiences/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) refused(res, "Renaming the audience");
    },
  });
}

/**
 * DELETE /api/audiences/:id, then, for an account's audience, DELETE /api/connected-accounts/:accountId
 * (both 204), one after the other as the old screen does: the account is not touched when the audience's
 * delete is refused.
 */
export function useRemoveAudience(): UseMutationResult<void, Error, { id: string; accountId: string | null }> {
  return useMutation<void, Error, { id: string; accountId: string | null }>({
    mutationFn: async ({ id, accountId }) => {
      const res = await fetch(`/api/audiences/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) refused(res, "Deleting the audience");
      if (accountId === null) return;
      const gone = await fetch(`/api/connected-accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
      if (!gone.ok) refused(gone, "Disconnecting the account");
    },
  });
}

/** The clock a read uses: the window's, or one handed in. */
export interface BuildTimers {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

// Looked up at each call, so a clock swapped in after this module loaded is the one used.
const WINDOW_TIMERS: BuildTimers = {
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export interface AudienceBuild {
  /** null before a start and after `reset`: the form shows. */
  state: BuildState | null;
  /** Still running `SLOW_AFTER_MS` after the start. */
  slow: boolean;
  /** Starts the read. False when the same read is already on its way from another page: nothing is sent,
   *  and the caller says so. True also when this page's own read is running (nothing more is sent). */
  start(request: BuildRequest): boolean;
  reset(): void;
}

/**
 * The reads on their way, across pages: leaving a page inside the app does not stop a read (it is not
 * aborted, and the server finishes it), so coming back must not start a second paid one. Known by the
 * audience read again, else the handle read, else the description. A reload forgets them.
 */
const onTheirWay = new Set<string>();
const keyOf = (request: BuildRequest): string =>
  "handle" in request ? (request.audienceId ? `audience:${request.audienceId}` : `handle:${request.handle}`) : `description:${request.description}`;

/** Whether this read is already on its way (from this page or one the creator left). */
export function readOnItsWay(request: BuildRequest): boolean {
  return onTheirWay.has(keyOf(request));
}

/** Who hears that the audiences changed while their page was gone (`useAudienceChangedElsewhere`). */
const changeListeners = new Set<() => void>();

/** The audiences changed with no page there to show it: a read ended after its page was left, or a new
 *  audience was made the default from a page that has gone. The audience page on screen reads itself again. */
export function announceAudienceChanged(): void {
  for (const listener of [...changeListeners]) listener();
}

/** Hears `announceAudienceChanged` while mounted; the latest `listener` given is the one called. */
export function useAudienceChangedElsewhere(listener: () => void): void {
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  }, [listener]);
  useEffect(() => {
    const heard = () => latest.current();
    changeListeners.add(heard);
    return () => {
      changeListeners.delete(heard);
    };
  }, []);
}

/**
 * A read, as `POST /api/audiences/calibrate` streams it.
 *
 * - `start` is ignored while this page's own read runs or settles, so two presses send one request. It is
 *   refused (false: nothing sent, the caller says so) while the same read is on its way from a page the
 *   creator left (`readOnItsWay`).
 * - While the read runs or settles, the page asks to stay open (`beforeunload`): leaving would not stop the
 *   read, and nothing would say how it ended. A link inside the app is not held: the record covers that.
 * - Refused, no body, a throw before or while reading, or the stream closing with no outcome: failed, with
 *   the screen's own sentence. An expired session (a 401) is the app's session dialog's alone: the read goes
 *   back to idle, with no sentence that blames the account.
 * - `done` settles: the route still stores the account's figures and posts before it closes the stream, and
 *   the page that opens next shows them. So the read waits for the close, at most `SETTLE_MAX_MS`, then is
 *   done. A throw while settling ends only the wait: the audience is already stored.
 * - Leaving the page does not abort the request (the server finishes the read either way, as the old screens
 *   let it); nothing is set once the page is gone. A read that ends after its page has gone says so
 *   (`announceAudienceChanged`): the audience page now on screen reads itself again.
 * - `onMade(audienceId, request)`, when given, is told the moment the `done` frame is read: from the read
 *   itself, so it is told even when the page that started the read has gone. The latest one given is told.
 *   A read again gives none: it must never change which audience new chats use.
 */
export function useAudienceBuild(
  timers: BuildTimers = WINDOW_TIMERS,
  onMade?: (audienceId: string, request: BuildRequest) => void,
): AudienceBuild {
  const [state, setState] = useState<BuildState | null>(null);
  const [slow, setSlow] = useState(false);
  // The current read's number: a reset or a newer read leaves an older one unheard.
  const current = useRef(0);
  // The phase as of the last event, not the last render: two starts can land before one render.
  const phase = useRef<BuildState["phase"] | null>(null);
  const mounted = useRef(false);
  const slowTimer = useRef<unknown>(null);
  // Read when the audience is made, which can be after the page that gave it has gone.
  const made = useRef(onMade);

  useEffect(() => {
    made.current = onMade;
  }, [onMade]);

  useEffect(() => {
    // Set on mount, not only cleared on unmount: a remount in development runs this again.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const holding = state?.phase === "running" || state?.phase === "settling";
  useEffect(() => {
    if (!holding) return;
    const hold = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Browsers that predate `preventDefault` here ask only when this is set.
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [holding]);

  const stopSlow = useCallback(() => {
    if (slowTimer.current !== null) timers.clearTimeout(slowTimer.current);
    slowTimer.current = null;
  }, [timers]);

  useEffect(() => stopSlow, [stopSlow]);

  const reset = useCallback(() => {
    current.current += 1;
    phase.current = null;
    stopSlow();
    setState(null);
    setSlow(false);
  }, [stopSlow]);

  const start = useCallback(
    (request: BuildRequest): boolean => {
      if (phase.current === "running" || phase.current === "settling") return true;
      const key = keyOf(request);
      if (onTheirWay.has(key)) return false;
      onTheirWay.add(key);
      current.current += 1;
      const run = current.current;
      const heard = () => run === current.current;
      /** Shows a state of this read; false once the read is no longer heard. */
      const show = (next: BuildState): boolean => {
        if (!heard()) return false;
        phase.current = next.phase;
        if (mounted.current) setState(next);
        return true;
      };
      const end = (last: BuildState) => {
        if (!heard()) return;
        stopSlow();
        show(last);
        if (mounted.current) setSlow(false);
      };
      /** The session is gone: back to idle, as before the start. */
      const idle = () => {
        if (!heard()) return;
        stopSlow();
        phase.current = null;
        if (!mounted.current) return;
        setState(null);
        setSlow(false);
      };

      let s = startBuild(request);
      show(s);
      setSlow(false);
      stopSlow();
      slowTimer.current = timers.setTimeout(() => {
        slowTimer.current = null;
        if (heard() && phase.current === "running" && mounted.current) setSlow(true);
      }, SLOW_AFTER_MS);

      void (async () => {
        try {
          let res: Response;
          try {
            res = await fetch("/api/audiences/calibrate", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(request) });
          } catch {
            end(endOfStream(s));
            return;
          }
          if (!res.ok || !res.body) {
            if (!res.ok && reportSession401(res.status)) idle();
            else end(endOfStream(s));
            return;
          }

          const events = readBuildStream(res.body);
          let settleTimer: unknown = null;
          let settled: Promise<"settled"> | null = null;
          try {
            for (;;) {
              if (s.phase === "settling" && settled === null) {
                settled = new Promise((resolve) => {
                  settleTimer = timers.setTimeout(() => resolve("settled"), SETTLE_MAX_MS);
                });
              }
              const next: IteratorResult<BuildEvent, void> | "settled" = settled
                ? await Promise.race([events.next(), settled])
                : await events.next();
              if (next === "settled" || next.done) {
                s = endOfStream(s);
                break;
              }
              const was = s.phase;
              s = applyEvent(s, next.value);
              if (!show(s)) return;
              if (was === "running" && s.phase === "settling" && s.audienceId !== null) made.current?.(s.audienceId, request);
              if (s.phase === "thin" || s.phase === "failed") break;
            }
          } catch {
            s = endOfStream(s);
          } finally {
            if (settleTimer !== null) timers.clearTimeout(settleTimer);
          }
          end(s);
        } finally {
          // Over, however it ended: the same read may start again.
          onTheirWay.delete(key);
          // Its page has gone: the audience page now on screen, if one is, reads itself again.
          if (!mounted.current) announceAudienceChanged();
        }
      })();
      return true;
    },
    [timers, stopSlow],
  );

  return { state, slow, start, reset };
}
