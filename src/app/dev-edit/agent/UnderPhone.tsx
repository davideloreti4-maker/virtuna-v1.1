"use client";

/**
 * UnderPhone.tsx — the one quiet row under the phone (Task 13b): Undo, Start over, Download.
 * - Undo: back one edit; off at the first cut.
 * - Start over: back to "How should it look?", asked once in the row itself. When the question is put away ("Keep the cut")
 *   the keyboard's focus goes back to Start over, where it came from.
 * - Download: the word turns into a thin bar while the video is made, then into "Save video". A video that could not be made,
 *   or whose making could not be followed, is one sentence under the row with "Try again".
 * Each is on or off as the page says (`controlsOf`): a video being made turns off only Download. The row keeps one height,
 * with room for a second line, so the phone above it never moves.
 */
import { useEffect, useRef, useState } from "react";
import { Bar } from "./Bar";
import type { Download } from "./download";

interface Props {
  canUndo: boolean;
  canStartOver: boolean;
  /** Download, or its "Try again", can be pressed. */
  canDownload: boolean;
  download: Download;
  onUndo: () => void;
  onStartOver: () => void;
  /** Download, and "Try again" after a failure: the page knows which of the two it is. */
  onDownload: () => void;
}

/** A word that is a button; `QUIET` in the second tone, `PLAIN` in the first: the outcome. */
const WORD = "rounded-sm hover:text-foreground disabled:opacity-40";
const QUIET = `${WORD} text-foreground-secondary disabled:hover:text-foreground-secondary`;
const PLAIN = `${WORD} text-foreground`;
const ROW = "grid min-h-11 content-center gap-1.5 pb-1 text-[13px] leading-[18px] min-[900px]:min-h-14 min-[900px]:pb-0";

export function UnderPhone({ canUndo, canStartOver, canDownload, download, onUndo, onStartOver, onDownload }: Props) {
  const [asking, setAsking] = useState(false);
  // A call that starts takes the question away: nothing is started over while one is out.
  if (asking && !canStartOver) setAsking(false);
  const opener = useRef<HTMLButtonElement>(null);
  /** The question was put away by the creator: the focus goes back to the word that opened it. */
  const back = useRef(false);
  useEffect(() => {
    if (asking || !back.current) return;
    back.current = false;
    opener.current?.focus();
  }, [asking]);

  if (asking) {
    return (
      <div data-part="under-phone" role="group" aria-label="Start over?" className={ROW}>
        <p className="text-foreground-secondary">Start over? The cut and its changes are dropped.</p>
        <div className="flex gap-4">
          <button
            type="button" autoFocus
            onClick={() => {
              setAsking(false);
              onStartOver();
            }}
            className="rounded-sm text-foreground underline underline-offset-4"
          >
            Start over
          </button>
          <button
            type="button"
            onClick={() => {
              back.current = true;
              setAsking(false);
            }}
            className={QUIET}
          >
            Keep the cut
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-part="under-phone" className={ROW}>
      <div className="flex h-5 items-center gap-4">
        <button type="button" disabled={!canUndo} onClick={onUndo} className={QUIET}>
          Undo
        </button>
        <button ref={opener} type="button" disabled={!canStartOver} onClick={() => setAsking(true)} className={QUIET}>
          Start over
        </button>
        <span className="ml-auto flex items-center">
          {download.at === "making" ? (
            <Bar share={download.share} label="Making the video" className="w-24" />
          ) : download.at === "made" ? (
            <a href={download.url} download className="rounded-sm text-foreground underline underline-offset-4">
              Save video
            </a>
          ) : (
            <button type="button" disabled={!canDownload} onClick={onDownload} className={PLAIN}>
              {download.at === "failed" ? "Try again" : "Download"}
            </button>
          )}
        </span>
      </div>
      {download.at === "failed" ? (
        <p role="alert" className="text-foreground-secondary">
          {download.problem}
        </p>
      ) : null}
    </div>
  );
}
