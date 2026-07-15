/**
 * CR-01 regression — OAuth callback open-redirect guard.
 *
 * The callback reads an attacker-controllable `next` query param and 302s the
 * freshly-authenticated user to it. `new URL(next, origin)` does NOT pin the
 * host, so a protocol-relative / backslash / absolute `next` escapes to an
 * arbitrary origin (post-login open redirect — phishing / token capture).
 *
 * `safeNext()` is the guard: it accepts ONLY a same-origin root-relative path
 * and falls back to /start for everything else. These cases lock that behavior
 * so the redirect can never again leak off-origin (e.g. `next=//evil.com`
 * must resolve to /start, never evil.com).
 */
import { describe, it, expect } from "vitest";
import { safeNext } from "../callback/route";

const ORIGIN = "https://app.numen.test";

describe("safeNext — open-redirect guard (CR-01)", () => {
  describe("blocks off-origin escapes (falls back to /start)", () => {
    const malicious: [string, string][] = [
      ["protocol-relative //host", "//evil.com"],
      ["backslash /\\host", "/\\evil.com"],
      ["multi-slash ////host", "////evil.com"],
      ["absolute https URL", "https://evil.com"],
      ["absolute https URL with path", "https://evil.com/steal"],
      ["absolute http URL", "http://evil.com"],
      ["backslash-after-slash mix", "/\\/evil.com"],
      ["protocol-relative with path", "//evil.com/phish"],
      ["scheme-only javascript", "javascript:alert(1)"],
      ["non-leading-slash relative", "evil.com"],
    ];

    it.each(malicious)("blocks %s -> /start", (_label, value) => {
      const result = safeNext(value, ORIGIN);
      expect(result).toBe("/start");
      // And, critically, the resolved redirect never lands on evil.com.
      expect(new URL(result, ORIGIN).origin).toBe(ORIGIN);
      expect(result).not.toContain("evil.com");
    });

    it("the canonical exploit `next=//evil.com` resolves to /start, NOT evil.com", () => {
      // Documents the exact CVE-class: new URL('//evil.com', origin) === evil.com,
      // but safeNext must neutralize it.
      expect(new URL("//evil.com", ORIGIN).origin).toBe("https://evil.com");
      expect(safeNext("//evil.com", ORIGIN)).toBe("/start");
    });
  });

  describe("allows legitimate same-origin paths", () => {
    it("passes a plain root-relative path", () => {
      expect(safeNext("/home", ORIGIN)).toBe("/home");
    });

    it("passes a nested path with query + hash", () => {
      expect(safeNext("/analyze/abc123?tab=audience#top", ORIGIN)).toBe(
        "/analyze/abc123?tab=audience#top",
      );
    });

    it("defaults to /start for a null/absent next", () => {
      expect(safeNext(null, ORIGIN)).toBe("/start");
    });

    it("defaults to /start for an empty string", () => {
      expect(safeNext("", ORIGIN)).toBe("/start");
    });
  });
});
