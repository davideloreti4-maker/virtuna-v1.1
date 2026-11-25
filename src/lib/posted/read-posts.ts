/**
 * read-posts.ts — reads the public numbers of a person's linked posts that are owed a read (plan
 * 2026-11-24-after-posting, Task 2; spec §4; controller rulings 10, 13, 14, 18, 22, 23, 26 and 27).
 *
 * SERVER ONLY in use. It takes the database client (the routes give it the service client: every query is the
 * repository's, scoped to the caller's `user_id`) and the scraper as parameters, and makes at most
 * `READS_PER_RUN` scraper calls a run, and starts none once `RUN_SECONDS` (110) of real time have passed since the
 * run began (ruling 33; `clock`, apart from the injected `now`). The scraper is made only when a read is owed.
 * In order:
 *
 *  1. A post never read: one read of it by its link. It gives the post id, the account, the post's time
 *     (`postedAtOf`: from the id), the numbers, and the canonical link when account and id are valid.
 *  2. Per account with posts owed a read: ONE read of the account's latest 30 posts. Each of the caller's
 *     unsettled posts of that account found in it by post id gets the numbers and a kept read; one at or
 *     past `finalAtOf` settles (`settled_at`, and the usual of the account's other posts, `usualOf`; none
 *     under five). A post owed a read that is not in the list is read alone, and settles with the list's usual.
 *  3. A post read before with no account: read alone, and it settles without a usual.
 *
 * One read at a time (rulings 18, 22 and 26): before any scraper call the run claims the posts it will read or
 * write (`claimPosts`: one compare-and-set statement that takes a post no read is on, `isBeingRead`, and sets
 * `last_attempt_at = now`, `read_error = null`). A claim holds for `CLAIM_SECONDS` (240), the longest read. A
 * post it does not get is being read by another run: it is skipped, with no call and no write. An account is
 * read only when the run holds one of its owed posts; its other posts found in the list are claimed before
 * they are written. Every post the run claims ends its attempt (a good read writes `read_at` =
 * `last_attempt_at`; a failed one sets `read_error`); one it claimed and did not read (the cap, the time
 * budget, or a failure after the claim) is given back at the end of the run, as it was (`releasePosts`). A post
 * with numbers whose `RETRY_MAX`-th failure in a row this is gets closed with them (ruling 34).
 *
 * Every good read writes `attempts = 0`, `read_error = null`, `last_attempt_at`; every failed one
 * `attempts + 1`, `read_error` ('gone' when the scraper finds no post, else 'failed'), `last_attempt_at`
 * (ruling 13). A failed read changes no number already read (ruling 14). A throw in one read stops no other.
 *
 * "Try again" (`only` + `retry`) on an unread post reads it again now: the ten-minute wait after a failure is
 * for reads nobody asked for. It goes through the same claim; the failed attempt it follows has ended, so it
 * is read at once (ruling 22); only a read in progress holds it off. It is bounded (ruling 27): it counts its
 * failures on (only a good read sets `attempts` to 0), and a post that cannot be read with `RETRY_MAX` (8)
 * failures is read no more: the post comes back as it is, with no call.
 *
 * What the scraper returns that comes from outside the app (a caption, an author's name) is never stored, and
 * a failure is logged by its class only: the scraper's errors carry the pasted link.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { IngestError, type VideoData } from "@/lib/scraping/types";
import type { Database } from "@/types/database.types";
import { POST_ID_PATTERN, RETRY_MAX, finalAtOf, handleOf, isDue, postHref, postedAtOf, stateOf, usualOf, type PiecePostRow } from "./posted";
import { appendRead, claimPosts, duePosts, postOfId, postsOfHandle, releasePosts, updatePost, type PostPatch } from "./posted-repo";

type Db = SupabaseClient<Database>;

/** The scraper, as the reader uses it: exactly these two calls (`ApifyScrapingProvider` has both). */
export interface PostReader {
  scrapeSinglePostMetrics(url: string): Promise<VideoData | null>;
  scrapeVideos(handle: string, limit: number, mode: "profile"): Promise<VideoData[]>;
}

/** Scraper calls one run may make, at most. */
export const READS_PER_RUN = 3;
/** The account's latest posts one account read takes. */
export const ACCOUNT_POSTS = 30;
/** No scraper call starts once this much real time has passed since the run began (ruling 33): a single call
 *  may wait 180 s, and the refresh route's limit is 300 s. */
export const RUN_SECONDS = 110;

type Usual = { views: number; posts: number } | null;

/** A failure in words that hold no pasted link: the scraper's `IngestError` by its kind, else the class. */
export function errorWords(err: unknown): string {
  if (err instanceof IngestError) return `IngestError[${err.kind}]`;
  if (err instanceof Error) return err.name || "Error";
  return typeof err;
}

const COUNTS = ["views", "likes", "comments", "shares", "saves"] as const;

/** The post's numbers as the table takes them (whole, not negative), or null when one is not a number. */
function numbersOf(video: VideoData): Record<(typeof COUNTS)[number], number> | null {
  const out = {} as Record<(typeof COUNTS)[number], number>;
  for (const key of COUNTS) {
    const n = video[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
    out[key] = Math.round(n);
  }
  return out;
}

/**
 * The patch of a good read: the numbers, a kept read, the attempt reset. With `identity` (a read of the post
 * by its link) also the post id, the account, the post's time and the canonical link, each kept as it was when
 * the read has no valid one. Null when the numbers are not numbers (that read failed).
 */
function goodRead(row: PiecePostRow, video: VideoData, now: Date, identity: boolean): PostPatch | null {
  const numbers = numbersOf(video);
  if (!numbers) return null;
  const at = now.toISOString();
  const patch: PostPatch = {
    ...numbers,
    read_at: at,
    reads: appendRead(row.reads, { at, ...numbers }),
    attempts: 0,
    read_error: null,
    last_attempt_at: at,
  };
  if (!identity) return patch;
  const postId = POST_ID_PATTERN.test(video.platformVideoId) ? video.platformVideoId : row.post_id;
  const handle = handleOf(video) ?? row.handle;
  const postedAt = postedAtOf(postId, video.postedAt, now);
  return {
    ...patch,
    post_id: postId,
    handle,
    posted_at: postedAt ? postedAt.toISOString() : row.posted_at,
    post_url: postHref(handle, postId) ?? row.post_url,
  };
}

const settled = (usual: Usual, now: Date): PostPatch => ({
  settled_at: now.toISOString(),
  usual_views: usual?.views ?? null,
  usual_posts: usual?.posts ?? null,
});

/**
 * The patch of a failed read (ruling 13). When it brings a post that HAS numbers to `RETRY_MAX` failures in a
 * row, the post is closed there and then with the numbers it has: settled now, no usual (ruling 34). A post
 * never read has nothing to close it with: it stays unread.
 */
function failedRead(row: PiecePostRow, error: "gone" | "failed", now: Date): PostPatch {
  const attempts = row.attempts + 1;
  const patch: PostPatch = { attempts, read_error: error, last_attempt_at: now.toISOString() };
  const hasNumbers = row.read_at !== null && row.views !== null;
  return hasNumbers && attempts >= RETRY_MAX ? { ...patch, ...settled(null, now) } : patch;
}

/**
 * Reads what is owed for `userId` now (or only the post `only`), and returns the caller's posts it wrote, as
 * stored after. `provider` is the scraper, or what makes it: made once, only when a read is owed, before
 * anything is claimed (ruling 23: the real one throws without its token, and then nothing is written).
 * `clock` is the real time in milliseconds (ruling 33), only for the run's time budget. Throws on a database
 * error.
 */
export async function readDue(
  client: Db,
  userId: string,
  provider: PostReader | (() => PostReader),
  now: Date,
  opts: { only?: string; retry?: boolean } = {},
  clock: () => number = () => Date.now(),
): Promise<PiecePostRow[]> {
  const touched = new Map<string, PiecePostRow>();
  let calls = 0;
  // The real clock, not the injected `now` (which stamps the writes): a run starts no call after its time.
  const began = clock();
  const canCall = () => calls < READS_PER_RUN && clock() - began < RUN_SECONDS * 1000;
  const isFinal = (row: Pick<PiecePostRow, "posted_at" | "created_at">) => {
    const at = finalAtOf(row);
    return at !== null && at.getTime() <= now.getTime();
  };

  /** The posts this run holds (ruling 18), as it last saw them: claimed by it, so no other run reads or
   *  writes them meanwhile. Only these are read and written. */
  const held = new Map<string, PiecePostRow>();

  const write = async (row: PiecePostRow, patch: PostPatch): Promise<PiecePostRow | null> => {
    const after = await updatePost(client, userId, row.id, patch, now);
    if (after) {
      touched.set(after.id, after);
      held.set(after.id, after);
    }
    return after;
  };

  /** One read of one post by its link. `settleWith` says, for the row as read, whether it settles now and
   *  with which usual (null: not now). The stored row after, and whether the read was good. */
  const readAlone = async (row: PiecePostRow, settleWith: (read: PiecePostRow) => { usual: Usual } | null) => {
    calls += 1;
    let video: VideoData | null;
    try {
      video = await reader.scrapeSinglePostMetrics(row.post_url);
    } catch (err) {
      console.warn("[posted] post read failed:", errorWords(err));
      return { row: await write(row, failedRead(row, "failed", now)), good: false };
    }
    if (video === null) return { row: await write(row, failedRead(row, "gone", now)), good: false };
    const patch = goodRead(row, video, now, true);
    if (!patch) {
      console.warn("[posted] post read failed:", "numbers that are not numbers");
      return { row: await write(row, failedRead(row, "failed", now)), good: false };
    }
    const settle = settleWith({ ...row, ...patch });
    return { row: await write(row, settle ? { ...patch, ...settled(settle.usual, now) } : patch), good: true };
  };

  // ── What is owed ──────────────────────────────────────────────────────────
  let due: PiecePostRow[];
  if (opts.only !== undefined) {
    const row = await postOfId(client, userId, opts.only);
    if (!row) return [];
    if (opts.retry && stateOf(row) === "unread") {
      // "Try again" (ruling 27): bounded for every post that cannot be read, read before or not; it counts on,
      // and only a good read resets it. Claimed as read: its ended attempt frees it at once (ruling 22).
      if (row.attempts >= RETRY_MAX) return [row];
      due = [row];
    } else {
      due = isDue(row, now) ? [row] : [];
    }
  } else {
    due = await duePosts(client, userId, now);
  }
  if (due.length === 0) return [];
  /** The scraper, made once something is owed (the closures above run only after this). */
  const reader: PostReader = typeof provider === "function" ? provider() : provider;
  const owed = new Map(due.map((row) => [row.id, row]));
  /** What each post the run claimed was before its claim, to give back the ones it does not read (ruling 26). */
  const claimedFrom = new Map<string, PiecePostRow>();
  /** Claims the posts not held yet, as this run read them, in one statement; returns those it got
   *  (rulings 18 and 22). */
  const claim = async (rows: readonly PiecePostRow[]): Promise<PiecePostRow[]> => {
    const wanted = rows.filter((row) => !held.has(row.id));
    if (wanted.length === 0) return [];
    const got = await claimPosts(client, userId, wanted, now);
    for (const row of got) {
      held.set(row.id, row);
      claimedFrom.set(row.id, wanted.find((w) => w.id === row.id)!);
    }
    return got;
  };
  /** Posts read well by their link in this run (an account read adds no second kept read to them). */
  const readNow = new Set<string>();
  /** Accounts to read, in the order their first post is owed, each with the ids of its owed posts. */
  const accounts = new Map<string, Set<string>>();
  const owe = (handle: string, id: string) => accounts.set(handle, (accounts.get(handle) ?? new Set()).add(id));

  try {
    // ── 1. Posts never read: one read each, by the link ─────────────────────
    for (const row of due.filter((r) => r.read_at === null)) {
      if (!canCall()) break;
      const [mine] = await claim([row]);
      if (!mine) continue; // another run is reading it
      const { row: after, good } = await readAlone(mine, (read) => (read.handle === null && isFinal(read) ? { usual: null } : null));
      if (!good || !after) continue;
      readNow.add(after.id);
      // Final, with an account: the account read gives its usual.
      if (after.handle !== null && after.settled_at === null && isFinal(after)) owe(after.handle, after.id);
    }
    for (const row of due) if (row.read_at !== null && row.handle !== null) owe(row.handle, row.id);

    // ── 2. One read per account ─────────────────────────────────────────────
    for (const [handle, ids] of accounts) {
      if (!canCall()) break;
      // Its owed posts, claimed in one statement; those another run holds are left to it, and an account
      // with none left for this run is not read.
      await claim([...ids].map((id) => owed.get(id)!));
      const mine = [...ids].filter((id) => held.has(id));
      if (mine.length === 0) continue;
      calls += 1;
      let list: VideoData[];
      try {
        list = await reader.scrapeVideos(handle, ACCOUNT_POSTS, "profile");
      } catch (err) {
        console.warn("[posted] account read failed:", errorWords(err));
        for (const id of mine) {
          const row = held.get(id)!;
          if (!readNow.has(id)) await write(row, failedRead(row, "failed", now));
        }
        continue;
      }
      const inList = new Map<string, VideoData>();
      for (const video of list) if (!inList.has(video.platformVideoId)) inList.set(video.platformVideoId, video);

      // Every unsettled post of the caller's on this account, as stored now (after step 1's writes and the
      // claim). Those not owed but found in the list are claimed too before they are written.
      const ofAccount = await postsOfHandle(client, userId, handle);
      await claim(ofAccount.filter((row) => !owed.has(row.id) && row.post_id !== null && inList.has(row.post_id)));
      for (const row of ofAccount) {
        if (!held.has(row.id)) continue; // another run's, or neither owed nor in the list
        const usual = () => usualOf(list, row.post_id, now);
        const found = row.post_id === null ? undefined : inList.get(row.post_id);
        if (found) {
          const patch = readNow.has(row.id) ? {} : goodRead(row, found, now, false);
          if (patch === null) {
            // Held (owed or claimed with the list): its attempt ends as a failed read, never left open.
            await write(row, failedRead(row, "failed", now));
            continue;
          }
          const next = { ...row, ...patch };
          const all = isFinal(next) ? { ...patch, ...settled(usual(), now) } : patch;
          if (Object.keys(all).length > 0) await write(row, all);
        } else if (readNow.has(row.id)) {
          // Read by its link in this run, final, and not among the latest 30: it settles with their usual.
          if (isFinal(row)) await write(row, settled(usual(), now));
        } else if (ids.has(row.id) && canCall()) {
          await readAlone(row, (read) => (isFinal(read) ? { usual: usual() } : null));
        }
      }
    }

    // ── 3. Posts read before with no account: read alone, settled without a usual ─
    for (const row of due.filter((r) => r.read_at !== null && r.handle === null)) {
      if (!canCall()) break;
      const [mine] = await claim([row]);
      if (!mine) continue;
      await readAlone(mine, (read) => (isFinal(read) ? { usual: null } : null));
    }

    return [...touched.values()];
  } finally {
    // ── The posts claimed and not read (the cap, or a failure after the claim): given back as they were ─
    const unread = [...claimedFrom.values()].filter((row) => !touched.has(row.id));
    if (unread.length > 0) {
      try {
        await releasePosts(client, userId, unread, now);
      } catch (err) {
        // Not given back: each frees itself `CLAIM_SECONDS` after its claim.
        console.error("[posted] release failed:", err instanceof Error ? err.message : String(err));
      }
    }
  }
}
