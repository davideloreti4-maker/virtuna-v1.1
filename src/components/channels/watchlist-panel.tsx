"use client";

/**
 * WatchlistPanel — Discover Feed Phase 1.2.
 *
 * "Your Watchlist": the channels feeding the Watched tab. Each row shows avatar ·
 * followers · videos · views with a Remove affordance; the header carries Export (CSV)
 * and Remove all. Flat-warm matte (no glass, no coral) — Remove is a quiet muted icon.
 */
import { X, Television, DownloadSimple } from "@phosphor-icons/react";
import { PlatformAvatar } from "./platform-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/competitors-utils";
import type { ChannelWatchlistEntry } from "@/hooks/queries/use-channels";

interface WatchlistPanelProps {
  channels: ChannelWatchlistEntry[];
  isLoading: boolean;
  /** tracked_accounts.id currently being removed (row shows a dimmed/pending state). */
  removingId: string | null;
  onRemove: (id: string) => void;
  onRemoveAll: () => void;
  onExport: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/10";

function initialsOf(entry: ChannelWatchlistEntry): string {
  const base = entry.displayName ?? entry.handle;
  return base.slice(0, 2).toUpperCase();
}

export function WatchlistPanel({
  channels,
  isLoading,
  removingId,
  onRemove,
  onRemoveAll,
  onExport,
}: WatchlistPanelProps) {
  const count = channels.length;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-background-elevated p-5">
      {/* Header */}
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">Your Watchlist</h2>
        {count > 0 && (
          <span className="text-xs text-foreground-muted tabular-nums">{count}</span>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <ul className="flex flex-col gap-1">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      ) : count === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] text-foreground-muted">
            <Television size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No channels yet</p>
            <p className="text-xs text-foreground-muted">
              Add channels to build your Watched feed.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex max-h-[560px] flex-col overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
          {channels.map((c) => {
            const isRemoving = removingId === c.id;
            return (
              <li
                key={c.id}
                className={cn(
                  "group/row flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.02]",
                  isRemoving && "opacity-50",
                )}
              >
                <PlatformAvatar
                  src={c.avatarUrl ?? undefined}
                  fallback={initialsOf(c)}
                  platform={c.platform}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.displayName ?? `@${c.handle}`}
                  </p>
                  <p className="truncate text-xs tabular-nums text-foreground-muted">
                    {/* followerCount is null until the first snapshot lands — say that
                        instead of rendering "-- followers · 0 views" dashes. */}
                    {c.followerCount != null ? (
                      <>
                        {formatCount(c.followerCount)} followers · {formatCount(c.totalViews)} views
                      </>
                    ) : c.totalViews > 0 ? (
                      <>{formatCount(c.totalViews)} views</>
                    ) : (
                      <>first snapshot pending</>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
                  disabled={isRemoving}
                  aria-label={`Remove @${c.handle}`}
                  className={cn(
                    "shrink-0 rounded-lg p-1.5 text-foreground-muted opacity-0 transition-opacity",
                    "hover:bg-white/[0.06] hover:text-foreground",
                    "group-hover/row:opacity-100 focus-visible:opacity-100 disabled:opacity-100",
                    focusRing,
                  )}
                >
                  <X size={15} weight="bold" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {count > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={onRemoveAll}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium",
              "text-foreground-muted hover:bg-white/[0.04] hover:text-foreground transition-colors",
              focusRing,
            )}
          >
            Remove all
          </button>
          <button
            type="button"
            onClick={onExport}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
              "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground transition-colors",
              focusRing,
            )}
          >
            <DownloadSimple size={15} />
            Export
          </button>
        </div>
      )}
    </section>
  );
}
