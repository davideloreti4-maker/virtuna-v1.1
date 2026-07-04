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
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DottedGrid } from "@/components/app/dotted-grid";
import { DiscoverEntry } from "@/components/discover/discover-entry";
import { DiscoverGrid, type DiscoverGridState } from "@/components/discover/discover-grid";
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">Find what&apos;s already working</h1>
        {state === "idle" && (
          <p className="text-sm text-foreground-muted max-w-xl">
            Paste a creator&apos;s @handle or a niche to surface their outliers — the posts
            beating their own baseline. Then Remix the winner for your audience.
          </p>
        )}
      </div>

      <DiscoverEntry onSubmit={runPull} disabled={state === "loading"} />

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
    </div>
  );
}
