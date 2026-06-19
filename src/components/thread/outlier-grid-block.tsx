"use client";

/**
 * OutlierGridBlockRenderer — in-thread renderer for the `outlier-grid` block
 * (Phase 08, Plan 03 — D-13/D-14).
 *
 * The Discover grid is primarily its OWN browsable view (DiscoverClient), but the
 * typed-tile shape lets a pull also be referenced in-thread (UI-SPEC B2). This
 * renderer maps the validated OutlierGridBlock props onto the same DiscoverGrid
 * (results state) so the in-thread reference reuses the exact tile layout — no
 * model-generated UI (THREAD-04). No remix CTA wiring here: an in-thread reference
 * is a static record of what was pulled (the live chain-launch lives in the
 * Discover view itself).
 */

import { DiscoverGrid } from "@/components/discover/discover-grid";
import type { OutlierTileData } from "@/components/discover/outlier-tile";

interface OutlierGridBlock {
  type: "outlier-grid";
  props: {
    tiles: OutlierTileData[];
    mode: "profile" | "niche";
  };
}

export function OutlierGridBlockRenderer({ block }: { block: OutlierGridBlock }) {
  return (
    <DiscoverGrid
      state="results"
      tiles={block.props.tiles}
      sourceLabel={block.props.mode === "niche" ? "niche" : "handle"}
    />
  );
}
