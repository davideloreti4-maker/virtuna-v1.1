/**
 * script-from.ts — "Script this one" from a text's result page (spec §4): the page leaves the text
 * for its thread and goes to /home; the composer takes it once that thread has loaded and runs
 * today's write-script turn with it.
 *
 * The hand-off is a `sessionStorage` entry, never an address parameter: an address that starts a
 * paid turn could be sent to a creator as a link. The entry names its thread, so it can only run
 * there; it is taken (removed) by the first reader; and it expires `SCRIPT_FROM_MAX_AGE_MS` after it
 * was left, so a hand-off whose load never came (a failed load, an interrupted trip) cannot run a paid
 * turn long after the click that asked for it.
 *
 * No React.
 */

export const SCRIPT_FROM_KEY = "maven:script-from";

/**
 * How long a hand-off lives. The trip from the page to the loaded thread takes seconds; past a minute
 * the creator has moved on and must ask again, and nothing was charged (the turn never ran).
 */
export const SCRIPT_FROM_MAX_AGE_MS = 60_000;

/** A clock that jumped back must not keep an entry alive: an `at` further ahead than this is not ours. */
const CLOCK_AHEAD_MS = 1_000;

interface ScriptFrom {
  threadId: string;
  text: string;
  /** `Date.now()` when it was left. */
  at: number;
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // storage blocked (a private window with storage off)
  }
}

/** Leave `text` to be scripted in `threadId`. A blank text leaves nothing. False when it could not be left. */
export function leaveScriptFrom(threadId: string, text: string): boolean {
  const trimmed = text.trim();
  const s = store();
  if (!s || !threadId || trimmed.length === 0) return false;
  try {
    s.setItem(SCRIPT_FROM_KEY, JSON.stringify({ threadId, text: trimmed, at: Date.now() } satisfies ScriptFrom));
    return true;
  } catch {
    return false;
  }
}

/**
 * The text left for `threadId`, removed as it is read. Null when nothing was left, it was left for
 * another thread (then it is removed too: a hand-off never outlives the load it was meant for), it
 * was left more than `SCRIPT_FROM_MAX_AGE_MS` ago, or the entry is not ours (no finite `at`, or an
 * `at` more than a second in the future).
 */
export function takeScriptFrom(threadId: string): string | null {
  const s = store();
  if (!s) return null;
  let raw: string | null = null;
  try {
    raw = s.getItem(SCRIPT_FROM_KEY);
    if (raw !== null) s.removeItem(SCRIPT_FROM_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const entry = JSON.parse(raw) as Partial<ScriptFrom> | null;
    if (!entry || typeof entry.threadId !== "string" || typeof entry.text !== "string") return null;
    if (typeof entry.at !== "number" || !Number.isFinite(entry.at)) return null;
    const now = Date.now();
    if (entry.at > now + CLOCK_AHEAD_MS || now - entry.at > SCRIPT_FROM_MAX_AGE_MS) return null;
    const text = entry.text.trim();
    return entry.threadId === threadId && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
