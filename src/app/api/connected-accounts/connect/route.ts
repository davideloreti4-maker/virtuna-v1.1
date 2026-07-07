/**
 * POST /api/connected-accounts/connect — the decoupled "connect an account" action.
 *
 * Connecting is no longer a side-effect of calibrating an audience: this route takes a
 * (platform, handle), scrapes the public profile, resolves-or-creates the first-class
 * `connected_accounts` row, and seeds its first `account_snapshots` point so the "Your
 * account" analytics tab shows real point-in-time numbers immediately. The daily
 * refresh-account-snapshots cron then accumulates the trend from there.
 *
 * TikTok-only today (the Apify provider is a TikTok scraper; the platform enum carries
 * instagram/youtube for the OAuth future). Plain JSON (not SSE) — a single profile scrape
 * is short; the UI shows a spinner.
 *
 * Security spine mirrors /api/audiences/calibrate (STRIDE T-07-01 – T-07-04):
 *  - Auth-first: getUser() before any DB read / scrape (CR-01 / T-07-03)
 *  - Zod validates { platform, handle } (T-07-01); sanitizeText on handle (T-07-04)
 *  - user_id from session only (T-07-03); the repo re-enforces RLS
 *  - Generic error copy; never echo raw user input into errors (T-07-04)
 *  - maxDuration=300 for scrape latency headroom
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import { upsertAccountSnapshot } from "@/lib/account-metrics/account-metrics-repo";
import { getOrCreateConnectedAccount } from "@/lib/connected-accounts/connected-accounts-repo";

// A single profile scrape is usually quick, but allow headroom (Apify cold starts).
export const maxDuration = 300;

function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

const ConnectSchema = z.object({
  // TikTok-only until IG/YT capture lands (the column still accepts the wider enum).
  platform: z.enum(["tiktok"]),
  handle: z.string().min(1).max(50).transform(sanitizeText),
});

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate ──────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── (2) Parse + validate body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_connect_input" }, { status: 400 });
  }
  const { platform, handle } = parsed.data;

  // ── (3) Scrape the public profile ────────────────────────────────────────────
  // Connect only needs the PROFILE (follower/like/post counts for the analytics seed) —
  // NOT the video bundle that calibration downloads. scrapeProfile is the light path.
  let profile;
  try {
    profile = await new ApifyScrapingProvider().scrapeProfile(handle);
  } catch {
    return Response.json(
      { error: "We couldn't read that account. Check the handle and try again." },
      { status: 502 },
    );
  }

  if (!profile || !profile.handle) {
    return Response.json(
      { error: "We couldn't read that account. Check the handle and try again." },
      { status: 502 },
    );
  }

  // ── (4) Resolve-or-create the connected account ──────────────────────────────
  const account = await getOrCreateConnectedAccount(supabase, {
    userId: user.id,
    platform,
    handle: profile.handle || handle,
    displayName: profile.displayName || profile.handle || handle,
  });
  if (!account) {
    return Response.json(
      { error: "Couldn't connect that account. Try again." },
      { status: 500 },
    );
  }

  // ── (5) Seed the first snapshot (best-effort — the row already exists) ────────
  try {
    await upsertAccountSnapshot(supabase, {
      accountId: account.id,
      userId: user.id,
      platform: account.platform,
      handle: account.handle,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount ?? null,
      heartCount: profile.heartCount,
      videoCount: profile.videoCount,
    });
  } catch {
    /* snapshot seed is best-effort — the account is connected regardless */
  }

  return Response.json({
    account,
    reveal: {
      profile: {
        handle: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        verified: profile.verified,
        followerCount: profile.followerCount,
        heartCount: profile.heartCount,
        videoCount: profile.videoCount,
      },
    },
  });
}
