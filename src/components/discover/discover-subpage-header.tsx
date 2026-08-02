"use client";

/**
 * DiscoverSubpageHeader — the header for the two pages that hang off the Discover hub
 * (Pull and Channels) now that neither is a tab.
 *
 * They used to re-render the hub's six-tab bar under a mono subtitle the hub itself did not
 * have, which pushed the bar 16px down and changed the h1 from "Discover" to "Pull" /
 * "Channels" on every crossing — while three source comments claimed the mirroring existed
 * "so the tab bar doesn't jump position". A page reached from an action is not a tab, so it
 * gets a way back instead of a copy of the nav.
 */

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { SurfaceHeader } from "@/components/surfaces/surface-header";

export function DiscoverSubpageHeader({
  title,
  subtitle,
  backHref = "/feed",
  backLabel = "Discover",
}: {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-5">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 text-label text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft size={13} weight="bold" /> {backLabel}
      </Link>
      <SurfaceHeader title={title} subtitle={subtitle} />
    </div>
  );
}
