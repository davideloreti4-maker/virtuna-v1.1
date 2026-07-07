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
import { calibrateFromScrape } from "@/lib/audience/calibration";
import { createAudience, updateAudience } from "@/lib/audience/audience-repo";
import { upsertAccountSnapshot } from "@/lib/account-metrics/account-metrics-repo";

// Apify runs can take 1-3 minutes — allow max 300s for the serverless function.
export const maxDuration = 300;

// ─── Input validation ──────────────────────────────────────────────────────────

function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

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
        // ── Staged status: stage 1 (UI-SPEC exact copy) ───────────────────
        send("status", { message: "Reading your followers…" });

        const calibrationResult = await calibrateFromScrape({
          handle,
          type,
          platform,
          goalIntent,
          name,
          description,
        });

        // ── Staged status: stage 2 ────────────────────────────────────────
        send("status", { message: "Building your audience profile…" });

        // ── Handle calibration outcomes ───────────────────────────────────

        if ("error" in calibrationResult) {
          // Scrape/network failure — distinct from thin fallback (UI-SPEC copy)
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

        // user_id is injected from session inside the repo (CR-01).
        // A7: if the form already created a draft (audienceId), UPDATE it in place
        // so calibration enriches the existing row instead of leaving an orphan dupe.
        // Falls back to insert when no draft id is supplied (back-compat / API callers).
        let persistedAudience;
        try {
          persistedAudience = audienceId
            ? await updateAudience(supabase, audienceId, audienceInput)
            : await createAudience(supabase, {
                ...audienceInput,
                user_id: user.id, // pre-fill for the repo validation step
              });
        } catch {
          // Persist failure is non-fatal in the same style as other routes
          // (the calibration succeeded — best effort persist)
          send("error", { message: "Calibration failed. Check the handle and try again.", retry: true });
          return;
        }

        // reveal = the "it's real" showcase (§P.5): real scraped account + top posts.
        send("done", { audience: persistedAudience, reveal });

        // Best-effort: seed the first account_snapshots point from this scrape so
        // the /start stat-row shows real point-in-time numbers immediately (weekly
        // deltas + sparklines then accumulate via the refresh-account-snapshots
        // cron). Personal, scrapeable platforms only; never blocks calibration.
        if (type === "personal" && platform !== "custom" && reveal?.profile) {
          try {
            await upsertAccountSnapshot(supabase, {
              userId: user.id,
              platform,
              handle: reveal.profile.handle || handle || name,
              followerCount: reveal.profile.followerCount,
              followingCount: null, // reveal omits it — the daily cron fills it
              heartCount: reveal.profile.heartCount,
              videoCount: reveal.profile.videoCount,
            });
          } catch {
            /* snapshot capture is best-effort — calibration already succeeded */
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
