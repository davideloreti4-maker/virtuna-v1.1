/**
 * Shared fixtures for the posted parts' tests. Every handle, id and link is made up (the repository is
 * public). Dates are built in local time, so the day words hold in any time zone the suite runs in.
 */
import type { Posted } from "@/lib/posted/posted";

export const HOUR = 3_600_000;
/** The tests' clock: Tue 24 Nov 2026, 12:00 local. */
export const NOW = new Date(2026, 10, 24, 12, 0, 0);
export const local = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0);

export const THREAD = "11111111-1111-4111-8111-111111111111";
export const KEY = "Ab3_k9-Zx0";
export const ANALYSIS = "44444444-4444-4444-8444-444444444444";
export const POSTED_ID = "33333333-3333-4333-8333-333333333333";
export const HANDLE = "nia.cooks";
export const POST_ID = "7301444403323456789";
export const HREF = `https://www.tiktok.com/@${HANDLE}/video/${POST_ID}`;
/** What the creator pastes: a share link with tracking, never shown back. */
export const PASTED = "https://www.tiktok.com/@nia.cooks/video/7301444403323456789?is_from_webapp=1&sender_device=pc&web_id=99887766";
/** A caption the server must never send, and the page must never show if it did. */
export const CAPTION = "my $5 snack hack you NEED to try #fyp";

const NUMBERS = { views: 31_000, likes: 2_100, comments: 84, shares: 310, saves: 420 };

/** A final post, Fri 20 Nov, 1.8× the usual. */
export function posted(over: Partial<Posted> = {}): Posted {
  const postedAt = local(20, 15);
  return {
    id: POSTED_ID,
    threadId: THREAD,
    pieceKey: KEY,
    said: { number: 67, measure: "stop" },
    state: "final",
    linkedAt: local(20, 16).toISOString(),
    postedAt: postedAt.toISOString(),
    finalAt: new Date(postedAt.getTime() + 72 * HOUR).toISOString(),
    numbers: NUMBERS,
    usual: { ratio: 1.8, tone: "above" },
    handle: HANDLE,
    href: HREF,
    due: false,
    ...over,
  };
}

/** Read, younger than 72 hours: posted Mon 23 Nov, final Thursday. */
export function soFar(over: Partial<Posted> = {}): Posted {
  const postedAt = local(23, 9);
  return posted({
    state: "so-far",
    postedAt: postedAt.toISOString(),
    finalAt: new Date(postedAt.getTime() + 72 * HOUR).toISOString(),
    numbers: { views: 12_400, likes: 890, comments: 31, shares: 96, saves: 140 },
    usual: null,
    ...over,
  });
}

/** Just linked: nothing read yet, a read owed. */
export function reading(over: Partial<Posted> = {}): Posted {
  return posted({
    state: "reading",
    linkedAt: NOW.toISOString(),
    postedAt: null,
    finalAt: null,
    numbers: null,
    usual: null,
    handle: null,
    href: null,
    due: true,
    ...over,
  });
}

/** Gone (private or deleted), or a first read that failed (ruling 19a). */
export function unread(over: Partial<Posted> = {}): Posted {
  return reading({ state: "unread", due: false, ...over });
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A promise held open until the test lets it go. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** One request the page sent: method, path with its query, and the JSON body. */
export interface Sent {
  method: string;
  url: string;
  body: unknown;
}

/** The requests a `fetch` stand-in saw, read back in order. */
export function sentOf(mock: { mock: { calls: unknown[][] } }): Sent[] {
  return mock.mock.calls.map(([input, init]) => {
    const req = init as RequestInit | undefined;
    return {
      method: (req?.method ?? "GET").toUpperCase(),
      url: String(input),
      body: typeof req?.body === "string" ? JSON.parse(req.body) : undefined,
    };
  });
}
