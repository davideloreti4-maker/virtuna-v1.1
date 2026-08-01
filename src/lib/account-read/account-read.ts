/**
 * Phase 10 Plan 05 — Account Read pattern extraction + thin gate (SELF-01/02/03).
 *
 * "A Read on your own account" — the know-thyself companion to Discover's
 * know-thy-competitor. Scrapes the creator's OWN history (scrapeProfile +
 * scrapeVideos, apidojo multi-post — NOT single-URL) ∪ analysis/history → recurring
 * hook openings, format mix, drop-points, working-vs-fix → renders via the fixed
 * `reading/` components (account-read-block, Task 2).
 *
 * Honesty spine (SELF-02, carries P7 D-06 verbatim from calibration.ts):
 *   - Thin gate: getFollowerTier === null AND videos < THIN_MIN_VIDEOS → { fallback: 'thin' }.
 *     NEVER fabricates account patterns on a thin account.
 *   - Scrape failure → { error: 'scrape_failed' } — distinct from the thin fallback,
 *     mirroring calibration.ts's two-way discrimination.
 *
 * Flywheel sourcing (D-03b — read-only, the model is NEVER mutated):
 *   - "fix" guidance derives from CRAFT-disposition divergences in `reconciliations`
 *     (scanner/lurker/skeptic per the LOCKED A1 split). Calibration dispositions
 *     (collector/connector/converter) are the WHO — they feed the audience object,
 *     NOT the craft-fix list, so a content flop never corrupts the model (D-03).
 *   - Accuracy track record (SELF-03): "within X% on your last N" computed from the
 *     craft-error magnitude trend; only returned when N ≥ TRACK_RECORD_MIN_ROWS rows exist.
 *
 * Deterministic: pattern extraction is pure over (profile, videos, reconciliations) —
 * no Date.now / Math.random / I/O. Any optional LLM pattern-naming step would use the
 * existing Qwen path (no Gemini/DeepSeek) — v1 ships the deterministic extractor.
 *
 * Exports: THIN_MIN_VIDEOS, TRACK_RECORD_MIN_ROWS, generateAccountRead, and the result types.
 */

import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import type { ProfileData, VideoData } from "@/lib/scraping/types";
import { getFollowerTier } from "@/lib/engine/corpus/follower-tier";
import { CRAFT_DISPOSITIONS } from "@/lib/flywheel/reconcile";
import type { Reconciliation } from "@/lib/flywheel/reconciliation-repo";
import type { Disposition } from "@/lib/audience/audience-types";
import {
  buildFrameEvidence,
  buildProfileEvidence,
  type RunEvidence,
} from "@/lib/tools/evidence";
import { formatCount } from "@/lib/account-metrics/account-metrics";
import { ACCOUNT_READ_PLAN } from "@/lib/account-read/account-read-stages";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Minimum scraped videos required to read an account honestly. Reuses the P7
 * calibration constant exactly (calibration.ts THIN_MIN_VIDEOS = 10) so the thin
 * gate is identical across calibration and Account Read (SELF-02 / D-06).
 */
export const THIN_MIN_VIDEOS = 10;

/**
 * Minimum reconciliation rows before an accuracy track record is shown (SELF-03).
 * Below this, the card shows the "not enough posted outcomes yet" empty copy — a
 * track record built on a handful of posts would be noise, not a trust signal.
 */
export const TRACK_RECORD_MIN_ROWS = 3;

/** Number of top recurring hook openings to surface. */
const TOP_HOOKS = 3;
/** A short-form video is ≤ this many seconds (the format-mix split point). */
const SHORT_FORM_MAX_SECONDS = 30;

// ─── Result types ────────────────────────────────────────────────────────────

/** The accuracy track record — "within {withinPct}% on your last {lastN} posts". */
export interface TrackRecord {
  withinPct: number;
  lastN: number;
}

/** A single format-mix bucket (e.g. "Short-form (≤30s)" · 18 posts · 60%). */
export interface FormatMixEntry {
  label: string;
  count: number;
  pct: number;
}

/**
 * Profile header for the Account Read card — the REAL scraped identity (avatar, name,
 * verified, follower/post counts). Surfaced from ProfileData so the card opens with the
 * creator's own face, not just a handle string (Tier C scrape-data slice).
 */
export interface AccountReadProfile {
  handle: string;
  displayName: string;
  avatarUrl: string;
  verified: boolean;
  followerCount: number;
  videoCount: number;
}

/**
 * One analyzed post surfaced as a cover thumbnail (the REAL scrape media the Read was
 * built from). `coverUrl` is an ephemeral TikTok-CDN image (display-only; the renderer
 * degrades to a placeholder tile when absent/expired).
 */
export interface AnalyzedVideo {
  coverUrl?: string;
  views: number;
  caption: string;
  videoUrl: string;
}

/** The extracted account patterns (SELF-01). */
export interface AccountReadPatterns {
  /** Recurring hook openings detected across captions (e.g. "How I…", "Why your…"). */
  recurringHooks: string[];
  /** Format mix breakdown (short vs long form, ranked). */
  formatMix: FormatMixEntry[];
  /** Drop-point notes (where retention falls) — honest, may be empty. */
  dropPoints: string[];
  /** What's working — the top-performing patterns. */
  working: string[];
  /** What to fix — CRAFT-disposition divergences from reconciliations (D-03b). */
  fix: string[];
}

/** Successful Account Read — patterns + an optional track record (null below threshold). */
export interface AccountReadSuccess {
  handle: string;
  followerTier: string | null;
  videoCount: number;
  /** Real scraped profile header (avatar / display name / verified / counts). */
  profile: AccountReadProfile;
  /** The top analyzed posts as cover thumbnails — the real media behind the Read. */
  analyzedVideos: AnalyzedVideo[];
  patterns: AccountReadPatterns;
  trackRecord: TrackRecord | null;
}

/** Thin fallback — scrape succeeded but history too sparse to read honestly (SELF-02). */
export interface AccountReadThin {
  fallback: "thin";
}

/** Scrape error — network/actor failure. Distinct from the thin fallback. */
export interface AccountReadError {
  error: "scrape_failed";
  message?: string;
}

export type AccountReadResult =
  | AccountReadSuccess
  | AccountReadThin
  | AccountReadError;

/**
 * Pre-fetched dependencies the route resolves before calling generateAccountRead.
 * Kept as plain data (not a SupabaseClient) so the extractor stays pure + testable.
 */
export interface AccountReadDeps {
  /** Craft-error + accuracy source rows (FLYWHEEL, Plan 02). */
  reconciliations: Reconciliation[];
  /** The creator's prior Reads (analysis/history) — reserved for working/drop-point enrichment. */
  analysisHistory?: unknown[];
  /**
   * The artifacts this read actually pulled, emitted the moment each half of the scrape lands —
   * the profile (avatar + follower count) and then the posts (covers). Both were already in hand
   * ~30s before `done`; they just had nowhere to go. Optional: absent ⇒ nothing is emitted and
   * behaviour is byte-identical.
   */
  onEvidence?: (evidence: RunEvidence) => void;
  /** Real phase boundaries for the loading spine. Optional, same as onEvidence. */
  onStage?: (name: string, status: 'active' | 'done') => void;
}

/** Re-exported so server callers keep one import; the names live in a client-safe module. */
export { ACCOUNT_READ_PLAN } from "@/lib/account-read/account-read-stages";

/**
 * The scraped account as rail evidence. Every string comes off the scraped row: the follower
 * count is only claimed when the scrape actually returned one (0 is TikTok's "unknown" here as
 * much as it is a real zero, and "0 followers" under someone's own avatar would be a lie about
 * their account).
 */
function buildProfileFrame(p: ProfileData): RunEvidence | null {
  const followers = p.followerCount > 0 ? `${formatCount(p.followerCount)} followers` : null;
  return buildProfileEvidence("Reading your account", {
    handle: p.handle,
    image: p.avatarUrl,
    metric: followers,
  });
}

/**
 * The creator's own posts as a filmstrip. `slots` is what we ASKED for (30, capped by the strip's
 * own maximum) so the strip is drawn at full width and fills, rather than growing and reflowing.
 */
/**
 * Emit rail evidence, and NEVER let it break the read.
 *
 * The account read costs the creator 5 credits and runs two real Apify scrapes. Evidence is
 * decoration on top of that: a thrown builder — a null row, an unexpected shape, anything inside
 * formatCount — would otherwise reject the chained promise, fail the Promise.all, and hand back
 * `scrape_failed` for a scrape that actually SUCCEEDED. Paying for work that completed and being
 * told it failed is the worst outcome available here, and a thumbnail is not worth it.
 */
function emitEvidenceSafely(deps: AccountReadDeps, build: () => RunEvidence | null): void {
  if (!deps.onEvidence) return;
  try {
    const evidence = build();
    if (evidence) deps.onEvidence(evidence);
  } catch {
    /* the READ is what was paid for — a missing rail is not a failure */
  }
}

/** Name the plan row a payload belongs to, so a concurrent run's rail cannot land on the wrong one. */
function withStep(evidence: RunEvidence | null, step: string): RunEvidence | null {
  return evidence ? { ...evidence, step } : null;
}

function buildAccountPostFrames(videos: VideoData[]): RunEvidence | null {
  // The count is a claim about the READ, not about the strip. `buildFrameEvidence` passes back the
  // number of tiles it will actually draw — capped at MAX_EVIDENCE_ITEMS — so using it announced
  // "Reading 8 of your posts" on a read that had just analyzed 30, contradicting the card that
  // replaces it seconds later. The strip stays a sample of the history; the sentence reports the
  // work, which is also what makes the strip legible as a sample rather than the whole set.
  const scraped = videos.length;
  return buildFrameEvidence(
    () => (scraped === 1 ? "Reading 1 of your posts" : `Reading ${scraped} of your posts`),
    videos.map((v) => v.coverUrl ?? null),
    scraped,
  );
}

/** Minimal scraping surface — injectable for tests (mirrors calibration.ts). */
export interface AccountScrapeProvider {
  scrapeProfile(handle: string): Promise<ProfileData>;
  scrapeVideos(handle: string, limit?: number): Promise<VideoData[]>;
}

// ─── Deterministic extractors ────────────────────────────────────────────────

/**
 * Detect recurring hook OPENINGS from captions. Deterministic: groups by the first
 * 2-word lowercased prefix, ranks by frequency, returns the top openings verbatim-cased.
 * Honest — returns [] when nothing recurs (never a fabricated pattern).
 */
function extractRecurringHooks(videos: VideoData[]): string[] {
  const groups = new Map<string, { display: string; count: number; firstIdx: number }>();

  videos.forEach((v, idx) => {
    const caption = v.caption?.trim();
    if (!caption) return;
    const words = caption.split(/\s+/);
    if (words.length < 2) return;
    const key = `${words[0]} ${words[1]}`.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { display: `${words[0]} ${words[1]}`, count: 1, firstIdx: idx });
    }
  });

  return [...groups.values()]
    .filter((g) => g.count > 1) // only RECURRING openings
    .sort((a, b) => b.count - a.count || a.firstIdx - b.firstIdx) // freq desc, stable
    .slice(0, TOP_HOOKS)
    .map((g) => `"${g.display}…" (${g.count} posts)`);
}

/** Format mix: split short vs long form by duration. Deterministic; ranked by count. */
function extractFormatMix(videos: VideoData[]): FormatMixEntry[] {
  const total = videos.length;
  if (total === 0) return [];

  let short = 0;
  for (const v of videos) {
    if (v.durationSeconds <= SHORT_FORM_MAX_SECONDS) short += 1;
  }
  const long = total - short;

  const entries: FormatMixEntry[] = [
    { label: `Short-form (≤${SHORT_FORM_MAX_SECONDS}s)`, count: short, pct: Math.round((short / total) * 100) },
    { label: `Long-form (>${SHORT_FORM_MAX_SECONDS}s)`, count: long, pct: Math.round((long / total) * 100) },
  ];

  return entries
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * "What's working" — the top-performing posts' shapes. Deterministic: ranks videos by
 * views, names the top 2 by their hook + duration bucket. Honest — never fabricated.
 */
function extractWorking(videos: VideoData[]): string[] {
  if (videos.length === 0) return [];
  const ranked = [...videos].sort(
    (a, b) => b.views - a.views || a.platformVideoId.localeCompare(b.platformVideoId),
  );
  return ranked.slice(0, 2).map((v) => {
    const bucket = v.durationSeconds <= SHORT_FORM_MAX_SECONDS ? "short-form" : "long-form";
    const hook = v.caption?.split(/\s+/).slice(0, 5).join(" ") ?? "(no caption)";
    return `${bucket}: "${hook}…" — ${v.views.toLocaleString()} views`;
  });
}

/**
 * "What to fix" — CRAFT-disposition divergences from reconciliations (D-03b).
 *
 * Read-only: aggregates the divergence magnitude per CRAFT disposition
 * (scanner/lurker/skeptic per A1) across all rows, ranks worst-first, and names the
 * top craft gaps. CALIBRATION dispositions (collector/connector/converter) are the
 * WHO — they feed the audience object, NEVER this craft-fix list (D-03 protection).
 * The model is never mutated. Honest — returns [] when no craft divergence exists.
 */
function extractFix(reconciliations: Reconciliation[]): string[] {
  const craftSet = new Set<Disposition>(CRAFT_DISPOSITIONS);
  const magnitude = new Map<Disposition, number>();

  for (const rec of reconciliations) {
    for (const [dispRaw, klass] of Object.entries(rec.classification)) {
      const disp = dispRaw as Disposition;
      // Defense-in-depth: only craft-classified AND in the craft set (never a leak).
      if (klass !== "craft" || !craftSet.has(disp)) continue;
      const div = rec.divergence_vector[disp];
      if (div == null) continue;
      magnitude.set(disp, (magnitude.get(disp) ?? 0) + Math.abs(div));
    }
  }

  const CRAFT_GUIDANCE: Record<string, string> = {
    scanner: "scanner: hooks aren't surviving the first beat — sharpen your openers",
    lurker: "lurker: retention drops mid-video — tighten the middle and cut dead air",
    skeptic: "skeptic: viewers aren't convinced — add proof/specifics earlier",
  };

  return [...magnitude.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([disp]) => CRAFT_GUIDANCE[disp] ?? `${disp}: craft gap detected`);
}

/**
 * The analyzed-post cover strip — the REAL scrape media behind the Read. Deterministic:
 * ranks by views (so the strip leads with the creator's top performers), takes the top N,
 * and carries each cover URL + views + caption for the card's thumbnail row. Honest —
 * returns [] when there are no videos; omits coverUrl when the scrape didn't surface one.
 */
function extractAnalyzedVideos(videos: VideoData[]): AnalyzedVideo[] {
  // Show EVERY scraped post, not a top-N slice — the card's strip is the visible proof of how
  // much history the Read is grounded in (the whole scrape, capped upstream at scrapeVideos(…, 30)).
  // Still ordered by views desc so the strongest performers lead the filmstrip.
  return [...videos]
    .sort((a, b) => b.views - a.views || a.platformVideoId.localeCompare(b.platformVideoId))
    .map((v) => ({
      ...(v.coverUrl ? { coverUrl: v.coverUrl } : {}),
      views: v.views,
      caption: v.caption ?? "",
      videoUrl: v.videoUrl,
    }));
}

/**
 * Accuracy track record (SELF-03). Computed from the craft-error magnitude trend in
 * reconciliations: "within X% on your last N posts". Only returned when at least
 * TRACK_RECORD_MIN_ROWS rows exist — otherwise null (the card shows the empty copy).
 *
 * withinPct = 100 − (mean absolute divergence across the last N rows × 100), clamped
 * to [0, 100]. A small mean divergence → a high "within %" (the model tracked well).
 */
function computeTrackRecord(reconciliations: Reconciliation[]): TrackRecord | null {
  if (reconciliations.length < TRACK_RECORD_MIN_ROWS) return null;

  // reconciliations arrive newest-first (listReconciliations order); take the last N posted.
  const lastN = reconciliations.slice(0, TRACK_RECORD_MIN_ROWS);

  let totalAbs = 0;
  let count = 0;
  for (const rec of lastN) {
    for (const div of Object.values(rec.divergence_vector)) {
      if (div == null) continue;
      totalAbs += Math.abs(div);
      count += 1;
    }
  }

  const meanAbs = count > 0 ? totalAbs / count : 0;
  const withinPct = Math.max(0, Math.min(100, Math.round((1 - meanAbs) * 100)));

  return { withinPct, lastN: lastN.length };
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Generate a Read on the creator's own account (SELF-01/02/03).
 *
 * 1. Scrape own profile + videos (apidojo multi-post). Failure → { error }.
 * 2. Thin gate (P7 D-06 verbatim): getFollowerTier === null AND videos < THIN_MIN_VIDEOS
 *    → { fallback: 'thin' }. NEVER fabricate patterns.
 * 3. Deterministic pattern extraction (recurringHooks / formatMix / dropPoints / working).
 * 4. "fix" from CRAFT-disposition reconciliation rows (D-03b) — read-only, model untouched.
 * 5. Accuracy track record from the reconciliation trend (SELF-03) — null below threshold.
 *
 * Never throws — all failure paths are typed returns.
 *
 * @param handle   the creator's OWN handle (resolved from the authed user, not arbitrary input — T-10-12)
 * @param _userId  the authenticated user id (reserved for future per-user enrichment)
 * @param deps     pre-fetched reconciliations + analysis history
 * @param _provider optional scrape provider (test injection point)
 */
export async function generateAccountRead(
  handle: string,
  _userId: string,
  deps: AccountReadDeps,
  _provider?: AccountScrapeProvider,
): Promise<AccountReadResult> {
  const provider = _provider ?? new ApifyScrapingProvider();

  let profile: ProfileData;
  let videos: VideoData[];

  // ── Scrape own account (parallel — independent Apify runs) ──────────────────
  // Still parallel and still one await: the two halves are chained INDIVIDUALLY so each can
  // report the moment it lands, then awaited together exactly as before. This is the whole of
  // fix 4a — the avatar, the follower count and 30 covers were already in hand ~30s before
  // `done`, sitting behind a single static "Reading your account…" line.
  try {
    // Both scrapes are dispatched together, so both rows light together. Chaining row 2's
    // transitions to the PROFILE promise encoded an assumption — "the profile lands first" — that
    // the first live billed run disproved: the 30-post pull came back at 19.1s and the profile at
    // 37.2s. Row 2 therefore went active and done in the SAME tick, so the row whose work actually
    // took the time never rendered as in-progress at all, and its covers were drawn under row 1.
    //
    // Each row now reports ITS OWN scrape. Two rows are live at once because two scrapes really
    // are, and whichever wins is shown winning.
    deps.onStage?.(ACCOUNT_READ_PLAN[0]!, 'active');
    deps.onStage?.(ACCOUNT_READ_PLAN[1]!, 'active');

    const profileP = provider.scrapeProfile(handle).then((p) => {
      // The phase boundary is a fact about the PIPELINE and must not depend on whether there is
      // something pretty to show: an account with no avatar and no handle produces no evidence,
      // and gating the transition on it left the spine stuck on step 1 for the whole run.
      deps.onStage?.(ACCOUNT_READ_PLAN[0]!, 'done');
      // The FIRST producer of kind:'profile' — the rail has always supported the avatar disc and
      // nothing emitted one until now. Tagged with its row: with two rows live, "hangs off the
      // active row" would put it on whichever is first in the plan rather than the one it is of.
      emitEvidenceSafely(deps, () => withStep(buildProfileFrame(p), ACCOUNT_READ_PLAN[0]!));
      return p;
    });

    const videosP = provider.scrapeVideos(handle, 30).then((v) => {
      deps.onStage?.(ACCOUNT_READ_PLAN[1]!, 'done');
      emitEvidenceSafely(deps, () => withStep(buildAccountPostFrames(v), ACCOUNT_READ_PLAN[1]!));
      return v;
    });

    [profile, videos] = await Promise.all([profileP, videosP]);
  } catch (err) {
    // Scrape failure is distinct from thin-data (P7 D-06 / UI-SPEC).
    return {
      error: "scrape_failed",
      message: err instanceof Error ? err.message : "scrape failed",
    };
  }

  // ── Thin gate (SELF-02 / D-06) — both conditions required, P7 rule verbatim ──
  const tier = getFollowerTier(profile.followerCount);
  if (tier === null && videos.length < THIN_MIN_VIDEOS) {
    // Honest fallback — NEVER fabricate patterns.
    return { fallback: "thin" };
  }

  // ── Deterministic pattern extraction (SELF-01) ──────────────────────────────
  const patterns: AccountReadPatterns = {
    recurringHooks: extractRecurringHooks(videos),
    formatMix: extractFormatMix(videos),
    dropPoints: [], // populated from analysis/history retention data when available (honest empty)
    working: extractWorking(videos),
    fix: extractFix(deps.reconciliations),
  };

  // ── Accuracy track record (SELF-03) — null below the row threshold ──────────
  const trackRecord = computeTrackRecord(deps.reconciliations);

  return {
    handle: profile.handle || handle,
    followerTier: tier,
    videoCount: videos.length,
    // Real scrape header — the card opens with the creator's own face + counts, not a
    // bare handle. videoCount here is the ACCOUNT total (authorMeta), not the scraped slice.
    profile: {
      handle: profile.handle || handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      verified: profile.verified,
      followerCount: profile.followerCount,
      videoCount: profile.videoCount,
    },
    // Real media behind the Read — top performers as cover thumbnails (display-only).
    analyzedVideos: extractAnalyzedVideos(videos),
    patterns,
    trackRecord,
  };
}
