"use client";

/**
 * DiscoverTabBar — the single secondary nav for the whole /feed subtree (Unified hub bar).
 *
 * One bar, two groups separated by a divider:
 *   - Content tabs (Watching · Trending · Competitors) — the corpora of the Discover hub.
 *   - Tool tabs (Channels · Hooks · Pull) — the source-config, hook-vault and on-demand-pull
 *     sub-surfaces.
 *
 * The divider is the real distinction, not decoration: content tabs BROWSE `scraped_videos`,
 * a corpus already ingested, so they render on arrival. Tool tabs do something — Channels
 * configures which creators feed that corpus, Hooks is a vault, and Pull (/feed/discover)
 * fetches live from a handle or niche you don't track yet. "Pull" is the product's own verb
 * for it: the page's CTA reads Pull / Pulling…, and the route is the Discover pull route.
 *
 * Content tabs switch IN PLACE on /feed (pass `onSelectContent` → the hub's setter, no
 * navigation). On the sub-pages (/feed/channels, /feed/hooks, /feed/discover) there is no
 * in-page body for them, so `onSelectContent` is omitted and they render as links back to
 * /feed?tab=…. Tool tabs are always route links. Retires the old FeedViewTabs
 * (Videos/Channels/Hooks), which diverged from this bar and left Channels/Hooks unreachable
 * as tabs from the standard feed.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";

export type DiscoverBarTab =
  | "watching"
  | "trending"
  | "competitors"
  | "channels"
  | "hooks"
  | "pull";

export type DiscoverContentTab = "watching" | "trending" | "competitors";

const CONTENT_TABS: { id: DiscoverContentTab; label: string; href: string }[] = [
  { id: "watching", label: "Watching", href: "/feed" },
  { id: "trending", label: "Trending", href: "/feed?tab=trending" },
  { id: "competitors", label: "Competitors", href: "/feed?tab=competitors" },
];

const TOOL_TABS: { id: DiscoverBarTab; label: string; href: string }[] = [
  { id: "channels", label: "Channels", href: "/feed/channels" },
  { id: "hooks", label: "Hooks", href: "/feed/hooks" },
  { id: "pull", label: "Pull", href: "/feed/discover" },
];

const itemCls = (isActive: boolean) =>
  cn(
    "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
    isActive
      ? "bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)]"
      : "text-foreground-secondary hover:text-foreground",
  );

export function DiscoverTabBar({
  active,
  onSelectContent,
}: {
  active: DiscoverBarTab;
  /** When set (on /feed), content tabs switch in place instead of navigating. */
  onSelectContent?: (id: DiscoverContentTab) => void;
}) {
  return (
    // Six tabs are ~450px intrinsic — wider than a 390px viewport allows (it was already over
    // at five). The wrapper scrolls the pill instead of letting it overflow the page
    // (scrollbars are hidden app-wide).
    <div className="overflow-x-auto">
      <div
        className="inline-flex w-max items-center rounded-lg border border-border bg-surface-elevated p-0.5"
        role="tablist"
        aria-label="Discover sections"
      >
      {CONTENT_TABS.map((t) =>
        onSelectContent ? (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onSelectContent(t.id)}
            className={itemCls(active === t.id)}
          >
            {t.label}
          </button>
        ) : (
          <Link
            key={t.id}
            href={t.href}
            role="tab"
            aria-selected={active === t.id}
            className={itemCls(active === t.id)}
          >
            {t.label}
          </Link>
        ),
      )}

      <div className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />

      {TOOL_TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={active === t.id}
          className={itemCls(active === t.id)}
        >
          {t.label}
        </Link>
      ))}
      </div>
    </div>
  );
}
