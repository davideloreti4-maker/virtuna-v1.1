/**
 * remix-from.ts — "Remix this" from Discover (a video's page, a pulled video's sheet): the page leaves
 * the video's link here and opens a new chat; Home's composer takes it on that blank chat and runs the
 * Remix skill with the link, as Home's own Remix with the link sent would.
 *
 * A module memory, as `lib/discover-next/pull-intent.ts` arms a pull: `router.push` keeps the module, a
 * reload does not. Never an address: a link must not be able to start a paid run. Taken once (the slot is
 * cleared on every take, so a second effect or a later visit can never run a second, billed remix), and
 * only within `REMIX_FROM_MS` of the press, so a press whose chat never opened cannot run long after.
 *
 * No React.
 */

/** How long a hand-off lives: the trip to the new chat takes seconds; past a minute the creator asks again. */
export const REMIX_FROM_MS = 60_000;

/** A clock that jumped back must not keep a hand-off alive: an `at` further ahead than this is not ours. */
const CLOCK_AHEAD_MS = 1_000;

export interface RemixFrom {
  /** The video's web address. */
  url: string;
  /** Its platform as the library stores it, lower case ("tiktok"). */
  platform: string;
  /** What the creator wants to make from it, or null. */
  brief: string | null;
}

let left: (RemixFrom & { at: number }) | null = null;

/** A web address (http or https), trimmed; null otherwise. */
function webLink(value: string): string | null {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Leaves a remix of `url` for the next new chat. False, and nothing left (an earlier hand-off dropped too),
 * when the link is not a web address or the platform is missing. A second leave replaces the first.
 */
export function leaveRemixFrom(
  request: { url: string; platform: string | null; brief?: string | null },
  now: number = Date.now(),
): boolean {
  const url = webLink(request.url);
  const platform = (request.platform ?? "").trim().toLowerCase();
  if (url === null || platform === "") {
    left = null;
    return false;
  }
  const brief = request.brief?.trim() || null;
  left = { url, platform, brief, at: now };
  return true;
}

/** The remix left, once: null when nothing was left, or it was left more than a minute ago (or ahead of now). */
export function takeRemixFrom(now: number = Date.now()): RemixFrom | null {
  const entry = left;
  left = null;
  if (entry === null) return null;
  if (entry.at > now + CLOCK_AHEAD_MS || now - entry.at > REMIX_FROM_MS) return null;
  return { url: entry.url, platform: entry.platform, brief: entry.brief };
}
