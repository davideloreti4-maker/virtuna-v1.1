"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/thread-next/field-icons";
import { VideoThumb } from "@/components/thread-next/video-answer";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { STAGE } from "@/lib/edit";
import type { ExportShown } from "@/lib/edit/edit-view";
import { timecode } from "@/lib/result/format";
import { SaveIcon } from "./editor-icons";

/**
 * ready-sheet.tsx — the file made (spec §3 screen 12, E6; plan 2026-11-24-editor-screens-a, Task 14; ruling R28; drawing
 * `.sheet2`, `.done`, `.btn`): on a phone, a touch screen whose share sheet takes files (Photos, TikTok, Instagram), "Save to
 * Photos" hands the file over; everywhere else, a desk whose share sheet takes files included, "Download" saves it. "Back to the
 * edit" closes the sheet.
 *
 * A browser allows a share only during the creator's tap, and fetching a film of 10 to 170 MB in the tap would lose it: so the
 * file is fetched as soon as the sheet is open (it opens by itself for an export finished in front of the creator, or is opened
 * on one made earlier), and the tap shares the file already in hand. Meanwhile the button says so and waits, a minute at most.
 * A sheet that is mounted and closed fetches nothing, so a visit to an exported edit costs no film on mobile data, and a sheet
 * closed lets the file go (R31): opened again, it is fetched again. When that fetch fails (the bucket may not answer the app's
 * origin for a GET; a connection) or has not ended in that minute (it is then stopped), or the share sheet refuses the file,
 * the button is "Download": a plain link to the film, whose signed address saves it as `video.mp4`. A creator who closes the
 * share sheet without saving is told nothing.
 *
 * The film's address is signed anew at every read of the edit (it lasts two hours): while the sheet is open its file is fetched
 * once an export (`job`), from the address it had when the sheet opened, never again for a new address of the same export. The
 * Download link takes the latest address, which lasts the longest; a link loads nothing until it is followed.
 */

/** The name the film is saved and shared under. */
const NAME = "video.mp4";
const TYPE = "video/mp4";

/** How long the film's fetch may take before it is stopped and "Download" offered instead (R28). */
export const FILM_FETCH_MS = 60_000;

/** Whether the device's main pointer is a finger: a phone or a tablet, where "Save to Photos" is offered (R28). */
function touchScreen(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/** Whether this device's share sheet takes a video file. */
export function canShareFiles(nav: Pick<Navigator, "canShare"> | undefined): boolean {
  try {
    return typeof nav?.canShare === "function" && nav.canShare({ files: [new File([new Uint8Array(1)], NAME, { type: TYPE })] });
  } catch {
    return false;
  }
}

/** "0:11 · 1080 × 1920 · with sound". */
export function filmLine(seconds: number, sound: boolean): string {
  return `${timecode(seconds)} · ${STAGE.w} × ${STAGE.h} · ${sound ? "with sound" : "no sound"}`;
}

/**
 * The film of an export, once it is made: its job and its address; null while it is at work, when it failed or was given up,
 * and when there is none. A Cancel may be answered with one (R25): the file was made before the cancel arrived, and is kept.
 */
export function madeFilm(shown: ExportShown | null): { job: string; url: string } | null {
  return shown?.status === "done" && shown.filmUrl !== null ? { job: shown.job, url: shown.filmUrl } : null;
}

/** The film, fetched to be shared. */
async function fetchFilm(url: string, signal: AbortSignal): Promise<File> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`the film's address answered ${response.status}`);
  return new File([await response.blob()], NAME, { type: TYPE });
}

/** A share that ended without the file being refused: the creator closed the share sheet, or one is open already. */
const notRefused = (error: unknown) => {
  const name = (error as { name?: unknown } | null)?.name;
  return name === "AbortError" || name === "InvalidStateError";
};

export interface ReadySheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The export's job: its file is fetched once, however often its address is signed anew. */
  job: string;
  filmUrl: string;
  poster: string | null;
  seconds: number;
  sound: boolean;
}

/** An export's file: in hand, or null when it is not to be shared (it could not be fetched, or the share sheet refused it). */
type Got = { job: string; file: File | null };

export function ReadySheet({ open, onOpenChange, job, filmUrl, poster, seconds, sound }: ReadySheetProps) {
  const [shares] = useState(() => touchScreen() && canShareFiles(typeof navigator === "undefined" ? undefined : navigator));
  const [got, setGot] = useState<Got | null>(null);

  // The latest address, kept for the fetch of a new export's file (it runs after this, in the same commit).
  const address = useRef(filmUrl);
  useEffect(() => {
    address.current = filmUrl;
  }, [filmUrl]);
  // The export's file, fetched once the sheet is open; ended by its answer, by its minute (then stopped), or by the sheet
  // closing, leaving or taking another export (then stopped, the file let go, and nothing is said).
  useEffect(() => {
    if (!shares || !open) return;
    const stop = new AbortController();
    let ended = false;
    function end(file: File | null, why?: unknown) {
      if (ended) return;
      ended = true;
      clearTimeout(late);
      if (file === null) console.warn("the film could not be fetched to share; Download instead", why);
      setGot({ job, file });
    }
    const late = setTimeout(() => {
      end(null, new Error(`the film was not fetched in ${FILM_FETCH_MS / 1000} s`));
      stop.abort();
    }, FILM_FETCH_MS);
    fetchFilm(address.current, stop.signal).then(
      (file) => end(file),
      (error: unknown) => end(null, error),
    );
    return () => {
      ended = true;
      clearTimeout(late);
      stop.abort();
      setGot(null);
    };
  }, [shares, job, open]);

  /** The file in hand; undefined while it is fetched; null when it is not to be shared. */
  const file = !shares ? null : got?.job === job ? got.file : undefined;
  const share = () => {
    if (!file) return;
    // In the tap itself, nothing awaited first.
    navigator.share({ files: [file] }).catch((error: unknown) => {
      if (notRefused(error)) return;
      console.warn("the share sheet refused the film; Download instead", error);
      setGot((now) => (now?.job === job ? { job, file: null } : now));
    });
  };
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom" showCloseButton={false} aria-describedby={undefined} onHandleDismiss={close}
        className="gap-0 px-4 pb-[max(34px,env(safe-area-inset-bottom))] md:mx-auto md:max-w-[440px]"
      >
        <div className="mb-2 flex h-11 items-center justify-between gap-3">
          <SheetTitle className="text-subhead font-[640] text-foreground">Ready</SheetTitle>
          <IconButton surface="card" aria-label="Close" onClick={close} className="h-9 w-9 [&_svg]:size-4">
            <CloseIcon strokeWidth={2.6} aria-hidden />
          </IconButton>
        </div>
        <div className="mb-4.5 mt-1.5 flex items-center gap-3.5">
          <VideoThumb src={poster} className="w-[72px] rounded-lg" />
          <div className="min-w-0">
            <p className="mb-1 text-subhead font-[640] text-foreground">Your video is ready</p>
            <p className="text-ui text-foreground-secondary tabular-nums">{filmLine(seconds, sound)}</p>
          </div>
        </div>
        {file === null ? (
          <Button asChild variant="primary" size="lg" className="w-full gap-2">
            <a href={filmUrl} download={NAME}>
              <SaveIcon aria-hidden />
              Download
            </a>
          </Button>
        ) : (
          <Button variant="primary" size="lg" className="w-full gap-2" disabled={file === undefined} aria-busy={file === undefined || undefined} onClick={share}>
            <SaveIcon aria-hidden />
            {file === undefined ? "Getting your video…" : "Save to Photos"}
          </Button>
        )}
        <Button variant="secondary" size="lg" className="mt-2 w-full" onClick={close}>
          Back to the edit
        </Button>
      </SheetContent>
    </Sheet>
  );
}
