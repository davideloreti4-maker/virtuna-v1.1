"use client";

/**
 * EditPlayer.tsx — the Player in the app: plays an edit, live. It draws the same film the
 * renderer posts, so what is seen here is what is posted.
 */
import { Player, type PlayerRef } from "@remotion/player";
import { forwardRef, useMemo, type CSSProperties } from "react";
import { Film } from "../film/Film";
import { PreviewContext } from "../film/grading";
import { filmSize, type FilmProps } from "../film/props";

export interface EditPlayerProps extends FilmProps {
  style?: CSSProperties;
  controls?: boolean;
  /** Called when the looks on screen are a stand-in, because this browser cannot run the colour pass: close, not what will be posted. */
  onApproximateColour?: () => void;
  /**
   * The Player's own `spaceKeyToPlayOrPause`, passed straight through; left out, it is the Player's default (on). On, the
   * Player takes the keyboard's focus for its play button as it mounts and at every play and pause: a page with a field to
   * type in turns it off.
   */
  spaceKeyToPlayOrPause?: boolean;
}

/**
 * How long before its first frame a run, a cutaway or a sound is made ready, in seconds, so that
 * it is there when the film gets to it. Measured 2026-11-19 on a Mac with local files: with none,
 * the film stood still for about 200 ms at a cutaway and at a fade; with one second, not at all.
 * More costs memory on a phone, so the iPhone test has the last word.
 */
const READY_AHEAD = 1;

export const EditPlayer = forwardRef<PlayerRef, EditPlayerProps>(function EditPlayer({ style, controls = true, onApproximateColour, spaceKeyToPlayOrPause, edit, kit, urls }, ref) {
  const size = filmSize(edit);
  const props = useMemo(() => ({ edit, kit, urls }), [edit, kit, urls]); // the same object until one of the three changes, so nothing is drawn again for nothing
  const preview = useMemo(() => ({ onApproximateColour: () => onApproximateColour?.() }), [onApproximateColour]);
  return (
    <PreviewContext.Provider value={preview}>
      <Player
        ref={ref}
        component={Film}
        inputProps={props}
        durationInFrames={size.durationInFrames}
        fps={size.fps}
        compositionWidth={size.width}
        compositionHeight={size.height}
        controls={controls}
        spaceKeyToPlayOrPause={spaceKeyToPlayOrPause}
        defaultPremountInSeconds={READY_AHEAD}
        style={{ width: "100%", ...style }}
      />
    </PreviewContext.Provider>
  );
});
