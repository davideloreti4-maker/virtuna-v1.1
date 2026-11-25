"use client";

import type { Ref } from "react";

import { FilmIcon } from "./answer-icons";

/**
 * A card's primary with the quiet "How to film it" beside it (thread depth §3.2, second part §4):
 * the script card's ("Add your take") and the remix card's ("Script it"), the same markup on both.
 *
 * A phone: the primary across the card, the quiet button under it, full width, 6 above. From md the
 * primary is as wide as its content at the card's start, so the quiet button joins its row, 8 to its
 * right, as wide as its words (14 each side): centred across a wide card it sat far from it (fix round
 * 1, seen at 1440). The primary itself is the same either way.
 *
 * "How to film it" 40 tall, 14 / 570 in the secondary ink, the film icon 17, 7 apart, centred (step 2
 * film, `.quiet`); the sunken fill and the ink on hover and press, no fill at rest, the look's focus
 * ring. It opens a sheet that is not a Radix trigger, so it says so itself (`aria-haspopup`,
 * `aria-expanded`), and the card hands it to the sheet to take the focus back (`buttonRef`).
 */
export function WithFilmButton({
  primary,
  expanded,
  onOpen,
  buttonRef,
}: {
  primary: React.ReactNode;
  /** Whether its sheet is open. */
  expanded: boolean;
  onOpen: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="md:flex md:items-center md:gap-2">
      {primary}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={onOpen}
        className="mt-1.5 flex h-10 w-full cursor-pointer items-center justify-center gap-[7px] rounded-xl text-reading font-[570] text-foreground-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground active:bg-surface-sunken active:text-foreground md:mt-0 md:w-auto md:shrink-0 md:px-3.5"
      >
        <FilmIcon size={17} aria-hidden className="shrink-0" />
        How to film it
      </button>
    </div>
  );
}
