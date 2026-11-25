"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast";
import { useAddChannel, type AddChannelError } from "@/hooks/queries/use-channels";
import { raiseSessionExpired, reportSession401 } from "@/lib/auth/session-expired";
import type { WatchlistSource } from "@/lib/discover/watchlist-reads";
import { pullHref } from "@/lib/discover-next/discover-view";
import { followingToast, removeRefused } from "@/lib/discover-next/discover-words";
import { armPull } from "@/lib/discover-next/pull-intent";
import { filterRows, pullInput, removalOf, rowKey, type HubWatchlist } from "@/lib/discover-next/watchlist";

import { FollowSheet, type FollowStatus } from "./follow-sheet";
import { useRemoveCreator } from "./use-remove-creator";
import { WatchlistPanel } from "./watchlist-panel";

/**
 * The Watchlist chip with its data (spec 3.5): the creators followed, read on the server and handed in
 * by the hub, with Follow, Pull and Remove.
 *
 * - The rows are narrowed by the search as typed (handle or name).
 * - A read that could not tell whom the creator follows (`incomplete`) is the failure, never "nobody
 *   yet": its rows may rest on records the read could not name, so Remove could not clear them.
 * - Follow: the sheet sends the handle through the app's own add (read the account, then follow it);
 *   while it runs the sheet holds and a second submit sends nothing. Done: the sheet closes, a toast
 *   "Following @handle", and the page reads the watchlist again. Refused: the sentence in the sheet,
 *   which blames the handle only when the account could not be read. A lapsed session is the app's
 *   own dialog; the sheet then says nothing and stays, to send again once signed in.
 * - Pull: the intent is armed, then the pull page opens; only that press starts a pull there.
 * - Remove: the row leaves at once; then every record it rests on is cleared, side by side (each
 *   followed spelling, and the competitor link). All done: the page reads the watchlist again. One
 *   refused: the row comes back, a toast says so, and the page reads again (part may have gone). The
 *   session lapsed: the same, with the app's sign-in dialog in place of the toast.
 */
export interface WatchlistNextProps {
  watchlist: HubWatchlist;
  /** The server could not read the watchlist. */
  failed: boolean;
  /** The search as typed. */
  query: string;
  /** The library's proven videos, for the empty state; null when the library could not be read. */
  libraryCount: number | null;
  /** The empty state's quiet button: the library's videos. */
  onVideos(): void;
}

/** A row taken off the screen: while its removal is out, or done and not yet read again. */
interface Leaving {
  pending: boolean;
  /** The watchlist as read when the row left: a fresh read is the truth again. */
  on: HubWatchlist;
}

export function WatchlistNext({ watchlist, failed: readFailed, query, libraryCount, onVideos }: WatchlistNextProps): React.JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const add = useAddChannel();
  const removeCreator = useRemoveCreator();
  const failed = readFailed || watchlist.incomplete === true;

  // Rows taken off the screen by Remove. A row stays off while its removal is out, and once done until
  // the watchlist is read again (then the read decides, so a creator followed again shows).
  const [leaving, setLeaving] = useState<ReadonlyMap<string, Leaving>>(() => new Map());
  const rows = useMemo(
    () =>
      watchlist.sources.filter((source) => {
        const left = leaving.get(rowKey(source));
        return !left || (!left.pending && left.on !== watchlist);
      }),
    [watchlist, leaving],
  );
  const shown = useMemo(() => filterRows(rows, query), [rows, query]);
  // Removals out, as of the last press, not the last render.
  const removing = useRef(new Set<string>());

  const remove = async (source: WatchlistSource) => {
    const removal = removalOf(source);
    const key = rowKey(source);
    if (!removal || removing.current.has(key)) return;
    removing.current.add(key);
    const on = watchlist;
    const mark = (next: Leaving | null) =>
      setLeaving((now) => {
        const copy = new Map(now);
        if (next) copy.set(key, next);
        else copy.delete(key);
        return copy;
      });
    mark({ pending: true, on });
    const answer = await removeCreator(removal);
    removing.current.delete(key);
    if (answer === "done") {
      mark({ pending: false, on });
    } else {
      mark(null);
      // A lapsed session is the app's own dialog, with no toast under it.
      if (answer === "session") raiseSessionExpired();
      else toast({ variant: "error", title: removeRefused(source.handle) });
    }
    router.refresh();
  };

  const pull = (source: WatchlistSource) => {
    const input = pullInput(source.handle);
    if (!input) return;
    armPull(input);
    router.push(pullHref(input));
  };

  // The Follow sheet: open, what it is doing, and what opened it (the focus goes back there).
  const [followOpen, setFollowOpen] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus>(null);
  const opener = useRef<HTMLElement | null>(null);
  // Out as of the last submit, not the last render: two submits can land before one.
  const following = useRef(false);

  const openFollow = (from: HTMLElement) => {
    opener.current = from;
    setFollowStatus(null);
    setFollowOpen(true);
  };
  const onFollowOpenChange = (next: boolean) => {
    setFollowOpen(next);
    if (!next) setFollowStatus(null);
  };
  // Awaited rather than handed callbacks: a mutation's own callbacks are dropped once this chip has
  // gone (Back while Maven reads), and the follow still lands then. The toast and the router stand
  // above the chip, so the creator still hears it and the watchlist is still read again.
  const follow = async (handle: string) => {
    if (following.current) return;
    following.current = true;
    setFollowStatus({ kind: "reading", handle });
    try {
      const result = await add.mutateAsync(handle);
      setFollowStatus(null);
      setFollowOpen(false);
      toast({ variant: "success", title: followingToast(result?.handle || handle) });
      router.refresh();
    } catch (error) {
      const refusal = error as Partial<AddChannelError>;
      if (typeof refusal.status === "number" && reportSession401(refusal.status)) {
        setFollowStatus(null);
        return;
      }
      setFollowStatus({ kind: "failed", handle, step: refusal.step === "follow" ? "follow" : "read" });
    } finally {
      following.current = false;
    }
  };

  // "Try again": once the watchlist is read again, its notice goes, and the focus with it: to the
  // panel's first control, a link (a row with a creator's page) or a button. A retry that fails again
  // keeps the notice, and the focus on its button.
  const panelRef = useRef<HTMLDivElement>(null);
  const retried = useRef(false);
  const retry = () => {
    retried.current = true;
    router.refresh();
  };
  useEffect(() => {
    if (!retried.current || failed) return;
    retried.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) panelRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
  }, [failed]);

  return (
    <div ref={panelRef}>
      <WatchlistPanel
        state={failed ? "failed" : "ready"}
        rows={shown}
        total={rows.length}
        searching={query.trim() !== ""}
        libraryCount={libraryCount}
        onVideos={onVideos}
        onFollow={openFollow}
        onPull={pull}
        onRemove={(source) => void remove(source)}
        onRetry={retry}
      />
      <FollowSheet
        open={followOpen}
        onOpenChange={onFollowOpenChange}
        status={followStatus}
        onFollow={(handle) => void follow(handle)}
        returnFocus={() => opener.current}
      />
    </div>
  );
}
