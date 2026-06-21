/**
 * Phase 10 Plan 01 — REALIZED signature derivation (FLYWHEEL-01/03).
 *
 * Pure, deterministic. Maps real post engagement metrics onto the same 6-disposition
 * vector the predicted signature uses, so reconcile() compares like-with-like (D-02).
 *
 * Honesty spine (Pitfall 3): a channel with no signal is EXCLUDED, never zero-filled.
 * Absent ≠ zero. saves/shares/comments are public on TikTok-via-apidojo; retention and
 * link-clicks are creator-supplied. A missing channel = "unknown" and is dropped from
 * the vector entirely; normalization happens ACROSS PRESENT CHANNELS ONLY.
 *
 * Determinism guarantee: no Date.now, no Math.random, no I/O. Same metrics → identical
 * output. Per-channel provenance ("public_scrape" | "creator_supplied") is preserved so
 * the UI can be honest about which signals are scraped vs. self-reported.
 *
 * Disposition → engagement-proxy mapping (10-RESEARCH.md §1, [VERIFIED: persona-registry]):
 *   collector  ← saves              (save rate)
 *   connector  ← shares (primary) + comments (secondary)  → averaged per-view rate
 *   converter  ← link_clicks        (creator-supplied)
 *   scanner    ← watch_through_pct  (utility completion)
 *   lurker     ← watch_through_pct  (high watch-through, near-zero overt engagement)
 *   skeptic    ← (early drop-off inverse — not derivable from these aggregate channels;
 *                 excluded here, surfaced via craft-side retention curves in a later plan)
 *
 * [ASSUMED] A1 (single highest-value owner-confirm — see reconcile.ts):
 *   collector / connector / converter = the "WHO" dispositions  → CALIBRATION signal.
 *   scanner / lurker / skeptic        = the "HOW-WELL" dispositions → CRAFT signal.
 *   The classifier in reconcile.ts owns that split; this module only derives shares.
 */

import type { Disposition } from "@/lib/audience/audience-types";

/** Provenance of a realized signal — honest about scraped vs. self-reported. */
export type MetricSource = "public_scrape" | "creator_supplied";

/** A single realized channel: a raw value plus where it came from, or null if absent. */
export type MetricChannel = { value: number; source: MetricSource } | null;

/**
 * Raw realized metrics for one post. `views` is the denominator for per-view rates;
 * each behavioural channel is present-or-absent (null = unknown, excluded — Pitfall 3).
 */
export interface RealizedMetrics {
  /** Denominator for per-view rates. null/0 → empty vector (no division). */
  views: number | null;
  /** collector channel — public on TikTok (apidojo `bookmarks`), else creator-supplied. */
  saves: MetricChannel;
  /** connector primary channel — public. */
  shares: MetricChannel;
  /** connector secondary channel — public. */
  comments: MetricChannel;
  /** scanner + lurker channel — creator-supplied retention. */
  watch_through_pct: MetricChannel;
  /** converter channel — creator-supplied. */
  link_clicks: MetricChannel;
}

/** Output: a partial vector (present channels only) plus parallel per-disposition provenance. */
export interface RealizedSignature {
  vector: Partial<Record<Disposition, number>>;
  provenance: Partial<Record<Disposition, MetricSource>>;
}

/**
 * Derive the realized disposition signature from real post metrics.
 *
 * Steps:
 *  1. Guard views — null or <= 0 → return empty (no division by zero).
 *  2. For each PRESENT channel, compute a per-view rate and assign it to its disposition(s):
 *       - connector = average of (shares/views) and (comments/views) over the present ones.
 *       - watch_through feeds BOTH scanner and lurker (same retention signal, two readings).
 *  3. Drop every absent channel (never zero-fill).
 *  4. Normalize ACROSS PRESENT dispositions only, so the shares sum to 1.0.
 *
 * Pure + deterministic.
 */
export function realizedSignature(metrics: RealizedMetrics): RealizedSignature {
  const views = metrics.views;
  if (views == null || views <= 0) {
    return { vector: {}, provenance: {} };
  }

  // Per-disposition raw rate + provenance, before normalization.
  const rate: Partial<Record<Disposition, number>> = {};
  const provenance: Partial<Record<Disposition, MetricSource>> = {};

  // collector ← saves
  if (metrics.saves) {
    rate.collector = metrics.saves.value / views;
    provenance.collector = metrics.saves.source;
  }

  // connector ← shares (primary) + comments (secondary), averaged over present channels
  const connectorParts: number[] = [];
  let connectorSource: MetricSource | undefined;
  if (metrics.shares) {
    connectorParts.push(metrics.shares.value / views);
    connectorSource = metrics.shares.source;
  }
  if (metrics.comments) {
    connectorParts.push(metrics.comments.value / views);
    // shares provenance wins if present; otherwise comments provenance.
    connectorSource ??= metrics.comments.source;
  }
  if (connectorParts.length > 0) {
    rate.connector =
      connectorParts.reduce((a, b) => a + b, 0) / connectorParts.length;
    provenance.connector = connectorSource;
  }

  // converter ← link_clicks
  if (metrics.link_clicks) {
    rate.converter = metrics.link_clicks.value / views;
    provenance.converter = metrics.link_clicks.source;
  }

  // scanner + lurker ← watch_through_pct (a percentage 0..100; normalize to a 0..1 rate)
  if (metrics.watch_through_pct) {
    const r = metrics.watch_through_pct.value / 100;
    rate.scanner = r;
    rate.lurker = r;
    provenance.scanner = metrics.watch_through_pct.source;
    provenance.lurker = metrics.watch_through_pct.source;
  }

  // Normalize across PRESENT channels only.
  const present = Object.keys(rate) as Disposition[];
  const total = present.reduce((a, d) => a + (rate[d] ?? 0), 0);

  const vector: Partial<Record<Disposition, number>> = {};
  if (total > 0) {
    for (const d of present) {
      vector[d] = (rate[d] ?? 0) / total;
    }
  } else {
    // Present channels but all-zero rates (e.g. saves:0) — keep them as 0 shares, honest
    // that the channel WAS present (provenance retained) but carried no signal.
    for (const d of present) vector[d] = 0;
  }

  return { vector, provenance };
}
