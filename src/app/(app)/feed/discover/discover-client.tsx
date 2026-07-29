"use client";

/**
 * DiscoverClient — the browsable Discover view (Phase 08, Plan 03, Task 3 — D-13/D-14/D-16).
 *
 * Owns input state, POSTs to /api/discover on submit, manages the
 * loading / error / empty / results states, and renders DiscoverGrid over the
 * DottedGrid surface. The tile "Remix → Read" CTA launches the discover→remix
 * chain by reading the endpoint from the CHAIN_HANDOFFS registry (no card edit) —
 * it POSTs the outlier's videoUrl to the remix rehost route, which persists a
 * remix-card to the open thread; the client then navigates to /home where the
 * thread rehydrates and renders it (the moat chain: Remix → Hooks → Script → Test).
 *
 * Mirrors the competitors page/client RSC-split pattern. NO save/watchlist/shelf
 * affordance — saving is P10; Discover is read-only + chain-launch.
 *
 * Moved from /discover to /feed/discover on 2026-07-29 and given the hub's chrome
 * (PageShell + SurfaceHeader + DiscoverTabBar), so it presents as the "Pull" tool tab
 * rather than a surface sitting beside the hub. /discover redirects here.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DottedGrid } from "@/components/app/dotted-grid";
import { DiscoverEntry } from "@/components/discover/discover-entry";
import { DiscoverGrid, type DiscoverGridState } from "@/components/discover/discover-grid";
import { PageShell, SurfaceHeader } from "@/components/surfaces/surface-header";
import { DiscoverTabBar } from "@/components/discover/discover-tab-bar";
import type { OutlierTileData } from "@/components/discover/outlier-tile";
import { classifyDiscoverInput } from "@/lib/discover/classify-input";
import { handoffsFor } from "@/lib/tools/chain-handoff";

// Default platform for the remix rehost launch (mirrors the composer default).
const DEFAULT_PLATFORM = "tiktok";

/** Raw tile shape returned by POST /api/discover (DiscoverResponseTile, JSON-serialized). */
interface DiscoverApiTile {
  platformVideoId: string;
  videoUrl: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  durationSeconds: number;
  postedAt: string;
  multiplier: number;
  baselineLabel: "vs own" | "vs niche";
  mode: "profile" | "niche";
  source: string;
}

interface DiscoverApiResponse {
  mode: "profile" | "niche";
  input: string;
  tiles: DiscoverApiTile[];
}

/** Map the route's raw source tag (`niche:x` / `profile:x`) into the UI-SPEC display label. */
function displaySource(tile: DiscoverApiTile, niche: string): string {
  if (tile.mode === "niche") return niche;
  // Profile mode (D-15): own-vs-competitor refinement is W3/W4; v1 tags the pull as Competitor.
  return "Competitor";
}

function toTileData(tile: DiscoverApiTile, niche: string): OutlierTileData {
  return {
    platformVideoId: tile.platformVideoId,
    videoUrl: tile.videoUrl,
    caption: tile.caption,
    views: tile.views,
    likes: tile.likes,
    comments: tile.comments,
    shares: tile.shares,
    saves: tile.saves,
    durationSeconds: tile.durationSeconds,
    postedAt: tile.postedAt,
    multiplier: tile.multiplier,
    baselineLabel: tile.baselineLabel,
    source: displaySource(tile, niche),
  };
}

export function DiscoverClient() {
  const router = useRouter();
  const [state, setState] = useState<DiscoverGridState>("idle");
  const [tiles, setTiles] = useState<OutlierTileData[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string>("source");
  const [lastInput, setLastInput] = useState<string | null>(null);
  const [remixPendingId, setRemixPendingId] = useState<string | null>(null);

  const runPull = useCallback(async (rawInput: string) => {
    setState("loading");
    setLastInput(rawInput);
    const { mode, normalized } = classifyDiscoverInput(rawInput);
    setSourceLabel(mode === "niche" ? "niche" : "handle");

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: rawInput }),
      });

      if (!res.ok) {
        setState("error");
        return;
      }

      const data = (await res.json()) as DiscoverApiResponse;
      const nicheLabel = mode === "niche" ? normalized : "";
      setTiles(data.tiles.map((t) => toTileData(t, nicheLabel)));
      setState("results");
    } catch {
      setState("error");
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastInput) void runPull(lastInput);
  }, [lastInput, runPull]);

  // Launch the discover→remix chain — endpoint read from the CHAIN_HANDOFFS registry
  // (no card-component edit needed; the registry is the SSOT for the chain shape).
  const handleRemix = useCallback(
    async (tile: OutlierTileData) => {
      const handoff = handoffsFor("discover").find((h) => h.to === "remix");
      if (!handoff?.endpoint) return;

      setRemixPendingId(tile.platformVideoId);
      try {
        // The OutlierTile's videoUrl IS the rehost anchor (anchorFrom: "card").
        // The remix route streams + persists a remix-card to the open thread.
        await fetch(handoff.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: tile.videoUrl, platform: DEFAULT_PLATFORM }),
        });
        // Drop into the thread chain — /home rehydrates the persisted remix-card.
        router.push("/home");
      } catch {
        setRemixPendingId(null);
      }
    },
    [router],
  );

  return (
    // Container + header mirror the hub's other tool tabs (title → mono subtitle → tabs) so the
    // tab bar doesn't move when you switch between Channels, Hooks and Pull.
    <PageShell>
      <div className="mb-4">
        <SurfaceHeader title="Pull" />
        <p className="mt-0.5 font-mono text-micro text-foreground-muted">
          pull outliers from any @handle or niche — ranked against their own baseline
        </p>

        <div className="mt-3">
          <DiscoverTabBar active="pull" />
        </div>
      </div>

      <div className="mb-6">
        <DiscoverEntry onSubmit={runPull} disabled={state === "loading"} />
      </div>

      {/* Tiles are a normal responsive grid laid OVER the DottedGrid surface (not pannable). */}
      <div className="relative min-h-[320px]">
        <DottedGrid />
        <div className="relative">
          <DiscoverGrid
            state={state}
            tiles={tiles}
            sourceLabel={sourceLabel}
            onRemix={handleRemix}
            remixPendingId={remixPendingId}
            onRetry={handleRetry}
          />
        </div>
      </div>
    </PageShell>
  );
}
