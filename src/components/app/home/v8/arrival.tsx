"use client";

/**
 * The v8 arrival welcome — the brand mark over a time greeting, centered.
 *
 * ── Owner ruling 2026-08-11 r4 ────────────────────────────────────────────────────
 * "the section above the video (headline and subheadline) done better — welcome
 * section like in claude or chatgpt, and i also want our logo to be there."
 *
 * What was wrong: this block used a SINGLE h1 that SWAPPED identity — it was the
 * greeting until drops arrived and then became "Tonight's remixes." So on the screen a
 * creator actually meets (drops present, the normal case) there was no welcome at all,
 * no name, no mark; a shelf label was wearing the hero's clothes. Two different jobs
 * were sharing one slot, and the greeting always lost.
 *
 * Split in two, each in its own register:
 *   - HERE: the welcome. Mark + serif greeting, centered — the voice moment, and the
 *     only serif on the arrival.
 *   - `drop-shelf.tsx`: the shelf owns its own label, demoted to chrome. A section
 *     label is not a headline, and it only exists when the section does.
 *
 * The mark is CREAM, not the accent it defaults to. The brand mark is a sanctioned
 * accent use, but the sidebar already spends it on the same screen and the dosage rule
 * (LOCKED) allows at most one accent element visible at a time. Same call `HomeGreeting`
 * made, for the same reason: the greeting IS the brand moment, not a logo with a caption.
 *
 * Time-of-day resolves AFTER mount — the server's clock is not the creator's (prod SSR
 * runs UTC), so rendering it server-side would greet wrong or flag a hydration mismatch.
 */
import { useEffect, useMemo, useState } from "react";
import { MavenMark } from "@/components/brand/maven-logo";
import { useProfile } from "@/hooks/queries/use-profile";
import type { Audience } from "@/lib/audience/audience-types";
import {
  audienceToMeta,
  roomHeadcount,
} from "@/lib/surfaces/ambient-v2-audience-meta";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export interface ArrivalV8Props {
  /** The resolved audience. Absent ⇒ no room line (the welcome renders alone). */
  audience?: Audience;
  /** Opens the room. Absent ⇒ the line renders as static text rather than a dead button. */
  onOpenRoom?: () => void;
}

export function ArrivalV8({ audience, onOpenRoom }: ArrivalV8Props = {}) {
  const { data: profile } = useProfile();
  // First name only — the full display name wraps the line and orphans the surname.
  const name = profile?.name?.trim().split(/\s+/)[0] || "";
  // "Welcome back" until mount → SSR and the first client paint agree.
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    setGreeting(timeGreeting());
  }, []);

  // The room's facts, composed from the SAME meta the rail header reads (`audienceToMeta` →
  // headcount · calibration badge · scene), so the two surfaces cannot state different rooms.
  const roomLine = useMemo(() => {
    if (!audience) return null;
    const meta = audienceToMeta(audience);
    return `${roomHeadcount(meta.tier)} · ${meta.calibrationBadge} · simulating for ${meta.scene}`;
  }, [audience]);

  return (
    <div
      data-testid="arrival-v8"
      className="flex w-full flex-col items-center px-1 pb-9 text-center"
    >
      <MavenMark size={28} className="text-foreground" />
      {/* 26 → 30 at sm. "Good afternoon, Alexandra." sets past a 393px gutter at 30px and wraps,
          orphaning the name on its own line — the exact defect that shortened this to a first name
          in the first place. Same responsive step `HomeGreeting` uses. */}
      <h1 className="mt-3.5 font-serif text-[26px] font-normal leading-tight tracking-[-0.01em] text-foreground sm:text-[30px]">
        {greeting}
        {name ? <>, {name}</> : null}.
      </h1>
      {/* ── The room, named on the phone's first screen (owner ruling 2026-08-13) ──────────
          MEASURED at 393×852 before this existed: the first screen was hamburger · mark ·
          greeting · one caption · four cards, and the only thing naming the audience was the
          dock's plate at y=1,133 — which states the CREATOR's handle ("@mrbeast · calibrated"),
          not the room. So the surface that makes this product different from a content feed was
          both below the fold and about somebody else.

          This is the same argument r3 accepted for the desktop rail ("the arrival was a greeting,
          a shelf and a composer — the shape of every chat app"), and it lands harder here: on
          desktop the rail is on screen at rest; on a phone there is no 400px column to put one in.
          So the phone gets the fact plus a door to the board, not a board.

          `xl:hidden` — at ≥xl the rail states this verbatim in its own header, and printing it
          twice on one screen is the duplication the foot chip's `showName={!useHeader && !useRail}`
          rule already exists to prevent.

          The `text-caption text-foreground-muted` role is the shelf caption's, deliberately: the
          greeting stays the arrival's ONLY heading (r5), so this reads as chrome under the hero
          rather than a second title. No accent — dosage is LOCKED and this is not one of the
          three sanctioned uses. */}
      {roomLine ? (
        onOpenRoom ? (
          <button
            type="button"
            data-testid="arrival-room-line"
            onClick={onOpenRoom}
            className="mt-2.5 inline-flex items-center gap-1 text-caption text-foreground-muted transition-colors hover:text-foreground-secondary xl:hidden"
          >
            {roomLine}
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden className="shrink-0">
              <path
                d="M4.5 2.5L8 6l-3.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          // No opener wired ⇒ state the fact, but do not render a control that does nothing.
          <p
            data-testid="arrival-room-line"
            className="mt-2.5 text-caption text-foreground-muted xl:hidden"
          >
            {roomLine}
          </p>
        )
      ) : null}
    </div>
  );
}
