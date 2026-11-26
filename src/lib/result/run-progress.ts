/**
 * What the result page can know about a run that is still in flight, from the events of
 * `GET /api/analyze/[id]/stream`.
 *
 * That stream sends the viewer groups once (`roster`, about 4 seconds in), the post's cover once a
 * link's scrape has landed (`source`), each scene frame where the frame job runs
 * (`filmstrip_segment_ready`), and the finish (`complete`); it replays all of them on every
 * reconnect. It carries no stage, no percent and no partial result, so nothing here
 * invents one.
 */

export interface RunProgress {
  /** The viewer groups in the stream's order; null until the roster has arrived. */
  groups: readonly string[] | null;
  /** The frames by scene, null where one has not arrived; grows as frames arrive. */
  frames: ReadonlyArray<string | null>;
  /** The post's cover (a link run), once the stream named one; null until then, and for a file. */
  cover: string | null;
  /** True once the stream said the run is finished. */
  done: boolean;
}

export const NO_PROGRESS: RunProgress = { groups: null, frames: [], cover: null, done: false };

export type RunEvent =
  | { type: "roster"; data: unknown }
  | { type: "source"; data: unknown }
  | { type: "filmstrip_segment_ready"; data: unknown }
  | { type: "complete" };

/** More scenes than any run has (the engine cuts 4 to 19); a guard against a broken event. */
const MOST_FRAMES = 60;
/** More viewer groups than any run has (ten today); a longer roster is not read. */
const MOST_GROUPS = 24;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isPlace = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MOST_FRAMES;
/** A frame or a cover is a stored or posted picture's https address; anything else is not shown. */
export const isPictureAddress = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** The next state after one event. Returns the same object when the event changes nothing. */
export function applyRunEvent(state: RunProgress, event: RunEvent): RunProgress {
  switch (event.type) {
    case "roster": {
      // Sent again on every reconnect: the first one stands.
      if (state.groups) return state;
      const personas = isRecord(event.data) ? event.data.personas : null;
      if (!Array.isArray(personas) || personas.length > MOST_GROUPS) return state;
      const groups = personas
        .map((persona) => (isRecord(persona) ? persona.archetype : null))
        .filter((group): group is string => typeof group === "string" && group !== "");
      return groups.length > 0 ? { ...state, groups } : state;
    }
    case "source": {
      // Sent once, but replayed on every reconnect: the first cover stands.
      if (state.cover) return state;
      const cover = isRecord(event.data) ? event.data.cover_url : null;
      return isPictureAddress(cover) ? { ...state, cover } : state;
    }
    case "filmstrip_segment_ready": {
      if (!isRecord(event.data)) return state;
      const { segment_idx: place, keyframe_uri: picture } = event.data;
      if (!isPlace(place) || !isPictureAddress(picture)) return state;
      // Replayed on every reconnect: the same frame at the same place changes nothing.
      if (state.frames[place] === picture) return state;
      const frames = Array.from({ length: Math.max(place + 1, state.frames.length) }, (_, i) => state.frames[i] ?? null);
      frames[place] = picture;
      return { ...state, frames };
    }
    case "complete":
      return state.done ? state : { ...state, done: true };
  }
}

/** The frames that have arrived, in scene order. */
export function arrivedFrames(state: RunProgress): string[] {
  return state.frames.filter((frame): frame is string => frame !== null);
}

/** Whole seconds since the run started; 0 without a start, or when this clock runs ahead of it. */
export function elapsedSeconds(startedAt: number | null, now: number): number {
  if (startedAt === null) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}
