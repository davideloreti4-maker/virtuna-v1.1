"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isSessionExpiredRefusal, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/session-expired";
import { isCreditWallRefusal } from "@/lib/billing/credit-wall";
import { resultHref } from "@/lib/result/href";
import { rememberRunVideo } from "@/lib/result/run-video";
import { startVideoSimulation } from "@/lib/result/simulate-again";
import { useSignedVideo } from "./use-signed-video";

/** The mock's "sims" glyph: a pulse line. 24×24, 1.75 stroke, in currentColor. */
function PulseIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 12h3l2.2-6 3.6 12 2.4-8 1.4 2h4.4" />
    </svg>
  );
}

/** The stored video at 124 wide (its first frame), or a quiet tile when there is no file. */
function VideoTile({ src }: { src: string | null }) {
  return (
    <div
      data-result="video"
      className={cn(
        "relative aspect-[9/16] w-[124px] shrink-0 overflow-hidden rounded-2xl bg-surface-sunken",
        src && "shadow-[var(--shadow-rest)]",
      )}
    >
      {src && (
        // `#t=0.001` makes Safari paint the first frame instead of a black box.
        <video src={`${src}#t=0.001`} preload="metadata" playsInline muted className="h-full w-full object-cover" />
      )}
    </div>
  );
}

/**
 * A run that came back without an audience (spec §5, "No audience"): the video, one line, and,
 * once it is switched on, "Simulate again" when the file is still stored. No number, no curve, no panels, no craft score.
 * Geometry from the mock's `noaudP`: the card (padding 14/14/12, 12 between video and line), the
 * button 16 below it, 56 tall.
 */
export function NoAudience({
  videoPath,
  simulateAgain = false,
}: {
  videoPath: string | null;
  /**
   * Offer "Simulate again". OFF BY DEFAULT, and the page does not switch it on yet: today
   * `POST /api/analyze` treats the path it is given as a fresh upload and DELETES that file when
   * the run is refused or fails (the daily limit, a refused audience, a validation error, a crash)
   * unless the creator opted in to retention. "Simulate again" hands it the file this run still
   * points at. It needs a server path that re-runs a stored file without that cleanup first.
   */
  simulateAgain?: boolean;
}) {
  const router = useRouter();
  const { src, status } = useSignedVideo(videoPath);
  // Navigating away must not be undone by a run that starts later.
  const here = useRef(true);
  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  /** The line under the button when the new run did not start; null when there is nothing to say. */
  const [problem, setProblem] = useState<string | null>(null);

  // Only with the file really there: without it the paid run has nothing to read.
  const offered = simulateAgain && videoPath != null && status === "ready";

  const startAgain = async () => {
    if (!videoPath) return;
    setBusy(true);
    setProblem(null);
    try {
      const id = await startVideoSimulation(videoPath);
      if (src) rememberRunVideo(id, src);
      // In place of this page: Back from the new run should not land here and invite a second paid run.
      if (here.current) router.replace(resultHref(id));
    } catch (error) {
      if (!here.current) return;
      // A spent allowance: the credit wall is the whole answer. A dead session: say that, not
      // that the run failed. Anything else is a failure.
      if (isCreditWallRefusal(error)) setProblem(null);
      else if (isSessionExpiredRefusal(error)) setProblem(SESSION_EXPIRED_MESSAGE);
      else setProblem("Could not start. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pt-[9px] md:mx-auto md:max-w-[588px] md:px-0 md:pt-8">
      <Card data-result="no-audience" className="flex items-center gap-3 px-3.5 pb-3 pt-3.5">
        <VideoTile src={src} />
        <p className="min-w-0 flex-1 pl-1.5 text-heading font-[640] text-foreground">No audience came back.</p>
      </Card>
      {offered && (
        <div className="mt-4" data-result="simulate-again">
          <Button variant="primary" size="xl" className="w-full" disabled={busy} onClick={startAgain}>
            <PulseIcon />
            Simulate again
          </Button>
          {problem && (
            <p role="alert" className="mt-2 text-center text-meta text-foreground-secondary">
              {problem}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
