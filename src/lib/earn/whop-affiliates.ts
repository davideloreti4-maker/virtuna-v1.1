/**
 * whop-affiliates.ts — the calls to Whop's affiliate API (plan 2026-11-24-earn, step B; ruling 12, as
 * Whop documents it). SERVER ONLY (it holds the key); `fetch` is a parameter, so a test records every call
 * and nothing here reaches Whop by itself.
 *
 * - `POST /affiliates { account_id, user_identifier }`: creates the affiliate, or answers the one that
 *   exists; 404 when no Whop account matches the identifier.
 * - `GET /affiliates/{id}`: the affiliate (`total_referral_earnings_usd` is what it has earned).
 * - `GET /affiliates/{id}/overrides` and `POST /affiliates/{id}/overrides`: the commission per plan.
 *
 * The settings come from the environment when they are used: `WHOP_API_BASE_URL` (Whop's documented
 * address by default; the sandbox is `https://sandbox-api.whop.com/api/v1`), `WHOP_API_KEY`,
 * `WHOP_COMPANY_ID`. A `WhopError` names a kind and a status only: never the key, an identifier, or Whop's
 * own words, so it can be logged as it is.
 */
import { EARN_RATE_PCT, WHOP_AFFILIATE_ID_PATTERN, WHOP_USERNAME_PATTERN } from "./earn";

export type Http = (input: string, init: RequestInit) => Promise<Response>;

export const WHOP_DEFAULT_BASE = "https://api.whop.com/api/v1";
/** One call to Whop may take this long; after it, it is given up (unreachable). */
export const WHOP_CALL_MS = 8_000;

export interface WhopSettings {
  baseUrl: string;
  apiKey: string;
  companyId: string;
  /** A shorter time limit than `WHOP_CALL_MS` for the calls made with these settings (the earned read; tests). */
  timeoutMs?: number;
}

/**
 * Whop's base address alone, read now: `WHOP_API_BASE_URL` (a trailing slash dropped) when it is set and
 * https, else Whop's documented one. For the checkout, which exists whether or not the affiliate side is
 * configured and so cannot become "not available" over a bad address (ruling 25).
 */
export function whopBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.WHOP_API_BASE_URL?.trim().replace(/\/+$/, "");
  return base && base.startsWith("https://") ? base : WHOP_DEFAULT_BASE;
}

/**
 * Whop's settings, read now. Null (enrolling is "not available") when the key or the company id is not
 * set, or when the address is not https (the key must never travel in the clear).
 */
export function whopSettings(env: NodeJS.ProcessEnv = process.env): WhopSettings | null {
  const apiKey = env.WHOP_API_KEY?.trim();
  const companyId = env.WHOP_COMPANY_ID?.trim();
  const baseUrl = (env.WHOP_API_BASE_URL?.trim() || WHOP_DEFAULT_BASE).replace(/\/+$/, "");
  if (!apiKey || !companyId || !baseUrl.startsWith("https://")) return null;
  return { baseUrl, apiKey, companyId };
}

export type WhopErrorKind = "not_found" | "refused" | "unreachable" | "malformed";

export class WhopError extends Error {
  constructor(
    readonly kind: WhopErrorKind,
    readonly status?: number,
  ) {
    super(`whop ${kind}${status === undefined ? "" : ` ${status}`}`);
    this.name = "WhopError";
  }
}

export interface WhopAffiliate {
  id: string;
  /** The affiliate's Whop username; null when Whop answered none of the stored form. */
  username: string | null;
  /** `total_referral_earnings_usd` in whole cents; null when it could not be read. */
  earnedCents: number | null;
}

export interface WhopOverride {
  planId: string | null;
}

/** `answer: "none"`: the status alone says it worked, and whatever body there is (or is not) is not read. */
async function call(http: Http, s: WhopSettings, method: "GET" | "POST", path: string, body?: unknown, answer: "json" | "none" = "json"): Promise<unknown> {
  const headers: Record<string, string> = { Authorization: `Bearer ${s.apiKey}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await http(`${s.baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(s.timeoutMs ?? WHOP_CALL_MS),
    });
  } catch {
    throw new WhopError("unreachable");
  }
  if (res.status === 404) throw new WhopError("not_found", 404);
  if (!res.ok) throw new WhopError("refused", res.status);
  if (answer === "none") return undefined;
  try {
    return await res.json();
  } catch {
    throw new WhopError("malformed", res.status);
  }
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function affiliateOf(answer: unknown): WhopAffiliate {
  const a = record(answer);
  const id = a?.id;
  if (typeof id !== "string" || !WHOP_AFFILIATE_ID_PATTERN.test(id)) throw new WhopError("malformed");
  const username = record(a!.user)?.username;
  return {
    id,
    username: typeof username === "string" && WHOP_USERNAME_PATTERN.test(username) ? username : null,
    earnedCents: centsOfUsd(a!.total_referral_earnings_usd),
  };
}

function affiliatePath(id: string): string {
  if (!WHOP_AFFILIATE_ID_PATTERN.test(id)) throw new WhopError("malformed");
  return `/affiliates/${id}`;
}

/** Creates the affiliate for a Whop username or user id, or finds the one that exists. */
export async function createAffiliate(http: Http, s: WhopSettings, userIdentifier: string): Promise<WhopAffiliate> {
  return affiliateOf(await call(http, s, "POST", "/affiliates", { account_id: s.companyId, user_identifier: userIdentifier }));
}

export async function getAffiliate(http: Http, s: WhopSettings, affiliateId: string): Promise<WhopAffiliate> {
  return affiliateOf(await call(http, s, "GET", affiliatePath(affiliateId)));
}

export async function listOverrides(http: Http, s: WhopSettings, affiliateId: string): Promise<WhopOverride[]> {
  const data = record(await call(http, s, "GET", `${affiliatePath(affiliateId)}/overrides`))?.data;
  if (!Array.isArray(data)) throw new WhopError("malformed");
  return data.map((item) => {
    const planId = record(item)?.plan_id;
    return { planId: typeof planId === "string" && planId ? planId : null };
  });
}

/**
 * One standard override: `EARN_RATE_PCT` percent of the first payment on `planId` (rulings 12 and 14). Set
 * when Whop answers 2xx: nothing of the answer's body is used, so a body that is empty or not JSON does not
 * make a commission that was set count as failed (under ruling 26 that would refuse the whole enrolment).
 */
export async function createOverride(http: Http, s: WhopSettings, affiliateId: string, planId: string): Promise<void> {
  await call(
    http,
    s,
    "POST",
    `${affiliatePath(affiliateId)}/overrides`,
    {
      override_type: "standard",
      id: affiliateId,
      plan_id: planId,
      commission_type: "percentage",
      commission_value: EARN_RATE_PCT,
      applies_to_payments: "first_payment",
    },
    "none",
  );
}

/**
 * `total_referral_earnings_usd` in whole cents (ruling 16): a text like "12.50" or a number; a part of a
 * cent is rounded half up. Anything else (a negative, a word, an exponent, nothing) is null.
 */
export function centsOfUsd(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    const cents = Math.round(value * 100);
    return Number.isSafeInteger(cents) ? cents : null;
  }
  if (typeof value !== "string") return null;
  const m = /^(\d{1,13})(?:\.(\d+))?$/.exec(value.trim());
  if (!m) return null;
  const fraction = (m[2] ?? "").padEnd(3, "0");
  return Number(m[1]) * 100 + Number(fraction.slice(0, 2)) + (fraction[2]! >= "5" ? 1 : 0);
}
