/**
 * scrape-default.test.ts — the env flag that authorizes a live Apify scrape a request did not.
 *
 * This guards a MONEY boundary in both directions, so the negative cases matter more than the
 * positive one: the shipped posture is that a run never reaches for Apify unless something
 * explicitly says so, and everything below pins the "something" to exactly two inputs.
 */

import { describe, it, expect, afterEach } from "vitest";
import { isScrapeDefaultEnabled, resolveAllowScrape } from "@/lib/grounding/scrape-default";

afterEach(() => {
  delete process.env.LIVE_SCRAPE_DEFAULT;
});

describe("isScrapeDefaultEnabled", () => {
  it("is OFF when unset — the shipped posture, and the arm production runs", () => {
    delete process.env.LIVE_SCRAPE_DEFAULT;
    expect(isScrapeDefaultEnabled()).toBe(false);
  });

  it('is ON for exactly "true"', () => {
    process.env.LIVE_SCRAPE_DEFAULT = "true";
    expect(isScrapeDefaultEnabled()).toBe(true);
  });

  it("resolves every ambiguous value to NOT spending", () => {
    // The inverse of the house `!== "false"` switch, and deliberately so. A shipped-ON feature
    // should survive a half-set env; a spend must not be armed by one. Each of these is a
    // plausible typo or a value a shell/CI can produce on its own.
    for (const v of ["True", "TRUE", "1", "yes", "on", " true", "true ", "", "false"]) {
      process.env.LIVE_SCRAPE_DEFAULT = v;
      expect(isScrapeDefaultEnabled(), `"${v}" must not authorize spend`).toBe(false);
    }
  });
});

describe("resolveAllowScrape", () => {
  it("honours an explicit request-level authorization with the flag off", () => {
    delete process.env.LIVE_SCRAPE_DEFAULT;
    expect(resolveAllowScrape(true)).toBe(true);
  });

  it("refuses a truthy-but-wrong body value — the pre-existing strict check is preserved", () => {
    delete process.env.LIVE_SCRAPE_DEFAULT;
    // These are the shapes an untrusted body can carry. Before this module the routes read
    // `body.allowScrape === true`; loosening that to a truthy check would let `"false"` — a string,
    // and truthy — start billing. Pinned so the refactor cannot have widened it.
    for (const v of ["true", "false", 1, {}, [], "yes"]) {
      expect(resolveAllowScrape(v), `${JSON.stringify(v)} must not authorize spend`).toBe(false);
    }
    expect(resolveAllowScrape(undefined)).toBe(false);
    expect(resolveAllowScrape(null)).toBe(false);
    expect(resolveAllowScrape(false)).toBe(false);
  });

  it("authorizes an unasking request when the environment opts in — the whole point of the flag", () => {
    process.env.LIVE_SCRAPE_DEFAULT = "true";
    expect(resolveAllowScrape(undefined)).toBe(true);
    expect(resolveAllowScrape(false)).toBe(true);
  });

  it("reads the env per call, so flipping .env.local needs no dev-server restart", () => {
    delete process.env.LIVE_SCRAPE_DEFAULT;
    expect(resolveAllowScrape(undefined)).toBe(false);
    process.env.LIVE_SCRAPE_DEFAULT = "true";
    expect(resolveAllowScrape(undefined)).toBe(true);
    delete process.env.LIVE_SCRAPE_DEFAULT;
    expect(resolveAllowScrape(undefined)).toBe(false);
  });
});
