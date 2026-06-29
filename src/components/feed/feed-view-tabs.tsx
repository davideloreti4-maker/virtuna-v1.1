"use client";

/**
 * FeedViewTabs — the Feed surface's view switcher (Discover Feed Phase 2.2).
 *
 * Two peer views: Videos (/feed) and Channels (/feed/channels). Mounted at the top of
 * both pages so Channels is a first-class destination, not just a "Customize channels"
 * detour. Matte pill segmented control; active state is white/[0.08] (no accent).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilmStrip, Television, Quotes } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/feed", label: "Videos", icon: FilmStrip, match: "exact" },
  { href: "/feed/channels", label: "Channels", icon: Television, match: "subtree" },
  { href: "/feed/hooks", label: "Hooks", icon: Quotes, match: "subtree" },
] as const;

export function FeedViewTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Feed views"
      className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-background-elevated p-1"
    >
      {TABS.map((t) => {
        // Videos = exact /feed; Channels + Hooks = their /feed/<x> subtree.
        const active = t.match === "exact" ? pathname === t.href : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
              active
                ? "bg-white/[0.08] text-foreground"
                : "text-foreground-secondary hover:bg-white/[0.03] hover:text-foreground",
            )}
          >
            <Icon size={15} weight={active ? "fill" : "regular"} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
