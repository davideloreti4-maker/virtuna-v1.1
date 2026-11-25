/**
 * Shared fixtures for the posted tests. Every handle, id and link is made up (the repository is public).
 */
import type { PiecePostRow } from "../posted";

export const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const CHAT = "11111111-1111-4111-8111-111111111111";
export const CHAT_2 = "22222222-2222-4222-8222-222222222222";
export const ROW_ID = "33333333-3333-4333-8333-333333333333";

export const HOUR = 3_600_000;
export const MINUTE = 60_000;
/** The tests' "now": Tue 24 Nov 2026, 12:00 UTC. */
export const NOW = new Date("2026-11-24T12:00:00.000Z");
export const ago = (ms: number, from: Date = NOW): Date => new Date(from.getTime() - ms);

/**
 * A post id whose top 32 bits are `at` in whole seconds. The same arithmetic as the code under test, so it
 * is only used once `postIdTime` is pinned against a hand-computed id (`posted.test.ts`).
 */
export function idAt(at: Date, low = 123_456_789): string {
  return ((BigInt(Math.floor(at.getTime() / 1000)) << BigInt(32)) + BigInt(low)).toString();
}

/** A stored row as PostgREST returns it (times with microseconds and an offset). */
export function rowOf(over: Partial<PiecePostRow> = {}): PiecePostRow {
  return {
    id: ROW_ID,
    user_id: USER,
    thread_id: CHAT,
    piece_key: "Ab3_k9-Zx0",
    piece_kind: "hooks",
    said_number: 67,
    said_measure: "stop",
    said_at: "2026-11-19T09:00:00.000000+00:00",
    platform: "tiktok",
    post_url: "https://vm.tiktok.com/ZMmadeup1/",
    post_id: null,
    handle: null,
    posted_at: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    read_at: null,
    reads: [],
    settled_at: null,
    usual_views: null,
    usual_posts: null,
    attempts: 0,
    read_error: null,
    last_attempt_at: null,
    removed_at: null,
    created_at: "2026-11-20T10:00:00.123456+00:00",
    updated_at: "2026-11-20T10:00:00.123456+00:00",
    ...over,
  };
}

/** The same row after a successful read: numbers, a handle and an id. */
export function readRow(over: Partial<PiecePostRow> = {}): PiecePostRow {
  const postedAt = ago(48 * HOUR);
  return rowOf({
    post_id: idAt(postedAt),
    handle: "nia.cooks",
    posted_at: postedAt.toISOString(),
    views: 12_400,
    likes: 2_100,
    comments: 84,
    shares: 310,
    saves: 420,
    read_at: ago(1 * HOUR).toISOString(),
    ...over,
  });
}
