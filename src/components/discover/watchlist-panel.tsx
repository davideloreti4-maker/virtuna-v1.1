"use client";

/**
 * WatchlistPanel — creators and competitors as ONE list.
 *
 * Channels and Competitors were the same idea stored twice, on two tabs, with two add-flows
 * and two video stores; the same person appeared as `chrisbumstead` in one and `cbum` in the
 * other. The merge happens in lib/discover/watchlist-reads.ts; this renders the result and
 * keeps the deep pages (/competitors/[handle]) reachable from a row.
 *
 * A profile whose scrape failed with nothing salvageable renders as held, not as
 * "elmakbtn915 · 0 followers" with a blank avatar — which is what the old Channels tab did.
 */

import Link from "next/link";
import { CaretRight, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CoverFill } from "@/components/primitives/CoverFill";
import { formatCount } from "@/lib/competitors-utils";
import type { LatestSourcePost, WatchlistSource } from "@/lib/discover/watchlist-reads";
import { Chip, fmtAge, fmtMultiplier, fmtViews } from "./discover-primitives";

export function WatchlistPanel({
  sources,
  latest,
  query,
}: {
  sources: WatchlistSource[];
  latest: LatestSourcePost[];
  query: string;
}) {
  const q = query.trim().toLowerCase();
  const list = sources.filter(
    (s) => !q || s.handle.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  );

  return (
    <div>
      {latest.length > 0 && !q ? (
        <section className="mb-7">
          <div className="mb-3 flex items-baseline gap-3">
            <h3 className="text-body font-semibold text-foreground">Latest from your sources</h3>
            <p className="text-caption text-foreground-muted">recent posts, not yet measured</p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {latest.map((post) => (
              <article
                key={post.id}
                className="w-[132px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface-elevated"
              >
                <div className="relative h-[118px] overflow-hidden bg-surface-sunken">
                  <CoverFill coverUrl={post.coverUrl} playSize={16} />
                </div>
                <div className="p-2">
                  <p className="line-clamp-2 text-caption text-foreground-secondary">
                    {post.caption}
                  </p>
                  <p className="mt-1.5 truncate text-micro tabular-nums text-foreground-muted">
                    @{post.handle} · {fmtViews(post.views)}
                    {fmtAge(post.postedAt) ? ` · ${fmtAge(post.postedAt)}` : ""}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-2">
        {list.map((source) => (
          <SourceRow key={source.key} source={source} />
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-label text-foreground-muted">
          {q ? "No source matches that." : "You're not watching anyone yet."}
        </p>
      ) : null}

      {/* One list to READ, two doors to WRITE — because the two halves store different
          things: a tracked creator's posts land in the feed with a measured multiplier, a
          competitor's carry follower history and the head-to-head compare. */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3">
        <p className="min-w-[220px] flex-1 text-label text-foreground-muted">
          Track a creator and their outliers join the feed. Track a competitor to also capture
          follower history and comparisons.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/competitors"
            className="rounded-lg border border-border px-3 py-1.5 text-label font-semibold text-foreground-secondary transition-colors hover:border-border-hover hover:text-foreground"
          >
            Competitors
          </Link>
          <Link
            href="/feed/channels"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-action)] px-3 py-1.5 text-label font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90"
          >
            <Plus size={13} weight="bold" /> Add a creator
          </Link>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ source }: { source: WatchlistSource }) {
  const meta = source.held
    ? "Scrape failed — held back until a clean read"
    : [
        source.followerCount ? `${formatCount(source.followerCount)} followers` : null,
        source.videosHeld > 0
          ? `${source.videosHeld} recent post${source.videosHeld === 1 ? "" : "s"}${
              fmtAge(source.newestPostAt) ? ` · newest ${fmtAge(source.newestPostAt)}` : ""
            }`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

  const body = (
    <>
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
        {source.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar, not a static asset
          <img
            src={source.avatarUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-label font-semibold text-foreground-muted">
            {source.handle.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-body font-semibold text-foreground">{source.name}</p>
          <span className="shrink-0 text-caption text-foreground-muted">@{source.handle}</span>
          {source.mergedFrom ? (
            <Chip title="Tracked twice under two spellings — merged into one source">
              merged @{source.mergedFrom}
            </Chip>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-caption text-foreground-muted">{meta}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {source.held ? (
          <span className="text-caption text-foreground-muted">re-scrape queued</span>
        ) : source.outlierCount > 0 ? (
          <Chip tone="proven">
            {source.outlierCount} outliers
            {source.bestMultiplier ? ` · best ${fmtMultiplier(source.bestMultiplier)}` : ""}
          </Chip>
        ) : (
          <span className="text-caption text-foreground-muted">no measured outliers yet</span>
        )}
        {/* Only where the row actually goes somewhere — a chevron on a held row promises a
            page that isn't there. */}
        {source.profileHandle && !source.held ? (
          <CaretRight size={13} className="text-foreground-muted" />
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "flex items-center gap-3.5 rounded-xl border border-border bg-surface-elevated p-3 transition-colors",
    source.held ? "opacity-60" : "hover:border-border-hover",
  );

  // Only a competitor-backed row has a deep page; a bare tracked handle has nowhere to go yet.
  return source.profileHandle && !source.held ? (
    <Link href={`/competitors/${source.profileHandle}`} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
