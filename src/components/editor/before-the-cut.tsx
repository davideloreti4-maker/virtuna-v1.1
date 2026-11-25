"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { analysisSeconds, leftWords, waitWords } from "@/lib/edit/waits";
import { useShellStore } from "@/stores/shell-store";
import { lookKeyOfStyle } from "./edit-session";
import { LookRow } from "./look-sheet";
import { sentence } from "./net";
import type { EditApi } from "./use-edit";

/**
 * before-the-cut.tsx — what the editor page shows while there is no cut to show (spec 2026-11-24-editor-screens-design.md §5.1;
 * plan 2026-11-24-editor-screens-a, Task 15, moved here unchanged by plan 2026-11-25-editor-screens-b, Task 5): an edit there is
 * nothing to show of (`Unshown`), and under the video while the take gets ready and its first cut is made (`BeforeTheCut`).
 */

/** A wait: what is happening, how long is left in words when that can be told, and the bar (running, when no share can be). */
function WaitLine({ label, left, share }: { label: string; left: string | null; share: number | null }) {
  const percent = share === null ? null : Math.round(Math.min(1, Math.max(0, share)) * 100);
  return (
    <div data-part="wait" className="flex flex-col gap-2 px-0.5">
      <div className="flex items-baseline justify-between gap-3 text-ui">
        {/* Read as it changes (the next stage), and not the time left, which changes each second. */}
        <span aria-live="polite" className="font-[640] text-foreground">{label}</span>
        {left !== null && <span className="text-foreground-secondary tabular-nums">{left}</span>}
      </div>
      <div
        role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-valuetext={left ?? undefined}
        className="h-1 overflow-hidden rounded-full bg-surface-sunken"
      >
        {percent === null ? (
          <div className="h-full w-full animate-pulse rounded-full bg-action/30 motion-reduce:animate-none" />
        ) : (
          <div className="h-full rounded-full bg-action" style={{ width: `${percent}%` }} />
        )}
      </div>
    </div>
  );
}

/** What is said of a take whose bytes are all sent while another video of the creator's is listened to: it starts after (R31). */
const BEHIND = "Another video of yours is being listened to. This one starts when it is done.";

/** A button that opens the device's picker for another take (MP4 or MOV), clicked inside the tap. */
function PickAgain({ label, primary, disabled, onFile }: { label: string; primary: boolean; disabled: boolean; onFile(file: File): void }) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={primary ? "primary" : "secondary"} disabled={disabled} onClick={() => picker.current?.click()}>
        {label}
      </Button>
      <input
        ref={picker} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" aria-label="Choose a video file" tabIndex={-1} className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

/**
 * An edit there is nothing to show of: one line and one way on. Not there, or closed to the account (the gate's own sentence):
 * Home, the back-to-Library marker dropped, as the result page's dead end drops it. Not read: Try again, while the page goes
 * on trying by itself.
 */
export function Unshown({ state, gate, onAgain }: { state: "not read" | "not here" | "closed"; gate: string | null; onAgain(): void }) {
  const router = useRouter();
  const home = () => {
    useShellStore.getState().setThreadBack(null);
    router.push("/home");
  };
  const line = state === "not read" ? "This edit could not be read." : state === "closed" ? (gate ?? "The editor is not open to this account yet.") : "This edit is not here.";
  return (
    <div data-part="unshown" className="flex flex-col items-center gap-4 px-4 pt-24 text-center">
      <p className="text-title font-[640] text-foreground">{line}</p>
      {state === "not read" ? (
        <Button variant="primary" onClick={onAgain}>
          Try again
        </Button>
      ) : (
        <Button variant="secondary" onClick={home}>
          Home
        </Button>
      )}
    </div>
  );
}

/**
 * Under the video while there is no cut (screen 2, §5.1). Getting ready: the wait in words and the looks to pick from (the one
 * picked is the first cut's); a take sent while another of the creator's is listened to says so while it waits its turn (R31).
 * Making the first cut: the same, the looks resting while the cut is out; a cut that failed is said in the wait's place with
 * Try again (R20), and another look can be picked for it. The upload stopped: Try again where trying again can work (R17), and
 * always the video to pick again; when it waited too long for that other one, the route's own sentence. The take failed: the
 * worker's sentence and another video.
 */
export function BeforeTheCut({ api, poster, words, takeSeconds }: { api: EditApi; poster: string | null; words: readonly string[]; takeSeconds: number | null }) {
  const { session, state, upload } = api;
  const take = session.view?.take ?? null;
  const problem = session.problem?.text ?? null;
  const out = session.working !== null;

  if (state === "upload stopped" || state === "take failed") {
    const stopped = state === "upload stopped";
    const again = stopped && upload?.status === "failed" && upload.again;
    const waitedOut = stopped && upload?.status === "failed" && upload.waitedOut ? upload.error : null;
    return (
      <div data-part="stopped" className="flex flex-col items-start gap-3 px-0.5">
        <p role="alert" className="text-title font-[640] text-foreground">
          {problem ?? (stopped ? (waitedOut ?? "The upload stopped.") : sentence(take?.error ?? "that take could not be analysed"))}
        </p>
        <div className="flex flex-wrap gap-2">
          {again && (
            <Button variant="primary" disabled={out} onClick={api.retry}>
              Try again
            </Button>
          )}
          <PickAgain label={stopped ? "Pick the video again" : "Use another video"} primary={!again} disabled={out} onFile={(file) => void api.replaceTake(file)} />
        </div>
      </div>
    );
  }

  const cutting = state === "cutting";
  const sending = take?.status === "uploading" && upload?.status === "sending";
  const behind = take?.status === "uploading" && upload?.status === "waiting";
  const heard = take?.status === "analysing" && take.progress !== null && take.progress > 0 ? take.progress : null;
  return (
    <div className="flex flex-col gap-3.5">
      {cutting && problem !== null ? (
        <div data-part="stopped" className="flex flex-col items-start gap-3 px-0.5">
          <p role="alert" className="text-title font-[640] text-foreground">
            {problem}
          </p>
          <Button variant="primary" onClick={api.retry}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {cutting ? (
            <WaitLine label="Making the first cut" left={null} share={null} />
          ) : sending ? (
            <WaitLine label="Uploading" left={upload.secondsLeft === null ? null : leftWords(upload.secondsLeft)} share={upload.total > 0 ? upload.sent / upload.total : null} />
          ) : behind ? (
            <WaitLine label={BEHIND} left={null} share={null} />
          ) : (
            // The bytes are sent: the take is listened to from here on, though its analysis may not have said so yet.
            <WaitLine label="Listening to it" left={takeSeconds === null ? null : `${waitWords(analysisSeconds(takeSeconds) * (1 - (heard ?? 0)))} left`} share={heard} />
          )}
          {problem !== null && (
            <p role="alert" className="px-0.5 text-meta text-foreground-secondary">
              {problem}
            </p>
          )}
        </>
      )}
      <LookRow picked={lookKeyOfStyle(session.waitLook)} poster={poster} words={words} onPick={api.setWaitLook} disabled={cutting && out} />
    </div>
  );
}
