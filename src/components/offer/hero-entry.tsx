"use client";

/**
 * HeroEntry — the live product, in the hero (ONBOARDING-FUNNEL-DESIGN.md §0b①).
 *
 * This replaces `ProductRender`, which was a *fixture* of the Test card with a guided
 * build-motion — a picture of the product. Owner, repeatedly: "I want a real experience, same
 * as on the platform." So the first screen stops showing the product and becomes it: the
 * visitor types or drops a video here, is signed in anonymously without being asked, and lands
 * in the real thread with their own run already in flight.
 *
 * WHY `EmbeddedComposer` AND NOT THE REAL `Composer`: the /home Composer is 3,184 lines of
 * thread machinery — stream hooks, `useParams`, portals, the presence rail, `AmbientDetail`.
 * Mounting that inside a scrolling marketing page is exactly what rendered the retired
 * walkthrough at 2,182px instead of 800 (an unbounded-height wrapper collapsing `height:100%`).
 * `EmbeddedComposer` is the Room-owned atom built for precisely this: a surface with no thread,
 * holding none of that, whose only contract point is `onLaunch`.
 *
 * The verb menu is live rather than pinned to Test, because "same as on the platform" is the
 * whole point and the spend is bounded either way: an anonymous user's pool is `DEMO_CREDITS`
 * (= `CREDIT_COSTS.score`, 10 credits), enforced regardless of `BILLING_ENFORCE_QUOTA`, and
 * every skill draws from that same pool.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmbeddedComposer } from "@/components/app/home/embedded-composer";
import { buildThreadLaunchHref } from "@/lib/room-contract/thread-launch";
import type { Verb } from "@/lib/room-contract/types";
import { ensureAnonymousSession } from "@/lib/auth/anonymous";
import { stagePendingUpload, clearPendingUpload } from "@/lib/onboarding/pending-upload";
import { TIKTOK_URL_PATTERN } from "@/lib/tiktok-url";

/** Mirrors `VideoUpload`'s client-side checks so the hero rejects at the same boundary the
 *  thread would — a fast UX reject only; /api/analyze re-validates as the trust boundary. */
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

function rejectFile(f: File): string | null {
  if (!ACCEPTED_VIDEO_TYPES.includes(f.type) && !f.name.match(/\.(mp4|mov|webm)$/i)) {
    return "That file type isn't supported. Use MP4, MOV or WebM.";
  }
  if (f.size > MAX_FILE_SIZE) {
    const mb = Math.round(f.size / (1024 * 1024));
    return `That file is ${mb}MB. The limit is 200MB.`;
  }
  return null;
}

export function HeroEntry() {
  const router = useRouter();
  const [verb, setVerb] = useState<Verb>("Test");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * The one path into the product. Signs in (or reuses a session), then hands off through the
   * existing Seam-4 URL. `run: true` fires the skill once on arrival — honesty-spine-safe
   * because the visitor's explicit send here IS the fire, never a silent auto-run.
   */
  const launch = async (input: string, launchVerb: Verb) => {
    if (starting) return;
    setStarting(true);
    setError(null);

    const session = await ensureAnonymousSession();
    if (!session.ok) {
      // Never strand them on a dead button at the one moment the page exists to convert.
      clearPendingUpload();
      setStarting(false);
      setError("Couldn't start a session. Refresh and try again.");
      return;
    }

    router.push(buildThreadLaunchHref({ input, verb: launchVerb, run: true }));
  };

  const onLaunch = (input: string, launchVerb: Verb) => {
    // A Test run needs a real TikTok URL to run headless — mirrors the server regex at
    // /api/analyze and the thread's own check, so the visitor learns here rather than after
    // a navigation. Every other verb takes free text.
    if (launchVerb === "Test" && !TIKTOK_URL_PATTERN.test(input.trim())) {
      setError("That doesn't look like a TikTok link. Paste a TikTok URL, or drop the video file.");
      return;
    }
    void launch(input, launchVerb);
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // Let the same file be picked again after an error.
    e.target.value = "";
    if (!f) return;

    const rejection = rejectFile(f);
    if (rejection) {
      setError(rejection);
      return;
    }

    // A File cannot ride a query string, so it is staged in module scope and consumed by the
    // thread's seed inlet on the other side of the client-side push. An upload always means
    // Test, whatever verb the field happens to be showing.
    stagePendingUpload(f);
    void launch("", "Test");
  };

  return (
    <div className="flex flex-col justify-center">
      <div className="rounded-xl border border-border bg-surface-elevated p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[13px] font-medium text-foreground">
            Test a video now — free, no account
          </span>
        </div>

        <EmbeddedComposer
          verb={verb}
          onVerbChange={setVerb}
          onLaunch={onLaunch}
          onAttach={() => fileInputRef.current?.click()}
          disabled={starting}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={onFilePicked}
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Reserve the row so a message never reflows the hero under the visitor's cursor. */}
        <div className="mt-3 min-h-[20px] text-[13px]" aria-live="polite">
          {error ? (
            <span className="text-accent-text">{error}</span>
          ) : starting ? (
            <span className="text-foreground-muted">Starting your read…</span>
          ) : (
            <span className="text-foreground-muted">
              Paste a TikTok link or drop your file · MP4, MOV, WebM
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
