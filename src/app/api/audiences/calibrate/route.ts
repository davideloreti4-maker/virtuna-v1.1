/**
 * POST /api/audiences/calibrate — SSE calibration route (AUD-02).
 *
 * Streams staged status events over SSE so a 1-3 min Apify run never blocks the
 * request opaquely (Pitfall 4). The route mirrors /api/tools/ideas ReadableStream pattern.
 *
 * SSE event names (UI-SPEC §Calibration flow):
 *   event: status  — { message: string } — staged copy: "Reading your followers…" / "Building your audience profile…"
 *   event: fallback — { reason: 'thin', message: string } — honest notice (D-06 / warning-toned)
 *   event: error    — { message: string } — scrape/network failure + retry affordance signal
 *   event: done     — { audience: Audience } — persisted audience on success
 *
 * Security (STRIDE T-07-01 – T-07-04):
 *  - Auth-first: getUser() before any DB read (CR-01 / T-07-03)
 *  - Zod validates { handle?, type, platform, goalIntent, name, description? } (T-07-01)
 *  - sanitizeText on handle/name/description before any use (T-07-04)
 *  - user_id from session only (T-07-03); createAudience re-enforces this
 *  - Generic error copy; never echo raw user input into error events (T-07-04)
 *  - maxDuration=300 for Apify latency headroom (Pitfall 4)
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  calibrateFromScrape,
  type CalibrationStage,
} from "@/lib/audience/calibration";
import { createAudience, updateAudience, listAudiences } from "@/lib/audience/audience-repo";
import { audienceForAccount } from "@/components/audience/audience-display";
import { upsertAccountSnapshot } from "@/lib/account-metrics/account-metrics-repo";
import { upsertAccountPosts } from "@/lib/account-metrics/account-posts-repo";
import { clusterPillarsForAccount } from "@/lib/content-pillars/cluster";
import {
  getOrCreateConnectedAccount,
  touchAccountSynced,
  type ConnectedAccount,
} from "@/lib/connected-accounts/connected-accounts-repo";
import type { ProfileBundle } from "@/lib/scraping/types";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "audience.calibrate" });

// Apify runs can take 1-3 minutes — allow max 300s for the serverless function.
export const maxDuration = 300;

// ─── Input validation ──────────────────────────────────────────────────────────

function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

/**
 * Stage → user-facing copy. Each fires as its phase BEGINS, so the message on screen is the
 * work actually happening. Measured live (@zachking): scrape ~126s, watch+synthesize ~2s of
 * wall clock after it — previously ALL of that sat under "Reading your followers…", and
 * "Building your audience profile…" appeared only once the profile was already built.
 */
const STAGE_COPY: Record<CalibrationStage, string> = {
  scraping: "Reading your followers…",
  watching: "Watching your top videos…",
  synthesizing: "Building your audience profile…",
};

const CalibrateSchema = z.object({
  // A7: the draft audience the form already created. When present, calibration
  // UPDATEs this row instead of inserting a second one (no orphan dupe).
  audienceId: z.string().uuid().optional(),
  handle: z.string().max(50).transform(sanitizeText).optional(),
  type: z.enum(["personal", "target"]),
  platform: z.enum(["tiktok", "instagram", "youtube", "custom"]),
  goalIntent: z.enum(["grow", "sell", "authority", "nurture"]),
  name: z.string().min(1).max(80).transform(sanitizeText),
  description: z.string().max(500).transform(sanitizeText).optional(),
});

// ─── SSE helpers (mirrors /api/tools/ideas pattern) ──────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

// ─── POST /api/audiences/calibrate ────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (CR-01 / T-07-03) ──────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CalibrateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_calibration_input" }, { status: 400 });
  }

  const { audienceId, handle, type, platform, goalIntent, name, description } = parsed.data;

  // ── (3) SSE stream ────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* stream cancelled — drop frame */
        }
      };

      try {
        // ── Staged status, driven by the pipeline itself (not guessed) ────
        // The stages are emitted by calibrateFromScrape/enrichSignature as each phase BEGINS —
        // the route awaits one opaque promise and cannot see those boundaries from out here.
        // The raw bundle from the ONE scrape — persistence (posts archive → pillars)
        // reads this after `done` instead of running a second Apify scrape (P4).
        // Holder object: TS doesn't track assignments made inside the callback.
        const captured: { bundle: ProfileBundle | null } = { bundle: null };

        const calibrationResult = await calibrateFromScrape(
          { handle, type, platform, goalIntent, name, description },
          {
            onStage: (stage) => send("status", { message: STAGE_COPY[stage] }),
            // The account + the posts we're about to watch, the moment the scrape returns —
            // ~2 minutes before the audience they produce. A status line claims we are working;
            // the creator's own face and covers prove it.
            onEvidence: (evidence) => send("evidence", evidence),
            onBundle: (bundle) => {
              captured.bundle = bundle;
            },
          },
        );

        // ── Handle calibration outcomes ───────────────────────────────────

        if ("error" in calibrationResult) {
          // `platform_unsupported` is NOT a failed scrape — nothing was scraped, and the handle
          // is fine. Telling the user to "check the handle and try again" would send them round a
          // loop that can never succeed. Carry the domain's own message and do NOT offer retry.
          if (calibrationResult.error === "platform_unsupported") {
            send("error", {
              message:
                calibrationResult.message ??
                "Maven can only build an audience from a TikTok account right now.",
              retry: false,
            });
            return;
          }
          // Scrape/network failure — distinct from thin fallback (UI-SPEC copy)
          log.warn("calibration returned scrape_failed", {
            detail: calibrationResult.message ?? null,
          });
          send("error", {
            message: "Calibration failed. Check the handle and try again.",
            retry: true,
          });
          return;
        }

        if ("fallback" in calibrationResult) {
          // Honest thin-data fallback (D-06 / UI-SPEC §Calibration fallback copy)
          // Warning-toned, never error, never fabricated
          send("fallback", {
            reason: "thin",
            message:
              `We couldn't read enough from @${handle ?? name} to calibrate a personal audience, so Maven is using General for now. Try again when your account has more public activity.`,
          });
          return;
        }

        // ── Success path: persist + emit done ────────────────────────────
        const { audience: audienceInput, reveal } = calibrationResult;

        // Decouple connect from calibrate: a personal calibration from a real scrape
        // resolves (or creates) the CONNECTED ACCOUNT it read from — the first-class
        // (platform, handle) that owns the analytics series and grounds this audience.
        // Best-effort: a failure here never blocks calibration (platform narrows to a
        // scrapeable one inside the guard).
        let connectedAccount: ConnectedAccount | null = null;
        if (type === "personal" && platform !== "custom" && reveal?.profile) {
          try {
            connectedAccount = await getOrCreateConnectedAccount(supabase, {
              userId: user.id,
              platform,
              handle: reveal.profile.handle || handle || name,
              displayName:
                reveal.profile.displayName || reveal.profile.handle || handle || name,
            });
          } catch (e) {
            /* connect is best-effort — calibration proceeds without a linked account */
            log.warn("connect account failed", { err: e instanceof Error ? e.message : String(e) });
          }
        }

        // user_id is injected from session inside the repo (CR-01).
        // A7: if the form already created a draft (audienceId), UPDATE it in place
        // so calibration enriches the existing row instead of leaving an orphan dupe.
        // Falls back to insert when no draft id is supplied (back-compat / API callers).
        // source_account_id links the audience to the account it calibrated from.
        // One connection → ONE canonical audience: re-connecting an already-synced
        // handle re-calibrates the audience that account manifests as (the same row
        // audienceForAccount resolves on the list), instead of stranding a duplicate
        // behind it. Best-effort — an unreadable list just falls through to insert.
        let canonicalId: string | undefined = audienceId;
        if (!canonicalId && type === "personal" && connectedAccount) {
          try {
            canonicalId = audienceForAccount(
              connectedAccount,
              await listAudiences(supabase),
            )?.id;
          } catch (e) {
            /* fall through to insert */
            log.warn("canonical audience lookup failed", { err: e instanceof Error ? e.message : String(e) });
          }
        }

        let persistedAudience;
        try {
          const withSource = connectedAccount
            ? { ...audienceInput, source_account_id: connectedAccount.id }
            : audienceInput;
          persistedAudience = canonicalId
            ? await updateAudience(supabase, canonicalId, withSource)
            : await createAudience(supabase, {
                ...withSource,
                user_id: user.id, // pre-fill for the repo validation step
              });
        } catch (e) {
          // The calibration succeeded but the row write didn't — say so in the log
          // (a silent catch here cost a live-verification run to diagnose, 2026-07-17).
          log.error("audience persist failed", {
            canonicalId: canonicalId ?? null,
            err: e instanceof Error ? e.message : String(e),
          });
          send("error", { message: "Calibration failed. Check the handle and try again.", retry: true });
          return;
        }

        // reveal = the "it's real" showcase (§P.5): real scraped account + top posts.
        send("done", { audience: persistedAudience, reveal });

        // Best-effort: seed the first account_snapshots point (keyed to the connected
        // account) so the /start stat-row shows real point-in-time numbers immediately
        // (weekly deltas + sparklines then accumulate via the refresh-account-snapshots
        // cron). Only when the connect step above resolved an account; never blocks.
        if (connectedAccount && reveal?.profile) {
          try {
            await upsertAccountSnapshot(supabase, {
              accountId: connectedAccount.id,
              userId: user.id,
              platform: connectedAccount.platform,
              handle: connectedAccount.handle,
              followerCount: reveal.profile.followerCount,
              followingCount: null, // reveal omits it — the daily cron fills it
              heartCount: reveal.profile.heartCount,
              videoCount: reveal.profile.videoCount,
            });
          } catch (e) {
            /* snapshot capture is best-effort — calibration already succeeded */
            log.warn("snapshot seed failed", { err: e instanceof Error ? e.message : String(e) });
          }
          // A successful scrape IS a sync — without this the SYNC rail reads "Last —"
          // moments after calibrating (live-caught 2026-07-17). RLS-scoped fine here.
          try {
            await touchAccountSynced(supabase, connectedAccount.id);
          } catch (e) {
            log.warn("sync stamp failed", { err: e instanceof Error ? e.message : String(e) });
          }
        }

        // One-scrape unification (P4): archive the SAME videos the calibration just
        // watched as account_posts (the SOURCE zone's proof-of-scrape + the pillar
        // input), then cluster pillars so the detail page is lit at creation instead
        // of waiting a day for the refresh cron. Both best-effort, both post-`done` —
        // the audience is already delivered; this work must never cost the creator it.
        if (connectedAccount && captured.bundle) {
          try {
            await upsertAccountPosts(
              supabase,
              connectedAccount.id,
              user.id,
              connectedAccount.platform,
              connectedAccount.handle,
              captured.bundle.videos,
            );
            await clusterPillarsForAccount(supabase, user.id, connectedAccount.id);
          } catch (e) {
            /* posts archive + pillars are best-effort — the daily cron converges them */
            log.warn("posts archive / pillar cluster failed", { err: e instanceof Error ? e.message : String(e) });
          }
        }
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Calibration failed. Check the handle and try again.",
          retry: true,
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
