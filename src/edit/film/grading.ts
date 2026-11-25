/**
 * grading.ts — whether this browser can run the colour pass, and how a preview says that it
 * cannot.
 *
 * The colour pass needs WebGL 2. Where a browser has none, the engine leaves the footage black
 * and then drops, without a word, to a picture with no look at all. So the film asks first: a
 * preview that cannot run the pass shows the nearest stand-in a plain filter gives
 * (`standInOf`) and tells the app around it. What is posted is never a stand-in: the renderer
 * always runs the pass itself.
 */
import { createContext, useSyncExternalStore } from "react";

let known: boolean | null = null;

/**
 * Whether this browser can run the colour pass. Asked once a page, on a canvas of its own, which
 * is given back at once: a browser has only so many. A browser whose canvas throws when asked (an
 * extension can make it) cannot.
 */
export function canGrade(): boolean {
  if (known === null) {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.width = 0;
      canvas.height = 0;
      known = gl !== null;
    } catch {
      known = false;
    }
  }
  return known;
}

/**
 * Whether a clip's failure is the colour pass failing, and not the clip itself (a file that is
 * not there or cannot be read fails with the pass on, too). The engine says WebGL in what it
 * reports, or in the reason beneath it; nothing else it reports does. If a later engine words it
 * differently, this says no, and the film is then as it was before it could tell: the engine's
 * own fall-back, without a look. The forced-failure probe shows it when that happens.
 */
export function colourPassFailed(error: Error): boolean {
  const beneath = error.cause instanceof Error ? error.cause.message : "";
  return /webgl/i.test(`${error.message} ${beneath}`);
}

const never = () => () => {};

/** `canGrade` for a component: the browser's own answer there, and yes on the server, where nothing is drawn. */
export const useCanGrade = (): boolean => useSyncExternalStore(never, canGrade, () => true);

/** What a preview tells the app around it. The renderer has none. */
export interface Preview {
  /** The looks on screen are a stand-in: close, not what will be posted. Called once it is so. */
  onApproximateColour: () => void;
}

export const PreviewContext = createContext<Preview | null>(null);
