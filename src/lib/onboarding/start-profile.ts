/**
 * start-profile.ts — what `POST /api/onboarding/start` writes to `creator_profiles`, and where the creator goes
 * next (funnel spec §3.2, §3.3). Pure.
 *
 * The write:
 * - The niche is /start's own (`niche`, `niche_source`): written once, never over one /start already wrote
 *   (`niche_source` set).
 * - The goal and the platforms go to columns the app already has and other screens write (You, Settings,
 *   /welcome's wait questions): `primary_goal` and `target_platforms`, each only where empty. `primary_goal`
 *   has its own set (growth | engagement | brand_deals | conversion; the profile PATCH accepts nothing else),
 *   and screen 4 asks exactly that set (`Goal`), so the goal is written as is.
 *   `target_platforms` takes the same spelling as `Platform`.
 * - A handle only where none is kept.
 * - `email_consent` only from the ticked box (unticked by default; German rules need active consent for the
 *   non-transactional email), and it only ever turns on.
 * - Onboarding is stamped done (now, or the date already kept): the middleware stops sending the account to
 *   /start from that moment, while the guide (part 2) takes them through the app.
 *
 * Where next: a plan → the app; an audience of their own already built → that audience, guided; else the
 * building screen, guided, with the first build: their TikTok account read when they gave the handle, else the
 * app's "describe them" audience from their niche words (Instagram is not read by the build).
 */
import { SENTINEL_IDS } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import { buildRequestOf, type BuildRequest } from "@/lib/audience-next/build-request";

import type { CompleteAnswers } from "./answers";

/** The columns read before the write. */
export const PROFILE_READ =
  "niche_source, primary_goal, target_platforms, tiktok_handle, instagram_handle, email_consent, onboarding_completed_at";

export interface ExistingProfile {
  niche_source: string | null;
  primary_goal: string | null;
  target_platforms: string[] | null;
  tiktok_handle: string | null;
  instagram_handle: string | null;
  email_consent: boolean | null;
  onboarding_completed_at: string | null;
}

export interface ProfileWrite {
  user_id: string;
  onboarding_step: "completed";
  onboarding_completed_at: string;
  email_consent: boolean;
  niche?: string | null;
  niche_source?: string;
  primary_goal?: string;
  target_platforms?: string[];
  tiktok_handle?: string;
  instagram_handle?: string;
}

export function profileWriteOf(
  userId: string,
  answers: CompleteAnswers,
  existing: ExistingProfile | null,
  emailConsent: boolean,
  now: string,
): ProfileWrite {
  const write: ProfileWrite = {
    user_id: userId,
    onboarding_step: "completed",
    onboarding_completed_at: existing?.onboarding_completed_at ?? now,
    email_consent: emailConsent || existing?.email_consent === true,
  };
  if (!existing?.niche_source) {
    write.niche = answers.nicheSource === "typed" ? (answers.niche ?? null) : null;
    write.niche_source = answers.nicheSource;
  }
  if (!existing?.primary_goal) write.primary_goal = answers.goal;
  if (!existing?.target_platforms?.length) write.target_platforms = [...answers.platforms];
  if (answers.tiktokHandle && !existing?.tiktok_handle) write.tiktok_handle = answers.tiktokHandle;
  if (answers.instagramHandle && !existing?.instagram_handle) write.instagram_handle = answers.instagramHandle;
  return write;
}

/** A plan: any tier but free (the webhook sets "free" when a membership ends). */
export function hasPlanOf(row: Record<string, unknown> | null): boolean {
  return typeof row?.virtuna_tier === "string" && row.virtuna_tier !== "free";
}

/**
 * An audience of their own with personas. Ownership first: `listAudiences` also serves the virtual rows, and
 * two templates carry personas (the bug /welcome hit on 2026-08-04, welcome/page.tsx).
 */
export function hasCalibratedAudience(audiences: readonly Audience[]): boolean {
  return audiences.some((a) => !SENTINEL_IDS.has(a.id) && !a.is_general && (a.personas?.length ?? 0) > 0);
}

/** The first build: their TikTok account read, else an audience described by their niche words. */
export function firstBuildRequestOf(a: CompleteAnswers): BuildRequest | null {
  if (a.tiktokHandle) return buildRequestOf("own", a.tiktokHandle);
  return a.niche ? buildRequestOf("describe", a.niche) : null;
}

export const APP_HREF = "/home";
export const AUDIENCE_GUIDE_HREF = "/audience?guide=1";
export const BUILDING_HREF = "/audience/new?guide=1";

export interface AfterSave {
  next: string;
  build: BuildRequest | null;
}

export function afterSaveOf(input: { hasPlan: boolean; hasAudience: boolean; answers: CompleteAnswers }): AfterSave {
  if (input.hasPlan) return { next: APP_HREF, build: null };
  if (input.hasAudience) return { next: AUDIENCE_GUIDE_HREF, build: null };
  const build = firstBuildRequestOf(input.answers);
  return build ? { next: BUILDING_HREF, build } : { next: AUDIENCE_GUIDE_HREF, build: null };
}
