"use client";

import { useEffect, useRef, useState } from "react";
import { NO_PROGRESS, applyRunEvent, type RunEvent, type RunProgress } from "@/lib/result/run-progress";

/** The events of the stream that say something about the run (`applyRunEvent` reads them). */
const EVENTS = ["roster", "source", "filmstrip_segment_ready", "complete"] as const;
/** After a failed connect the stream is opened again this much later… */
const REOPEN_AFTER_MS = 5000;
/** …at most this many times per run. */
const MOST_REOPENS = 5;

/**
 * What the run's own stream (`GET /api/analyze/[id]/stream`) has said so far, for the running
 * screen: the viewer groups, the post's cover (a link run), the frames as they arrive, and the finish.
 *
 * `onDone` is called once when the stream says the run is finished; the page then asks for the
 * row at once instead of waiting for its next poll. The stream is a bonus, not the source of the
 * result: where it is unavailable or breaks, the row's polling carries the page to the result.
 *
 * A dropped connection the browser retries by itself. A connect the server answers with anything
 * but 200 (a passing 401, a 502) closes the source for good; then the stream is opened again
 * after 5 s, at most 5 times per run, never after the finish. The stream replays everything on a
 * reconnect, and replayed events change nothing (`applyRunEvent`).
 */
export function useRunStream(id: string, onDone: () => void): RunProgress {
  const [state, setState] = useState<{ id: string; progress: RunProgress }>({ id, progress: NO_PROGRESS });
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const url = `/api/analyze/${encodeURIComponent(id)}/stream`;
    let source: EventSource | null = null;
    let reopen: ReturnType<typeof setTimeout> | null = null;
    let reopens = 0;
    let finished = false;

    const open = () => {
      const es = new EventSource(url);
      source = es;
      for (const type of EVENTS) {
        es.addEventListener(type, (message: MessageEvent) => {
          let event: RunEvent;
          if (type === "complete") {
            // The finish carries the whole stored row; the page reads that from the row's own query.
            event = { type };
          } else {
            try {
              event = { type, data: JSON.parse(message.data as string) };
            } catch {
              return;
            }
          }
          setState((prev) => ({ id, progress: applyRunEvent(prev.id === id ? prev.progress : NO_PROGRESS, event) }));
          if (type === "complete") {
            finished = true;
            es.close();
            done.current();
          }
        });
      }
      es.addEventListener("error", () => {
        // CONNECTING: the browser is retrying by itself. CLOSED: it gave up on this source.
        if (finished || es.readyState !== EventSource.CLOSED || reopens >= MOST_REOPENS) return;
        reopens += 1;
        reopen = setTimeout(() => {
          reopen = null;
          open();
        }, REOPEN_AFTER_MS);
      });
    };
    open();

    return () => {
      finished = true;
      if (reopen) clearTimeout(reopen);
      source?.close();
    };
  }, [id]);

  // What an earlier run's stream said is not this run's.
  return state.id === id ? state.progress : NO_PROGRESS;
}
