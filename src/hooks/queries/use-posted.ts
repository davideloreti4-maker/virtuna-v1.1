"use client";

/**
 * use-posted — a piece's posted link (plan 2026-11-24-after-posting, Task 3).
 *
 * `usePosted` reads `GET /api/posted` for one piece (a text piece by its chat and result-page key, a
 * video by its analysis id) under `postedKeys`. `useAddPosted` and `useRemovePosted` send the link and
 * take it away; `useRefreshPosted` asks the server to read the post's public numbers
 * (`POST /api/posted/refresh`, which reads through a scraper and can take a minute or more).
 *
 * Adding, removing and a finished read mark the posted entries and the Library's (`libraryKeys`) old,
 * so every surface that shows the piece reads it again.
 *
 * The reads, exactly:
 * - After a successful add, ONE read of that post starts by itself.
 * - A mounted page whose piece is owed a read (`posted.due`) asks for ONE read per mount
 *   (`useRefreshWhenDue`); a read that comes back still owed one starts no other. No loop, no interval.
 * - While a read of a piece is out, a second one for it is not started: the one out is handed back
 *   (with the first one's `retry`, whatever the second asked).
 * - Apart from those, a piece shown as "Reading the post" has its row (not the post) read again every
 *   10 seconds for at most 3 minutes (`usePosted`).
 * - A refused remove says "Couldn't remove the link." in the app's toast (`useRemovePosted`), wherever
 *   the remove was asked from: the result page's card, or Library's row menu.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  notifyManager,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import type { Posted } from "@/lib/posted/posted";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";
import { libraryKeys } from "./use-library";

/** The piece a link is added to: a text piece (its chat and its result-page key), or a video. */
export type PostedPiece = { kind: "text"; threadId: string; key: string } | { kind: "video"; analysisId: string };

export const postedKeys = {
  all: ["posted"] as const,
  piece: (piece: PostedPiece) =>
    piece.kind === "text"
      ? (["posted", "piece", "text", piece.threadId, piece.key] as const)
      : (["posted", "piece", "video", piece.analysisId] as const),
};

const JSON_HEADERS = { "Content-Type": "application/json" };

function pieceQuery(piece: PostedPiece): string {
  const params = new URLSearchParams(
    piece.kind === "text" ? { threadId: piece.threadId, key: piece.key } : { analysisId: piece.analysisId },
  );
  return `/api/posted?${params.toString()}`;
}

/** Marks every posted entry and the Library's old: the surfaces that show a piece read it again. */
function readAgain(client: QueryClient) {
  void client.invalidateQueries({ queryKey: postedKeys.all });
  void client.invalidateQueries({ queryKey: libraryKeys.all });
}

/** Puts `rows` into every posted entry that holds the same link (by id); the others stay as they are. */
function putRows(client: QueryClient, rows: readonly Posted[]) {
  for (const row of rows) {
    client.setQueriesData<Posted | null>({ queryKey: postedKeys.all }, (now) => (now && now.id === row.id ? row : now));
  }
}

// ─── Read ────────────────────────────────────────────────────────────────────

/** While a piece is being read, its row is read again this often (the cheap read, never the scraper)… */
export const READING_REREAD_MS = 10_000;
/** …for at most this long from when the page first saw it being read (ruling 19b). */
export const READING_REREAD_FOR_MS = 3 * 60_000;

/**
 * The piece's posted link, or null when it has none. No piece: nothing is asked. A refusal (signed
 * out, not the caller's piece, a funnel visitor, the flag off) is an error at once, not asked again;
 * a refused re-read keeps the link read before (TanStack keeps `data` on a failed refetch).
 *
 * "Reading the post" is never a dead end (ruling 19b): while the link is being read, its row is read
 * again every 10 seconds, for at most 3 minutes, so the numbers (or "Couldn't read this post", with
 * Try again) appear without a reload. It stops at once when the state changes, and with the page
 * (the interval belongs to the mounted query). It never starts a scraper read.
 */
export function usePosted(piece: PostedPiece | null): UseQueryResult<Posted | null> {
  // The link this page saw being read, and since when (the page's clock).
  const readingSince = useRef<{ id: string; at: number } | null>(null);
  return useQuery({
    queryKey: piece ? postedKeys.piece(piece) : (["posted", "none"] as const),
    queryFn: async ({ signal }) => {
      const res = await fetch(pieceQuery(piece!), { signal });
      if (!res.ok) throw new Error(`Posted request failed (${res.status})`);
      const data = (await res.json()) as { posted?: Posted | null };
      return data.posted ?? null;
    },
    enabled: piece !== null,
    retry: false,
    refetchInterval: (query) => {
      const posted = query.state.data;
      if (!posted || posted.state !== "reading") {
        readingSince.current = null;
        return false;
      }
      const now = Date.now();
      if (readingSince.current?.id !== posted.id) readingSince.current = { id: posted.id, at: now };
      return now - readingSince.current.at < READING_REREAD_FOR_MS ? READING_REREAD_MS : false;
    },
  });
}

// ─── Reads of the post's numbers ─────────────────────────────────────────────

export interface RefreshArgs {
  /** One posted link; none: every read the caller is owed. */
  id?: string;
  /** "Try again" on a post that could not be read: read now, whatever wait the failures set (rulings 22, 27:
   *  the failures still count; a post never read is tried at most `RETRY_MAX` times). */
  retry?: boolean;
}

/** The reads out, in one client, by link id ("*" for a read of everything owed). */
interface ReadsOut {
  running: Map<string, Promise<Posted[] | null>>;
  listeners: Set<() => void>;
  /** Changes whenever a read starts or ends: what a component watching them compares. */
  version: number;
}

const readsOut = new WeakMap<QueryClient, ReadsOut>();
const EVERYTHING = "*";

function readsOf(client: QueryClient): ReadsOut {
  let out = readsOut.get(client);
  if (!out) {
    out = { running: new Map(), listeners: new Set(), version: 0 };
    readsOut.set(client, out);
  }
  return out;
}

function changed(out: ReadsOut) {
  out.version += 1;
  for (const listener of out.listeners) listener();
}

async function sendRefresh({ id, retry }: RefreshArgs): Promise<Posted[] | null> {
  const body: RefreshArgs = {};
  if (id !== undefined) body.id = id;
  if (retry) body.retry = true;
  try {
    const res = await fetch("/api/posted/refresh", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const data = (await res.json()) as { posted?: unknown };
    return Array.isArray(data.posted) ? (data.posted as Posted[]) : null;
  } catch {
    return null;
  }
}

/**
 * Asks the server to read a posted link's numbers (or every read owed). While one for the same link is
 * out, that one is handed back and nothing new is sent. The rows it read go into their entries at once;
 * then the posted entries and the Library's are read again. Never throws: a failed read is null.
 */
function startRefresh(client: QueryClient, args: RefreshArgs = {}): Promise<Posted[] | null> {
  const out = readsOf(client);
  const key = args.id ?? EVERYTHING;
  const running = out.running.get(key);
  if (running) return running;
  const promise = sendRefresh(args).then((rows) => {
    if (rows) putRows(client, rows);
    out.running.delete(key);
    changed(out);
    readAgain(client);
    return rows;
  });
  out.running.set(key, promise);
  changed(out);
  return promise;
}

export interface RefreshPosted {
  refresh(args?: RefreshArgs): Promise<Posted[] | null>;
  /** A read of this link (none: of everything owed) is out. */
  isRefreshing(id?: string): boolean;
}

/** Reads of posted links, shared by every component of one client (a read out is out for all). */
export function useRefreshPosted(): RefreshPosted {
  const client = useQueryClient();
  const out = readsOf(client);
  const subscribe = useCallback(
    (listener: () => void) => {
      out.listeners.add(listener);
      return () => {
        out.listeners.delete(listener);
      };
    },
    [out],
  );
  useSyncExternalStore(
    subscribe,
    () => out.version,
    () => 0,
  );
  return {
    refresh: (args) => startRefresh(client, args),
    isRefreshing: (id) => out.running.has(id ?? EVERYTHING),
  };
}

/**
 * A mounted page whose piece is owed a read asks for one, once per mount (per link). A read that comes
 * back still owed one does not start another; a link owed a read only later in the mount gets its one.
 */
export function useRefreshWhenDue(posted: Posted | null | undefined): void {
  const client = useQueryClient();
  const asked = useRef(new Set<string>());
  const owed = posted?.due ? posted.id : null;
  useEffect(() => {
    if (owed === null || asked.current.has(owed)) return;
    asked.current.add(owed);
    void startRefresh(client, { id: owed });
  }, [client, owed]);
}

// ─── Add, remove ─────────────────────────────────────────────────────────────

export interface AddPostedInput {
  piece: PostedPiece;
  /** The link as `parsePostLink` gave it. */
  url: string;
}

/** The route's refusals that have their own words; anything else is "Couldn't add the link. Try again." */
const REFUSALS: Record<string, string> = {
  not_tiktok: POSTED_STRINGS.notTiktok,
  already_linked: POSTED_STRINGS.alreadyLinked,
  too_many: POSTED_STRINGS.tooMany,
};
/** By status alone only a 409 (one live link per piece). A 429 says "20 links today" only with its own code
 *  (`too_many`): the shared rate limiter answers 429 too, and those words would be false (ruling 32). */
const REFUSALS_BY_STATUS: Record<number, string> = { 409: POSTED_STRINGS.alreadyLinked };

/**
 * POST `/api/posted`. Refused: an Error whose message is what to show. Added: the piece's entry holds the
 * new link at once (it says "Reading the post"), the entries are read again, and ONE read of the post
 * starts by itself.
 */
export function useAddPosted(): UseMutationResult<Posted, Error, AddPostedInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ piece, url }) => {
      const body =
        piece.kind === "text"
          ? { kind: "text", threadId: piece.threadId, key: piece.key, url }
          : { kind: "video", analysisId: piece.analysisId, url };
      let res: Response;
      try {
        res = await fetch("/api/posted", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
      } catch {
        throw new Error(POSTED_STRINGS.addFailed);
      }
      const data = (await res.json().catch(() => ({}))) as { posted?: Posted | null; error?: unknown };
      if (res.ok && data.posted) return data.posted;
      const code = typeof data.error === "string" ? data.error : "";
      throw new Error(REFUSALS[code] ?? REFUSALS_BY_STATUS[res.status] ?? POSTED_STRINGS.addFailed);
    },
    onSuccess: async (posted, { piece }) => {
      client.setQueryData(postedKeys.piece(piece), posted);
      void startRefresh(client, { id: posted.id });
      readAgain(client);
      // TanStack tells the page's observers of the new entry on its next notify tick: wait for it, so a
      // caller's own `onSuccess` (the sheet closing) lands on a page that already shows the link.
      await new Promise<void>((resolve) => notifyManager.schedule(resolve));
    },
  });
}

/**
 * DELETE `/api/posted/<id>`. Removed: every entry holding that link holds null (the piece asks
 * "Posted it?" again). Refused (or offline): "Couldn't remove the link." in the app's toast (rulings 17
 * and 21; the toast Library uses for a refused rename), and the piece keeps its link. Either way the
 * entries are read again, so a link already removed elsewhere (a 404) leaves the page too. The server
 * keeps the row (the day's allowance is not given back), so this is asked once more first.
 *
 * Needs the app's `ToastProvider` (the (app) layout has it).
 */
export function useRemovePosted(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/posted/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Remove posted link failed (${res.status})`);
    },
    onSuccess: (_data, id) => {
      client.setQueriesData<Posted | null>({ queryKey: postedKeys.all }, (now) => (now && now.id === id ? null : now));
    },
    onError: () => {
      toast({ variant: "error", title: POSTED_STRINGS.removeFailed });
    },
    onSettled: () => {
      readAgain(client);
    },
  });
}
