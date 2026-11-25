"use client";

/**
 * Phone.tsx — the phone (Task 13b): the Player at 9:16, as tall as fits, radius 20, a 6 % border, and nothing on it but the
 * Player's own controls. Until the take is here it shows the take's poster, or stands empty. And `Takes`, the row of small
 * posters above it to choose a take from, shown only to a creator with more than one.
 */
import type { PlayerRef } from "@remotion/player";
import { forwardRef } from "react";
import { EditPlayer } from "@/edit/player/EditPlayer";
import { filmFrames, type Edit } from "@/lib/edit";

interface Props {
  edit: Edit | null;
  urls: Record<string, string>;
  poster: string | null;
  onApproximateColour: () => void;
}

export const Phone = forwardRef<PlayerRef, Props>(function Phone({ edit, urls, poster, onApproximateColour }, player) {
  return (
    <div
      id="edit-stage" data-frames={edit ? filmFrames(edit) : undefined}
      className="relative aspect-[9/16] h-[var(--phone-h)] max-w-full overflow-hidden rounded-2xl border border-border bg-surface motion-safe:transition-[height] motion-safe:duration-300"
    >
      {edit ? (
        // `edit-agent-stage`: the Player's time label is held to the room it has (the page's own styles, `agent.tsx`).
        <div className="edit-agent-stage absolute inset-0">
          {/* Space is the field's here: the Player does not take the keyboard's focus for its play button (it would, at every play and pause, out of the field a creator is typing in). */}
          <EditPlayer ref={player} edit={edit} kit="/edit" urls={urls} onApproximateColour={onApproximateColour} spaceKeyToPlayOrPause={false} style={{ height: "100%" }} />
        </div>
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link to the creator's own poster, not an image of the app's
        <img src={poster} alt="" className="size-full object-cover opacity-60" />
      ) : null}
    </div>
  );
});

export interface Listed {
  id: string;
  name: string;
  posterUrl: string | null;
}

const RING = "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-[color:var(--focus-ring)]";

/** The creator's ready takes as small posters, one chosen: native radios, so the arrow keys move between them. */
export function Takes({ takes, chosen, disabled, onChoose }: { takes: readonly Listed[]; chosen: string | null; disabled: boolean; onChoose: (id: string) => void }) {
  return (
    <fieldset data-part="takes" disabled={disabled} aria-label="Your takes" className="group flex h-16 min-w-0 max-w-full gap-2 overflow-x-auto disabled:opacity-50">
      {takes.map((take) => (
        <label
          key={take.id} title={take.name}
          className={`relative block h-16 w-9 flex-none cursor-pointer overflow-hidden rounded-sm border border-border opacity-50 hover:opacity-100 has-[:checked]:border-foreground/60 has-[:checked]:opacity-100 group-disabled:cursor-default ${RING}`}
        >
          <input type="radio" name="take" aria-label={take.name} checked={take.id === chosen} onChange={() => onChoose(take.id)} className="sr-only" />
          {take.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- as above
            <img src={take.posterUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="block size-full bg-surface-elevated" />
          )}
        </label>
      ))}
    </fieldset>
  );
}
