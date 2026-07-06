/**
 * rateLimitGuard — the shared per-user sliding-window rate limit for the expensive
 * AI tool routes (HARDEN-01). Twin of `csrfGuard`: call it immediately after the
 * auth + CSRF gates and return the Response when it is non-null.
 *
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *   const guard = csrfGuard(request);
 *   if (guard) return guard;
 *   const limited = await rateLimitGuard(user.id, "ideas");   // ← here
 *   if (limited) return limited;
 *
 * Store: Upstash Redis (serverless-native, REST — works on the Node AND Edge
 * runtimes, unlike an in-memory counter which does not survive a serverless cold
 * start). Configured via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
 *
 * FAIL-OPEN by design. If the env is not configured (local dev, or production
 * before the store is provisioned) the guard is a no-op (returns `null`) so the
 * product keeps working — a single warning is logged so the missing config is
 * discoverable. The moment the two env vars are set the limit activates with no
 * code change. A Redis blip at request time also fails open: a rate limiter must
 * never be the thing that takes the product down.
 *
 * Buckets are PER USER, PER ROUTE. The heavier pipelines (full generate → SIM →
 * rank / Flash runs) get a tighter budget than the single-shot LLM turns — this
 * mirrors the ideas route's original intent ("ideas are heavier than chat turns;
 * tighter window").
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** Shared sliding window. */
const WINDOW = "60 s" as const;

/** Requests per WINDOW, per user, per route. Fallback for any unlisted key. */
const DEFAULT_MAX = 20;
const ROUTE_MAX: Record<string, number> = {
  // Heavy — full generate→SIM→rank pipelines or Flash runs (Apify/Qwen budget).
  read: 10,
  ideas: 5,
  script: 10,
  simulate: 10,
  predict: 10,
  react: 20,
  // Lighter — single-shot LLM turns.
  chat: 30,
  explore: 20,
  hooks: 15,
  profile: 15,
  refine: 20,
};

// Module-scoped singletons — one Redis client, one Ratelimit per route key.
let redis: Redis | null = null;
let warned = false;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warned) {
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — " +
          "tool-route rate limiting is DISABLED (fail-open). Set both to enable.",
      );
      warned = true;
    }
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

function getLimiter(routeKey: string, max: number): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  let limiter = limiters.get(routeKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(max, WINDOW),
      prefix: `rl:tools:${routeKey}`,
      analytics: false,
    });
    limiters.set(routeKey, limiter);
  }
  return limiter;
}

/**
 * Returns a `429` Response when the user has exceeded the route's budget, or
 * `null` when the request may proceed (including when rate limiting is disabled
 * or the store is unreachable — see FAIL-OPEN above).
 *
 * @param userId  the authenticated user id (session only — never from the body).
 * @param routeKey a stable per-route key, e.g. "ideas" (drives the bucket + cap).
 */
export async function rateLimitGuard(
  userId: string,
  routeKey: string,
): Promise<Response | null> {
  const max = ROUTE_MAX[routeKey] ?? DEFAULT_MAX;
  const limiter = getLimiter(routeKey, max);
  if (!limiter) return null; // fail-open — store not configured

  let result: Awaited<ReturnType<Ratelimit["limit"]>>;
  try {
    result = await limiter.limit(userId);
  } catch (err) {
    // Store unreachable → fail open. Never take the product down over a rate limiter.
    console.error("[rate-limit] limiter error — failing open:", err);
    return null;
  }

  if (result.success) return null;

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return Response.json(
    { error: "Rate limit exceeded — please slow down and try again in a moment." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    },
  );
}
