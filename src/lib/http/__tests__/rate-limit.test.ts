import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * rateLimitGuard is a module singleton that reads env at first use, so each test
 * resets the module registry and re-imports after stubbing env + the Upstash SDK.
 */
const ENV_KEYS = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;
const saved: Record<string, string | undefined> = {};

function mockUpstash(limit: ReturnType<typeof vi.fn>) {
  vi.doMock("@upstash/redis", () => ({ Redis: class {} }));
  vi.doMock("@upstash/ratelimit", () => ({
    Ratelimit: class {
      static slidingWindow() {
        return {};
      }
      limit = limit;
    },
  }));
}

describe("rateLimitGuard", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("fails open (returns null) and warns once when Upstash env is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rateLimitGuard } = await import("../rate-limit");

    expect(await rateLimitGuard("u1", "ideas")).toBeNull();
    expect(await rateLimitGuard("u1", "read")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1); // warned once, not per call
  });

  it("returns a 429 with Retry-After when the limiter denies", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const limit = vi
      .fn()
      .mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: Date.now() + 30_000 });
    mockUpstash(limit);
    const { rateLimitGuard } = await import("../rate-limit");

    const res = await rateLimitGuard("u1", "ideas");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(Number(res!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(res!.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(limit).toHaveBeenCalledWith("u1"); // keyed by user id
  });

  it("returns null (allows) when the limiter permits", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const limit = vi
      .fn()
      .mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 30_000 });
    mockUpstash(limit);
    const { rateLimitGuard } = await import("../rate-limit");

    expect(await rateLimitGuard("u1", "read")).toBeNull();
  });

  it("fails open (returns null) when the store throws", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const limit = vi.fn().mockRejectedValue(new Error("redis unreachable"));
    mockUpstash(limit);
    const { rateLimitGuard } = await import("../rate-limit");

    expect(await rateLimitGuard("u1", "chat")).toBeNull();
  });
});
