/**
 * The account step's call to `POST /api/onboarding/start`. `emailConsent` is the account screen's checkbox
 * ("Email me tips and reminders about my trial"), unticked by default. The answer's `next` is followed only
 * when it is a path on this site (never another origin, never "//host" or "/\host", which browsers read as one,
 * nor "/\t/host": the URL parser drops tabs and newlines, so the path is resolved the way a browser does and its
 * origin compared).
 */
import type { BuildRequest } from "@/lib/audience-next/build-request";

import type { CompleteAnswers } from "./answers";

export type SaveResult = { ok: true; next: string; build: BuildRequest | null } | { ok: false };

const SAME_SITE_PATH = /^\/(?![/\\])/;
const BASE = "https://same-site.invalid";

function isSameSitePath(next: string): boolean {
  if (!SAME_SITE_PATH.test(next)) return false;
  try {
    return new URL(next, BASE).origin === BASE;
  } catch {
    return false;
  }
}

export async function saveStart(answers: CompleteAnswers, emailConsent: boolean): Promise<SaveResult> {
  try {
    const res = await fetch("/api/onboarding/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, emailConsent }),
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { next?: unknown; build?: unknown };
    if (typeof body.next !== "string" || !isSameSitePath(body.next)) return { ok: false };
    const build = body.build && typeof body.build === "object" ? (body.build as BuildRequest) : null;
    return { ok: true, next: body.next, build };
  } catch {
    return { ok: false };
  }
}
