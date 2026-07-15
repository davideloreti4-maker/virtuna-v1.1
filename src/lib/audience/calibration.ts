/**
 * §P BUILD step 4 — Calibration pipeline (real AudienceSignature).
 *
 * Turns a handle (Personal) or description/reference (Target) into a persisted, REAL
 * audience: ONE `tiktok-profile-scraper` bundle → omni-flash enrichment → frozen
 * `AudienceSignature` on the row (§P.1 bake-once). Replaces the old constant
 * `deriveAudienceProfile` + static `repaintPersonas` weight bias (F1 / P-5: reality first).
 *
 * Paths (§P.4):
 *   - Personal: scrape own account; if thin → niche fallback (NOT a dead-end to General).
 *   - Target:   profile-first (scrape the named/reference handle) → else niche search.
 *
 * Honesty spine (D-06): scrape error → { error:'scrape_failed' }; only when BOTH the
 * account AND the niche fallback are too thin → { fallback:'general', reason:'thin' }.
 * Never fabricates an audience from nothing.
 *
 * Determinism (P.7): enrichment runs temp 0 + seed once; the output is frozen on the row.
 * General/presets never reach this module → regression gate free by construction (D-17).
 *
 * Back-compat: the row's legacy `profile` + `personas` (CalibratedPersona[]) + 4 weight
 * cols are ALSO populated (mapped from the signature) so existing consumers keep working;
 * the new `signature` + `creator_persona` columns are the source of truth going forward.
 *
 * Exports: THIN_MIN_VIDEOS, calibrateFromScrape
 */

import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import { normalizeHandle } from "@/lib/schemas/competitor";
import type { ProfileData, VideoData, ProfileBundle } from "@/lib/scraping/types";
import { getFollowerTier } from "@/lib/engine/corpus/follower-tier";
import {
  enrichSignature,
  type EnrichInput,
  type EnrichDeps,
  type EnrichStage,
} from "./enrich-signature";
import type {
  Audience,
  AudienceProfile,
  AudienceType,
  AudiencePlatform,
  AudienceSignature,
  CalibratedPersona,
  GoalIntent,
  Disposition,
} from "./audience-types";

// ─── Thin-data gate constant ──────────────────────────────────────────────────

/**
 * Minimum number of scraped videos required to enrich honestly. Both the account AND
 * the niche fallback must fall below this (with no follower tier) before we degrade to
 * General — otherwise we niche-fallback rather than dead-end (§P.4).
 */
export const THIN_MIN_VIDEOS = 10;

// ─── Signature → legacy back-compat mappers ──────────────────────────────────────

/** Map the signature's reactors → legacy CalibratedPersona[] (repaint = reaction_frame). */
function personasFromSignature(sig: AudienceSignature): CalibratedPersona[] {
  return sig.audience.personas.map((p) => ({
    archetype: p.archetype,
    repaint: p.reaction_frame,
    temperature: p.temperature,
    disposition: p.disposition,
    share: p.share,
  }));
}

/** Map the signature → legacy AudienceProfile (real temperature_mix + top dispositions). */
function profileFromSignature(sig: AudienceSignature): AudienceProfile {
  const byDisposition: Partial<Record<Disposition, number>> = {};
  for (const p of sig.audience.personas) {
    byDisposition[p.disposition] = (byDisposition[p.disposition] ?? 0) + p.share;
  }
  const top_dispositions = (Object.entries(byDisposition) as [Disposition, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => d);

  return {
    temperature_mix: sig.audience.temperature_mix,
    top_dispositions,
    follower_tier: sig.audience.follower_tier,
  };
}

// ─── Input / result types ────────────────────────────────────────────────────────

export interface CalibrationInput {
  /** @handle — required for Personal; optional reference profile for Target. */
  handle?: string;
  type: AudienceType;
  platform: AudiencePlatform;
  goalIntent: GoalIntent;
  name: string;
  description?: string;
}

/**
 * The phases of a calibration, announced as each one BEGINS.
 *
 * WHY: the caller (the SSE route) awaits ONE opaque promise covering scrape + omni-watch +
 * synthesis, so it cannot see the boundaries from outside. It used to guess: it sent "Reading
 * your followers…", awaited the whole pipeline, and only THEN sent "Building your audience
 * profile…" — right before the DB write. Live (@zachking, 2026-07-14) that meant the user read
 * "Reading your followers…" for 126 SECONDS while the app was actually watching videos and
 * synthesizing, then "Building your audience profile…" flashed for 1s while a row was saved.
 * The staged SSE exists precisely so a 1-3 min run is never opaque (Pitfall 4) — so the stages
 * have to come from the code that can actually see them. This is that seam.
 */
export type CalibrationStage = "scraping" | EnrichStage;

/** Injection points for tests — defaults wire to the real Apify + enrichment stack. */
export interface CalibrationDeps {
  scrapeBundle?: (handle: string, limit?: number) => Promise<ProfileBundle>;
  scrapeNiche?: (query: string, limit?: number) => Promise<VideoData[]>;
  enrich?: (input: EnrichInput, deps?: EnrichDeps) => Promise<AudienceSignature>;
  /** Progress reporter. Threaded into enrichment so its two phases report themselves. */
  onStage?: (stage: CalibrationStage) => void;
  /**
   * Evidence reporter — fires the moment the scrape returns, with the account we actually pulled
   * and the posts we are about to watch.
   *
   * Calibration takes ~2 minutes and used to show a single line of text for all of it, even
   * though within seconds it is holding the creator's avatar, follower count and every video
   * cover. Those are the strongest proof that the work is real, so they go to the client the
   * instant they exist. Purely additive: an absent callback changes nothing.
   */
  onEvidence?: (evidence: CalibrationEvidence) => void;
}

/** What the scrape actually pulled — shown during the wait, not just used and hidden. */
export interface CalibrationEvidence {
  handle: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  /** The posts we are about to watch, newest-first as the scraper returned them. */
  videos: { coverUrl: string | null; views: number }[];
}

export interface CalibrationFallback {
  fallback: "general";
  reason: "thin";
}
export interface CalibrationError {
  /**
   * `scrape_failed`        — Apify/network failure. The handle may be wrong; retry is sensible.
   * `platform_unsupported` — the requested platform CANNOT be calibrated (see PLATFORM guard in
   *                          calibrateFromScrape). Retrying changes nothing; the copy must not
   *                          tell the user to "check the handle" — the handle is fine.
   */
  error: "scrape_failed" | "platform_unsupported";
  message?: string;
}
/**
 * Lightweight "it's real" reveal payload (§P.5) — the actual scraped account + its top
 * posts by engagement, shown on the reveal screen as proof. Derived from the scrape; never
 * fabricated. Empty `posts` on the niche/target-no-handle path (no single account).
 */
export interface RevealData {
  profile: {
    handle: string;
    displayName: string;
    bio: string;
    avatarUrl: string;
    verified: boolean;
    followerCount: number;
    heartCount: number;
    videoCount: number;
  };
  posts: Array<{ plays: number; saveRate: number; shareRate: number; caption: string }>;
}

export interface CalibrationSuccess {
  audience: Omit<Audience, "id" | "created_at" | "updated_at">;
  /** Reveal showcase (§P.5) — present on the account-scrape path; posts empty for niche. */
  reveal?: RevealData;
}
export type CalibrationResult =
  | CalibrationSuccess
  | CalibrationFallback
  | CalibrationError;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** A bundle is "thin" when there's no follower tier AND too few videos to read. */
function isThin(profile: ProfileData, videos: VideoData[]): boolean {
  return getFollowerTier(profile.followerCount) === null && videos.length < THIN_MIN_VIDEOS;
}

/** Derive a niche search query from hashtags → bio → name (for the fallback path). */
function nicheQuery(profile: ProfileData, videos: VideoData[], name: string, description?: string): string {
  const tags = [...new Set(videos.flatMap((v) => v.hashtags))].filter(Boolean).slice(0, 3);
  if (tags.length) return tags.join(" ");
  const text = (description ?? profile.bio ?? name).trim();
  return text.split(/\s+/).slice(0, 5).join(" ");
}

/** A synthetic profile for niche/target paths that have no single scraped account. */
function syntheticProfile(name: string, handle: string | undefined, description: string | undefined, videos: VideoData[]): ProfileData {
  return {
    handle: handle ?? normalizeHandle(name),
    displayName: name,
    bio: description ?? "",
    avatarUrl: "",
    verified: false,
    followerCount: 0,
    followingCount: 0,
    heartCount: 0,
    videoCount: videos.length,
  };
}

// ─── Main calibration ──────────────────────────────────────────────────────────

/**
 * Calibrate an audience into a real, signature-backed Audience object (no id — caller
 * persists via createAudience). Never throws — all failures are typed returns.
 */
export async function calibrateFromScrape(
  input: CalibrationInput,
  deps: CalibrationDeps = {},
): Promise<CalibrationResult> {
  const { handle, type, platform, goalIntent, name, description } = input;

  const scrapeBundle =
    deps.scrapeBundle ?? ((h: string, limit?: number) => new ApifyScrapingProvider().scrapeProfileBundle(h, limit));
  const scrapeNiche =
    deps.scrapeNiche ?? ((q: string, limit?: number) => new ApifyScrapingProvider().scrapeVideos(q, limit ?? 20, "search"));
  const enrich = deps.enrich ?? enrichSignature;
  const onStage = deps.onStage;
  const onEvidence = deps.onEvidence;

  // ── PLATFORM guard — the whole scrape stack below is TikTok-ONLY ──────────────────────
  //
  // `scrapeBundle` is `clockworks/tiktok-profile-scraper` and `scrapeNiche` is the TikTok
  // discover actor. NEITHER takes a platform: look at the signature — `(handle, limit)`. So
  // `platform` was destructured, written onto the audience row (and onto the connected account,
  // and onto its snapshot), and NEVER passed to the thing that does the scraping.
  //
  // Live, before this guard (2026-07-14): calibrating @zachking with platform:"instagram"
  // returned HTTP 200 in 75s with 10 personas, a connected_accounts row marked `instagram`, and
  // an account_snapshot of 86.1M followers / 610 posts / 1.3B hearts — TikTok's numbers exactly
  // (his real IG is nothing like that, and Instagram has no "hearts" at all). The audience was
  // built from TikTok and labelled Instagram.
  //
  // And a handle is NOT one identity across platforms: @foo on Instagram and @foo on TikTok are
  // usually different people. So the failure isn't "slightly stale numbers" — it is building a
  // STRANGER'S audience and presenting it as the user's own, with provenance that says otherwise.
  //
  // Instagram/YouTube ARE genuinely supported for CONNECT → analytics (`/api/connected-accounts/
  // connect` and the refresh cron both branch correctly onto scrapeInstagramProfile /
  // scrapeYouTubeChannel). Those actors return a PROFILE ONLY — no videos — and enrichment needs
  // videos, so real IG/YT calibration is a feature, not a guard. Until it exists, refuse:
  // an honest "we can't do that yet" beats a confident fabrication.
  //
  // `custom` stays allowed: it is the DESCRIBED path, which claims no platform provenance.
  if (platform !== "tiktok" && platform !== "custom") {
    return {
      error: "platform_unsupported",
      message: `Maven can only build an audience from a TikTok account right now. ${platform === "instagram" ? "Instagram" : "YouTube"} is supported for connecting your account's analytics, but not yet for calibration.`,
    };
  }

  // Every path below starts by hitting Apify — including the niche fallback's second call.
  onStage?.("scraping");

  // Resolved by the path below into { profile, videos, subCoverage, source, scrapedHandle }.
  let profile: ProfileData;
  let videos: VideoData[];
  let subCoverage: string;
  let source: "scrape" | "niche";
  let scrapedHandle: string | undefined;

  try {
    // ── Profile-first: Personal always, Target when a reference handle is given ──
    if (handle) {
      const bundle = await scrapeBundle(handle);

      if (isThin(bundle.profile, bundle.videos)) {
        // Thin account → niche fallback (§P.4 — never dead-end to General yet).
        const query = nicheQuery(bundle.profile, bundle.videos, name, description);
        const nicheVideos = query ? await scrapeNiche(query) : [];
        if (nicheVideos.length < THIN_MIN_VIDEOS) {
          return { fallback: "general", reason: "thin" }; // both too thin → honest General
        }
        profile = syntheticProfile(name, handle, description, nicheVideos);
        videos = nicheVideos;
        subCoverage = "0/0";
        source = "niche";
        scrapedHandle = handle;
      } else {
        profile = bundle.profile;
        videos = bundle.videos;
        subCoverage = bundle.subCoverage;
        source = "scrape";
        scrapedHandle = bundle.profile.handle || handle;

        // The account is real and in hand — show it, ~2 minutes before the audience it produces.
        // Only on the real-scrape branch: the niche fallback builds a SYNTHETIC profile (no real
        // account was found), and showing that as "the account we read" would be a lie.
        onEvidence?.({
          handle: scrapedHandle,
          displayName: bundle.profile.displayName,
          avatarUrl: bundle.profile.avatarUrl,
          followerCount: bundle.profile.followerCount,
          videos: bundle.videos.map((v) => ({
            coverUrl: v.coverUrl ?? null,
            views: v.views,
          })),
        });
      }
    } else {
      // ── Target with no reference handle → niche search from the description ──
      const query = nicheQuery(
        { bio: description ?? "" } as ProfileData,
        [],
        name,
        description,
      );
      const nicheVideos = query ? await scrapeNiche(query) : [];
      if (nicheVideos.length < THIN_MIN_VIDEOS) {
        return { fallback: "general", reason: "thin" };
      }
      profile = syntheticProfile(name, undefined, description, nicheVideos);
      videos = nicheVideos;
      subCoverage = "0/0";
      source = "niche";
    }
  } catch (err) {
    return {
      error: "scrape_failed",
      message: err instanceof Error ? err.message : "scrape failed",
    };
  }

  // ── Enrich → frozen signature (one-time, temp 0 + seed) ────────────────────────
  let signature: AudienceSignature;
  try {
    signature = await enrich(
      {
        handle: scrapedHandle ?? normalizeHandle(name),
        profile,
        videos,
        subCoverage,
        goalIntent,
      },
      // Thread the reporter in — enrichment owns the watch/synthesize boundary. This arg was
      // simply never passed before, so those two phases could not report themselves at all.
      { onStage },
    );
  } catch (err) {
    return {
      error: "scrape_failed",
      message: err instanceof Error ? err.message : "enrichment failed",
    };
  }

  // ── Reveal payload (§P.5) — the real account + its top posts by engagement ────────
  const topPosts = [...videos]
    .sort((a, b) => {
      const ea = (a.saves + a.shares) / (a.views > 0 ? a.views : 1);
      const eb = (b.saves + b.shares) / (b.views > 0 ? b.views : 1);
      return eb - ea;
    })
    .slice(0, 6)
    .map((v) => {
      const plays = v.views > 0 ? v.views : 1;
      return {
        plays: v.views,
        saveRate: Number(((v.saves / plays) * 100).toFixed(2)),
        shareRate: Number(((v.shares / plays) * 100).toFixed(2)),
        caption: v.caption,
      };
    });
  const reveal: RevealData = {
    profile: {
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      verified: profile.verified,
      followerCount: profile.followerCount,
      heartCount: profile.heartCount,
      videoCount: profile.videoCount,
    },
    posts: source === "scrape" ? topPosts : [], // niche has no single account to show
  };

  // ── Reality-first weights (P-5): the DERIVED mix becomes the row's 4 weight cols ──
  const persona_weights = signature.audience.persona_weights;

  const audience: Omit<Audience, "id" | "created_at" | "updated_at"> = {
    user_id: "", // injected by the route from the session (CR-01)
    name,
    type,
    platform,
    mode: "socials", // PITFALL 1: a scrape-derived, non-general audience runs the Socials pack.
    goal_label: description ?? null,
    goal_intent: goalIntent,
    is_general: false,
    is_preset: false,
    persona_weights,
    personas: personasFromSignature(signature), // legacy back-compat
    profile: profileFromSignature(signature), // legacy back-compat
    creator_persona: signature.creator_persona,
    signature,
    calibration: {
      source: source === "scrape" ? "scrape" : "description",
      handle: scrapedHandle,
      scraped_at: signature.provenance.scraped_at,
      thin: false,
    },
  };

  return { audience, reveal };
}
