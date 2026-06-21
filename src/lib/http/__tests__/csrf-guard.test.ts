/**
 * Tests for csrfGuard — the shared Content-Type + cross-origin CSRF guard (WR-01).
 *
 * The guard returns a 415/403 Response on violation, or null when the request passes.
 * Mirrors the inline guard previously duplicated across remix/run, remix/adapt, and
 * creator-profile (T-04-07 / T-06-14).
 */
import { describe, it, expect } from "vitest";
import { csrfGuard } from "../csrf-guard";

const URL_SAME = "https://app.example.com/api/tools/read";

function req(headers: Record<string, string>): Request {
  return new Request(URL_SAME, { method: "POST", headers });
}

describe("csrfGuard (WR-01)", () => {
  it("passes (null) for application/json with no Origin header", () => {
    expect(csrfGuard(req({ "content-type": "application/json" }))).toBeNull();
  });

  it("passes (null) for application/json with a charset suffix", () => {
    expect(csrfGuard(req({ "content-type": "application/json; charset=utf-8" }))).toBeNull();
  });

  it("passes (null) for a same-origin request", () => {
    const r = csrfGuard(
      req({ "content-type": "application/json", origin: "https://app.example.com" }),
    );
    expect(r).toBeNull();
  });

  it("returns 415 for a non-JSON Content-Type", async () => {
    const r = csrfGuard(req({ "content-type": "text/plain" }));
    expect(r).not.toBeNull();
    expect(r!.status).toBe(415);
    await expect(r!.json()).resolves.toEqual({ error: "Unsupported Media Type" });
  });

  it("returns 415 when Content-Type is missing", () => {
    expect(csrfGuard(req({}))!.status).toBe(415);
  });

  it("returns 403 for a cross-origin request", async () => {
    const r = csrfGuard(
      req({ "content-type": "application/json", origin: "https://attacker.example.com" }),
    );
    expect(r).not.toBeNull();
    expect(r!.status).toBe(403);
    await expect(r!.json()).resolves.toEqual({ error: "Cross-origin request denied" });
  });

  it("checks Content-Type BEFORE origin (415 wins when both are wrong)", () => {
    const r = csrfGuard(
      req({ "content-type": "text/plain", origin: "https://attacker.example.com" }),
    );
    expect(r!.status).toBe(415);
  });
});
