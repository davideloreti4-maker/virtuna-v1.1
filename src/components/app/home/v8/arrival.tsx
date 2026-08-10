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
import { useEffect, useState } from "react";
import { MavenMark } from "@/components/brand/maven-logo";
import { useProfile } from "@/hooks/queries/use-profile";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function ArrivalV8() {
  const { data: profile } = useProfile();
  // First name only — the full display name wraps the line and orphans the surname.
  const name = profile?.name?.trim().split(/\s+/)[0] || "";
  // "Welcome back" until mount → SSR and the first client paint agree.
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    setGreeting(timeGreeting());
  }, []);

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
    </div>
  );
}
