"use client";

/**
 * RemixSourceEmbed — watch the remixed source, with sound, without leaving the card.
 *
 * ── Why an iframe and not a player we control ────────────────────────────────────────────────
 * There is no copy of the source to play. `remix-runner.ts` calls `resolveAndRehost` with no owner
 * `userId`, so the run takes the orphan-drop path and `cleanup()` deletes the temp mp4
 * unconditionally in its `finally` (T-03-02); `video_storage_path` is never set for a scraped
 * source. Retaining it is phase 4's policy reversal, which the owner's 2026-08-14 ruling routes
 * around. So the platform serves its own bytes and this component retains nothing.
 *
 * ── Why it is NOT wired to the scrub playhead ────────────────────────────────────────────────
 * Neither TikTok nor Instagram exposes a seek API to a plain iframe. A layout implying the
 * playhead drives this player would advertise a control that does not exist, so the embed is
 * visually its own panel, below the strip, with its own label. Scrubbing never touches it.
 *
 * ── Why the iframe mounts late ───────────────────────────────────────────────────────────────
 * A thread can hold three remix cards off one run. Mounting on render would open three players and
 * make three third-party connections before anyone asked to watch anything. It mounts on click,
 * once, and stays mounted so toggling closed does not restart the video.
 *
 * NO ACCENT. The dosage rule is LOCKED and the card already spends its one on the Borrowed chip.
 */
import { useState } from "react";
import { CaretToggle } from "./caret-toggle";
import { parseSourceUrl, type SourcePlatform } from "@/lib/remix/source-platform";

const PLATFORM_LABEL: Record<SourcePlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export function RemixSourceEmbed({ sourceUrl }: { sourceUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  // Sticky: once opened, the iframe stays in the tree so collapsing does not tear down the player
  // and lose the viewer's position.
  const [everOpened, setEverOpened] = useState(false);

  const parsed = parseSourceUrl(sourceUrl);

  // No embed for YouTube (owner ruling: TikTok + Instagram), for a shortlink whose id is not in
  // the URL, or for anything unrecognised. The card's own "Watch the original ↗" already covers
  // those, so rendering nothing here leaves no dead end.
  if (!parsed?.embedUrl) return null;

  const label = PLATFORM_LABEL[parsed.platform];

  return (
    <div data-source-embed className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setEverOpened(true);
        }}
        aria-expanded={open}
        className="flex items-center gap-1.5 self-start text-label text-foreground-muted transition-colors hover:text-foreground-secondary"
      >
        <CaretToggle open={open} />
        {open ? "Hide the source" : `Watch the source on ${label}`}
      </button>

      {everOpened && (
        <div className={open ? "flex flex-col gap-1.5" : "hidden"}>
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-black/20">
            <iframe
              src={parsed.embedUrl}
              title={`The source post on ${label}`}
              // `allow` is scoped to what a video player legitimately needs. No camera, no mic,
              // no geolocation — an embed that can ask for those is a different thing entirely.
              allow="encrypted-media; picture-in-picture; fullscreen"
              // The embed is third-party and untrusted. It gets scripts and same-origin (its own
              // origin) because no player works without them, and nothing else — notably not
              // `allow-top-navigation`, which would let it redirect the whole app away.
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
              className="block h-[560px] w-full border-0"
            />
          </div>
          {/* Says where the bytes come from and that this half is not scrubbable, so the strip
              above never reads as a broken control for the player. */}
          <p className="text-label text-foreground-muted">
            Plays on {label}, with sound. The strip above scrubs stills — the two aren&rsquo;t linked.
          </p>
        </div>
      )}
    </div>
  );
}
