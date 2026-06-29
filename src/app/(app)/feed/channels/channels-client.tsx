"use client";

/**
 * ChannelsClient — Discover Feed Phase 1.2 orchestrator for /feed/channels.
 *
 * Owns the watchlist query + add/untrack mutations + toasts, and composes the two
 * panels: AddChannelPanel (Add URL / Search / Suggested / Describe) and WatchlistPanel
 * (the tracked channels with Remove / Remove all / Export). Reached from the feed
 * toolbar's "Customize channels" (Phase 2); standalone-routable today.
 */
import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { FeedViewTabs } from "@/components/feed/feed-view-tabs";
import {
  AddChannelPanel,
  type AddChannelResultLite,
} from "@/components/channels/add-channel-panel";
import { WatchlistPanel } from "@/components/channels/watchlist-panel";
import {
  useChannelWatchlist,
  useAddChannel,
  useUntrackChannel,
  type ChannelWatchlistEntry,
} from "@/hooks/queries/use-channels";

/** Serialize the watchlist to CSV (RFC-4180-ish quoting) for the Export action. */
function toCsv(channels: ChannelWatchlistEntry[]): string {
  const header = ["handle", "display_name", "followers", "videos", "total_views", "tracked_at"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = channels.map((c) => [
    c.handle,
    c.displayName ?? "",
    c.followerCount ?? "",
    c.videoCount ?? "",
    c.totalViews,
    c.trackedAt,
  ]);
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function ChannelsClient() {
  const { toast } = useToast();
  const { data, isLoading } = useChannelWatchlist();
  const channels = useMemo(() => data?.channels ?? [], [data]);

  const addChannel = useAddChannel();
  const untrack = useUntrackChannel();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const trackedHandles = useMemo(
    () => new Set(channels.map((c) => c.handle)),
    [channels],
  );
  // The normalized handle being added (matches Suggested/Search items). For Add URL the
  // raw input isn't a handle, so that tab keys off addChannel.isPending instead.
  const pendingHandle = addChannel.isPending ? (addChannel.variables ?? null) : null;

  const handleAdd = (handle: string) => {
    addChannel.mutate(handle, {
      onSuccess: (res) => {
        toast({
          variant: "success",
          title:
            res.status === "cached"
              ? `@${res.handle} is already up to date`
              : `Added @${res.handle}`,
        });
      },
      onError: (err) => {
        toast({
          variant: "error",
          title: err instanceof Error ? err.message : "Couldn't add this channel",
        });
      },
    });
  };

  // Await-able single add for the Add-URL bulk runner — resolves to a per-URL outcome
  // (never throws, never toasts; the bulk list shows progress inline).
  const addChannelAsync = useCallback(
    async (handle: string): Promise<AddChannelResultLite> => {
      try {
        const res = await addChannel.mutateAsync(handle);
        return { ok: true, handle: res.handle };
      } catch (err) {
        return {
          ok: false,
          handle,
          message: err instanceof Error ? err.message : "Couldn't add",
        };
      }
    },
    [addChannel],
  );

  const handleRemove = (id: string) => {
    setRemovingId(id);
    untrack.mutate(id, {
      onError: () => toast({ variant: "error", title: "Couldn't remove this channel" }),
      onSettled: () => setRemovingId(null),
    });
  };

  const handleRemoveAll = () => {
    if (channels.length === 0) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove all ${channels.length} channels from your watchlist?`)
    ) {
      return;
    }
    channels.forEach((c) => untrack.mutate(c.id));
  };

  const handleExport = () => {
    if (channels.length === 0 || typeof document === "undefined") return;
    const blob = new Blob([toCsv(channels)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <FeedViewTabs />
      <header className="mb-6 mt-5">
        <h1 className="text-2xl font-medium text-foreground">Channels</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Pick which channels to include in your Videos feed.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
        <AddChannelPanel
          trackedHandles={trackedHandles}
          pendingHandle={pendingHandle}
          isAdding={addChannel.isPending}
          onAdd={handleAdd}
          addChannelAsync={addChannelAsync}
        />
        <WatchlistPanel
          channels={channels}
          isLoading={isLoading}
          removingId={removingId}
          onRemove={handleRemove}
          onRemoveAll={handleRemoveAll}
          onExport={handleExport}
        />
      </div>
    </div>
  );
}
